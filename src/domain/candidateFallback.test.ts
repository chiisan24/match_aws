/**
 * Tests for {@link finalizeCandidates} — the rule that decides what fills a
 * swipe deck when the primary source comes back short.
 *
 * The primary source for a food deck is a language model naming a handful of
 * restaurants, each verified one-by-one against Google Places. Every name that
 * fails its lookup vanishes silently, so a 6-name proposal routinely settles as
 * 3 cards. `sightseeing` survived that because it could top up from the bundled
 * catalogue and step the radius outwards; `food` and `cafe` returned early and
 * kept whatever survived. This file pins the fix and, just as importantly, pins
 * the parts that must *not* have changed:
 *
 *  - food / cafe now top up, from food spots only — a 札所 is not lunch;
 *  - sightseeing still refuses food spots;
 *  - `custom` still receives nothing, because a free-text request cannot be
 *    answered from a fixed local pool;
 *  - primary candidates always precede fallbacks, and `maximumCount` /
 *    `usedPlaceIds` still bound the result.
 *
 * Pools are built by hand rather than imported from `DEFAULT_FALLBACK_POOLS`, so
 * a change to the bundled catalogue cannot silently move these assertions.
 */

import { describe, expect, it } from "vitest";

import {
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_MINIMUM_COUNT,
  finalizeCandidates,
  type FallbackPoint,
  type FallbackPools,
  type FinalizeContext,
} from "./candidateFallback";
import type { GeoPoint, RouteCandidate, RouteCandidateKind } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** 大街道あたり。すべての距離はここを中心に組んである。 */
const CENTER: GeoPoint = { lat: 33.8456, lng: 132.769 };

/**
 * A point `metresNorth` north of {@link CENTER}.
 *
 * One degree of latitude is ~111,320m, so this stays accurate enough for the
 * 5/10/20km bands the radius expansion steps through, and it keeps each
 * fixture's distance readable at the call site.
 */
function north(metresNorth: number): GeoPoint {
  return { lat: CENTER.lat + metresNorth / 111_320, lng: CENTER.lng };
}

function foodPoint(id: string, metresNorth: number): FallbackPoint {
  return {
    id,
    source: "spot",
    name: `食堂${id}`,
    location: north(metresNorth),
    formattedAddress: "愛媛県",
    descriptions: { ja: `${id}のごはん` },
    category: "food",
  };
}

function sightPoint(id: string, metresNorth: number): FallbackPoint {
  return {
    id,
    source: "spot",
    name: `名所${id}`,
    location: north(metresNorth),
    formattedAddress: "愛媛県",
    descriptions: { ja: `${id}の見どころ` },
    category: "sightseeing",
  };
}

function templePoint(id: string, metresNorth: number): FallbackPoint {
  return {
    id,
    source: "temple",
    name: `第50番札所 ${id}`,
    location: north(metresNorth),
    formattedAddress: "愛媛県松山市",
    descriptions: { ja: `${id}をお参りできます。` },
  };
}

/**
 * Pools with enough of each type to satisfy the minimum on its own, so a deck
 * that came back with the wrong type failed a filter rather than ran dry.
 *
 * Distances are staggered so the nearest-first ordering is observable, and the
 * `-far` entries sit outside 5km to exercise the radius expansion.
 */
const POOLS: FallbackPools = {
  temples: [
    templePoint("temple-a", 500),
    templePoint("temple-b", 1_200),
    templePoint("temple-c", 1_900),
    templePoint("temple-d", 2_600),
    templePoint("temple-e", 3_300),
    templePoint("temple-f", 4_000),
  ],
  spots: [
    foodPoint("food-1", 400),
    foodPoint("food-2", 900),
    foodPoint("food-3", 1_400),
    foodPoint("food-4", 2_100),
    foodPoint("food-5", 2_800),
    foodPoint("food-6", 3_500),
    foodPoint("food-far", 12_000),
    sightPoint("sight-1", 600),
    sightPoint("sight-2", 1_100),
    sightPoint("sight-3", 1_600),
    sightPoint("sight-4", 2_300),
    sightPoint("sight-5", 3_000),
  ],
};

/** A pool whose only food entries sit beyond 5km, to force the expansion. */
const DISTANT_FOOD_POOLS: FallbackPools = {
  temples: [],
  spots: [
    foodPoint("food-8km-a", 8_000),
    foodPoint("food-8km-b", 8_500),
    foodPoint("food-18km-a", 18_000),
    foodPoint("food-18km-b", 18_500),
    foodPoint("food-18km-c", 19_000),
  ],
};

/** A primary (Google-verified) candidate. */
function primary(id: string, kind: RouteCandidateKind): RouteCandidate {
  return {
    id: `${kind}:${id}`,
    kind,
    title: `AI推薦 ${id}`,
    description: `${id}のおすすめ理由`,
    searchQuery: id,
    place: {
      id,
      name: `AI推薦 ${id}`,
      formattedAddress: "愛媛県松山市",
      location: north(300),
    },
  };
}

function context(overrides: Partial<FinalizeContext> = {}): FinalizeContext {
  return {
    kind: "food",
    lang: "ja",
    center: CENTER,
    baseRadiusMeters: 5_000,
    usedPlaceIds: [],
    maximumCount: CANDIDATE_MAXIMUM_COUNT,
    ...overrides,
  };
}

/** Ids of the settled deck, in deck order. */
function idsOf(result: { candidates: RouteCandidate[] }): string[] {
  return result.candidates.map((candidate) => candidate.place.id);
}

// ---------------------------------------------------------------------------
// The fix: food and cafe now top up
// ---------------------------------------------------------------------------

describe("finalizeCandidates — 食事・カフェの補完", () => {
  // The behaviour this whole change exists for. Two verified restaurants used to
  // settle as a two-card deck; now the bundled catalogue carries it to the floor.
  it.each<RouteCandidateKind>(["food", "cafe"])(
    "%s は不足分をローカルプールから補完する",
    (kind) => {
      const result = finalizeCandidates(
        [primary("place-verified-1", kind), primary("place-verified-2", kind)],
        context({ kind }),
        POOLS,
      );

      expect(result.candidates.length).toBeGreaterThanOrEqual(CANDIDATE_MINIMUM_COUNT);
      // Primary first, in the order supplied, then fallbacks (Req 2 ordering).
      expect(idsOf(result).slice(0, 2)).toEqual([
        "place-verified-1",
        "place-verified-2",
      ]);
      // Every filled seat is a食事どころ, nearest first.
      expect(idsOf(result).slice(2)).toEqual(["food-1", "food-2", "food-3"]);
      expect(
        result.candidates.slice(2).every((candidate) => candidate.kind === kind),
      ).toBe(true);
    },
  );

  // A 札所 or a mountain is not lunch. Before the fix this could not regress
  // because nothing was appended at all; now it can, so it is stated.
  it.each<RouteCandidateKind>(["food", "cafe"])(
    "%s の補完に札所や観光スポットを混ぜない",
    (kind) => {
      const result = finalizeCandidates([], context({ kind }), POOLS);

      const filled = idsOf(result);
      expect(filled.length).toBe(CANDIDATE_MINIMUM_COUNT);
      expect(filled.every((id) => id.startsWith("food-"))).toBe(true);
      expect(filled.some((id) => id.startsWith("temple-"))).toBe(false);
      expect(filled.some((id) => id.startsWith("sight-"))).toBe(false);
    },
  );

  // 内子のように5km圏内の店が数件しかない土地では、段階拡大だけが頼りになる。
  it("5km圏内に食事どころが無ければ半径を段階的に広げる", () => {
    const result = finalizeCandidates([], context({ kind: "food" }), DISTANT_FOOD_POOLS);

    // 5km では0件 → 10km で2件 → まだ下限未満なので 20km まで開く。
    expect(result.appliedRadiusMeters).toBe(20_000);
    expect(idsOf(result)).toEqual([
      "food-8km-a",
      "food-8km-b",
      "food-18km-a",
      "food-18km-b",
      "food-18km-c",
    ]);
  });

  // 補完が要らないときに半径を勝手に広げないこと。広げた半径はクライアント側の
  // 距離フィルタの上限になるので、無意味に広げると圏外の候補が通ってしまう。
  it("下限を満たしていれば半径は要求値のまま", () => {
    const full = Array.from({ length: CANDIDATE_MINIMUM_COUNT }, (_, index) =>
      primary(`place-${index}`, "food"),
    );

    const result = finalizeCandidates(full, context({ kind: "food" }), POOLS);

    expect(result.appliedRadiusMeters).toBe(5_000);
    expect(idsOf(result)).toEqual(full.map((candidate) => candidate.place.id));
  });
});

// ---------------------------------------------------------------------------
// What must not have changed
// ---------------------------------------------------------------------------

describe("finalizeCandidates — 既存の挙動", () => {
  // 観光デッキに食堂が混ざらないことは以前からの契約。food 側を開けた副作用で
  // 壊れやすいので、逆向きも明示的に固定する。
  it("sightseeing の補完に食事どころを混ぜない", () => {
    const result = finalizeCandidates([], context({ kind: "sightseeing" }), POOLS);

    const filled = idsOf(result);
    expect(filled.length).toBe(CANDIDATE_MINIMUM_COUNT);
    expect(filled.some((id) => id.startsWith("food-"))).toBe(false);
    // 距離順なので札所と観光スポットが近い順に混ざる。
    expect(filled).toEqual([
      "temple-a",
      "sight-1",
      "sight-2",
      "temple-b",
      "sight-3",
    ]);
  });

  // 自由記述の要望を手元のプールで埋めると、聞かれていない質問に答えることに
  // なる。件数が少ないほうがまだ正直。
  it("custom は補完せず、半径も広げない", () => {
    const only = primary("place-custom-1", "custom");

    const result = finalizeCandidates([only], context({ kind: "custom" }), POOLS);

    expect(idsOf(result)).toEqual(["place-custom-1"]);
    expect(result.appliedRadiusMeters).toBe(5_000);
    expect(result.minimumCount).toBe(CANDIDATE_MINIMUM_COUNT);
  });

  it("maximumCount を超えない", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      primary(`place-${index}`, "food"),
    );

    const result = finalizeCandidates(
      many,
      context({ kind: "food", maximumCount: 3 }),
      POOLS,
    );

    expect(result.candidates).toHaveLength(3);
  });

  // すでにルートに入っている店を候補に出し直さない。food で補完を開いたので、
  // プール側にも同じ除外が効いている必要がある。
  it("ルート既存の place.id はプール側からも除外する", () => {
    const result = finalizeCandidates(
      [],
      context({ kind: "food", usedPlaceIds: ["food-1", "food-3"] }),
      POOLS,
    );

    const filled = idsOf(result);
    expect(filled).not.toContain("food-1");
    expect(filled).not.toContain("food-3");
    expect(filled).toEqual(["food-2", "food-4", "food-5", "food-6", "food-far"]);
  });

  // 補完側の候補は source を持つので、UI が「AI推薦」と「手元のデータ」を
  // 見分けられる。
  it("補完候補は source と id に由来が残る", () => {
    const result = finalizeCandidates([], context({ kind: "food" }), POOLS);

    const first = result.candidates[0];
    expect(first.source).toBe("spot");
    expect(first.id).toBe("food:spot:food-1");
    expect(first.description).toBe("food-1のごはん");
  });
});
