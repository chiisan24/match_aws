/**
 * Tests for the 発見 collection game's pure logic.
 *
 * Three claims carry the feature, and each is stated as a property because each
 * has to hold for the *whole* catalogue rather than for a chosen example:
 *
 *  - the deck is a permutation with undecided cards first, and it is stable
 *    across calls (AC 3.1-3.5, 12.7). If it were not, cards would vanish or
 *    reshuffle between renders;
 *  - every spot lands in exactly one area (AC 4.5, 12.9), which is what makes
 *    the area badge totals add up to the catalogue size;
 *  - the achievement rate and badges follow from the record alone (AC 4.2-4.8,
 *    12.8), including the awkward cases: an empty catalogue, and a record
 *    holding ids that are no longer in the dataset.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  classifyArea,
  deckOrder,
  discoveryProgress,
  DISCOVERY_AREAS,
} from "./discovery";
import type { Spot } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORIES: Spot["category"][] = [
  "sightseeing",
  "food",
  "souvenir",
  "onsen",
];

/**
 * A spot with only the fields this module reads: `id`, `category`, `location`.
 *
 * Coordinates are drawn from a box that comfortably contains Ehime *and*
 * overshoots it, so the classifier is exercised outside the prefecture too — it
 * has to stay total no matter where the point is.
 */
const spotArb: fc.Arbitrary<Spot> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  category: fc.constantFrom(...CATEGORIES),
  location: fc.record({
    lat: fc.double({ min: 32, max: 35, noNaN: true }),
    lng: fc.double({ min: 131, max: 135, noNaN: true }),
  }),
  localizedDescriptions: fc.constant({}),
  reviews: fc.constant([]),
  imageUrls: fc.constant([]),
});

/** A catalogue with unique ids — the invariant the real dataset also holds. */
const catalogueArb: fc.Arbitrary<Spot[]> = fc
  .uniqueArray(spotArb, { maxLength: 30, selector: (spot) => spot.id })
  .map((spots) => spots);

/** Build one spot inline for the example-based cases. */
function spot(id: string, category: Spot["category"], lat: number, lng: number): Spot {
  return {
    id,
    name: id,
    category,
    location: { lat, lng },
    localizedDescriptions: {},
    reviews: [],
    imageUrls: [],
  };
}

// ---------------------------------------------------------------------------
// Deck order
// ---------------------------------------------------------------------------

describe("deckOrder", () => {
  /**
   * Feature: swipe-discovery-game, Property 1: 提示順はカタログの順列である
   *
   * *For any* catalogue and record, the deck holds every catalogue spot exactly
   * once. Losing a spot would make the achievement rate unreachable; duplicating
   * one would let a single place be decided twice.
   */
  it("Feature: swipe-discovery-game, Property 1: 提示順はカタログの順列である", () => {
    fc.assert(
      fc.property(catalogueArb, fc.array(fc.string()), (catalogue, seenIds) => {
        const deck = deckOrder(catalogue, new Set(seenIds));
        expect(deck).toHaveLength(catalogue.length);
        expect([...deck].map((s) => s.id).sort()).toEqual(
          catalogue.map((s) => s.id).sort(),
        );
      }),
    );
  });

  /**
   * Feature: swipe-discovery-game, Property 2: 未判定のスポットが先に並ぶ
   *
   * *For any* catalogue and record, no undecided spot appears after a decided
   * one. This is what makes "see them all" progress with every session instead
   * of re-showing what the user already answered.
   */
  it("Feature: swipe-discovery-game, Property 2: 未判定のスポットが先に並ぶ", () => {
    fc.assert(
      fc.property(catalogueArb, fc.array(fc.string()), (catalogue, seenIds) => {
        const seen = new Set(seenIds);
        const flags = deckOrder(catalogue, seen).map((s) => (seen.has(s.id) ? 1 : 0));
        // Sorted ascending means every 0 precedes every 1.
        expect(flags).toEqual([...flags].sort((a, b) => a - b));
      }),
    );
  });

  /**
   * Feature: swipe-discovery-game, Property 3: 提示順は決定的で入力を変更しない
   *
   * *For any* catalogue and record, two calls agree, a shuffled catalogue with
   * the same members yields the same deck, and neither input is mutated. The
   * shuffle case is the strict one: it proves the order comes from `Spot.id`
   * rather than from the array's incoming order.
   */
  it("Feature: swipe-discovery-game, Property 3: 提示順は決定的で入力を変更しない", () => {
    fc.assert(
      fc.property(catalogueArb, fc.array(fc.string()), (catalogue, seenIds) => {
        const seen = new Set(seenIds);
        const snapshot = catalogue.map((s) => s.id);
        const seenSnapshot = [...seen].sort();

        const first = deckOrder(catalogue, seen).map((s) => s.id);
        const second = deckOrder(catalogue, seen).map((s) => s.id);
        const shuffled = deckOrder([...catalogue].reverse(), seen).map((s) => s.id);

        expect(second).toEqual(first);
        expect(shuffled).toEqual(first);
        // Inputs untouched (AC 3.5).
        expect(catalogue.map((s) => s.id)).toEqual(snapshot);
        expect([...seen].sort()).toEqual(seenSnapshot);
      }),
    );
  });

  it("returns an empty deck for an empty catalogue", () => {
    expect(deckOrder([], new Set())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Area classifier
// ---------------------------------------------------------------------------

describe("classifyArea", () => {
  /**
   * Feature: swipe-discovery-game, Property 4: 各スポットはちょうど1つのエリアに属する
   *
   * *For any* spot, the classifier returns one of the declared areas. Totality is
   * the whole point: the area badges partition the catalogue, so an
   * unclassifiable spot would make the badge totals disagree with the
   * achievement denominator.
   */
  it("Feature: swipe-discovery-game, Property 4: 各スポットはちょうど1つのエリアに属する", () => {
    fc.assert(
      fc.property(spotArb, (candidate) => {
        expect(DISCOVERY_AREAS).toContain(classifyArea(candidate));
      }),
    );
  });

  it("places well-known spots in the region residents would name", () => {
    // 今治城 → 東予, 松山城 → 中予, 宇和島城 → 南予.
    expect(classifyArea(spot("imabari", "sightseeing", 34.0634, 133.0068))).toBe("touyo");
    expect(classifyArea(spot("matsuyama", "sightseeing", 33.8457, 132.7657))).toBe("chuuyo");
    expect(classifyArea(spot("uwajima", "sightseeing", 33.2196, 132.5637))).toBe("nanyo");
  });

  it("still classifies a spot whose coordinates are unusable", () => {
    const broken = {
      ...spot("broken", "food", 0, 0),
      location: { lat: Number.NaN, lng: Number.NaN },
    };
    expect(DISCOVERY_AREAS).toContain(classifyArea(broken));
  });
});

// ---------------------------------------------------------------------------
// Progress & badges
// ---------------------------------------------------------------------------

describe("discoveryProgress", () => {
  /**
   * Feature: swipe-discovery-game, Property 5: 達成率は0以上100以下の整数である
   *
   * *For any* catalogue and record — including records full of ids that are not
   * in the catalogue — the rate stays a whole number inside 0..100, and the area
   * badge totals sum to the catalogue size (the partition claim, from the other
   * side).
   */
  it("Feature: swipe-discovery-game, Property 5: 達成率は0以上100以下の整数である", () => {
    fc.assert(
      fc.property(catalogueArb, fc.array(fc.string()), (catalogue, seenIds) => {
        const progress = discoveryProgress(catalogue, new Set(seenIds));
        expect(Number.isInteger(progress.percent)).toBe(true);
        expect(progress.percent).toBeGreaterThanOrEqual(0);
        expect(progress.percent).toBeLessThanOrEqual(100);
        expect(progress.total).toBe(catalogue.length);
        expect(progress.seen).toBeLessThanOrEqual(catalogue.length);
        const areaSum = progress.areaBadges.reduce((sum, b) => sum + b.total, 0);
        expect(areaSum).toBe(catalogue.length);
      }),
    );
  });

  /**
   * Feature: swipe-discovery-game, Property 6: バッジはグループ全件判定で獲得される
   *
   * *For any* catalogue, deciding the entire catalogue earns every returned
   * badge and puts the rate at 100; deciding nothing earns none and puts it at 0.
   * Stated over both extremes because the badge rule is `seen >= total`, and the
   * two ends are where an off-by-one would show.
   */
  it("Feature: swipe-discovery-game, Property 6: バッジはグループ全件判定で獲得される", () => {
    fc.assert(
      fc.property(catalogueArb.filter((c) => c.length > 0), (catalogue) => {
        const none = discoveryProgress(catalogue, new Set());
        expect(none.percent).toBe(0);
        expect(none.complete).toBe(false);
        expect([...none.areaBadges, ...none.categoryBadges].every((b) => !b.earned)).toBe(true);

        const all = discoveryProgress(catalogue, new Set(catalogue.map((s) => s.id)));
        expect(all.percent).toBe(100);
        expect(all.complete).toBe(true);
        expect([...all.areaBadges, ...all.categoryBadges].every((b) => b.earned)).toBe(true);
      }),
    );
  });

  it("floors the rate rather than rounding it", () => {
    // 1 of 3 = 33.33…% must read 33, not 33.3 and not 34.
    const catalogue = [
      spot("a", "sightseeing", 33.84, 132.76),
      spot("b", "food", 33.84, 132.76),
      spot("c", "onsen", 33.84, 132.76),
    ];
    expect(discoveryProgress(catalogue, new Set(["a"])).percent).toBe(33);
  });

  it("ignores decided ids that are no longer in the catalogue (AC 4.4)", () => {
    const catalogue = [spot("a", "sightseeing", 33.84, 132.76)];
    const progress = discoveryProgress(catalogue, new Set(["a", "deleted", "gone"]));
    expect(progress.seen).toBe(1);
    expect(progress.percent).toBe(100);
  });

  it("omits badges for groups with no spots (AC 4.8)", () => {
    // Only 中予 and only `food`, so the other areas and categories must not
    // appear as zero-progress badges.
    const catalogue = [spot("a", "food", 33.84, 132.76)];
    const progress = discoveryProgress(catalogue, new Set());
    expect(progress.areaBadges.map((b) => b.id)).toEqual(["chuuyo"]);
    expect(progress.categoryBadges.map((b) => b.id)).toEqual(["food"]);
  });

  it("reports 0% and no badges for an empty catalogue", () => {
    const progress = discoveryProgress([], new Set());
    expect(progress.percent).toBe(0);
    expect(progress.complete).toBe(false);
    expect(progress.areaBadges).toEqual([]);
    expect(progress.categoryBadges).toEqual([]);
  });
});
