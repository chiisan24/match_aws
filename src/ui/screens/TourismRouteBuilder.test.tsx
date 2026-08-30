/**
 * Tests for the {@link TourismRouteBuilder} → Tourism_Store wiring.
 *
 * The screen itself is unchanged in spirit: candidates come from a `ChatPort`,
 * the user keeps or skips each one, and a final route is confirmed. What this
 * file pins down is the write side that was added — every 「興味あり」 lands in
 * お気に入り at the moment it is decided (Req 2.1), and nothing else on the
 * screen quietly undoes that.
 *
 * These are example-based on purpose. The conversion rule itself is fixed
 * exhaustively by the property tests in `src/domain/routeCandidate.test.ts`, and
 * the store's de-duplication by those in `src/app/TourismContext.test.tsx`; what
 * is left here is whether the screen calls them at the right moments, which is a
 * claim about a handful of concrete interactions rather than about all inputs.
 *
 * Everything is driven through the rendered UI — the ♥ / ✕ buttons, the stage
 * transitions, the final editor — because the wiring is only correct if it is
 * reachable that way. お気に入り / しおり are read back through a probe mounted
 * under the same `TourismProvider`, following the `StoreProbe` / `mountStore`
 * shape of `src/app/TourismContext.test.tsx`.
 *
 * Shared fixtures (the fake `ChatPort`, the theme, the candidate pools, the
 * probe and `mountRouteBuilder`) sit at the top of the file so every `describe`
 * below draws from the same setup.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  TourismProvider,
  useTourism,
  type TourismContextValue,
} from "../../app/TourismContext";
import { resolveLabel } from "../../domain/i18n";
import type {
  GeoArea,
  GeoPoint,
  LangCode,
  RecommendedPlan,
  RouteCandidate,
  RouteCandidateKind,
  RouteCandidatesInput,
  RouteCandidatesResult,
  Spot,
  TourismRoutePlan,
  TourismRoutePlanInput,
} from "../../domain/types";
import { I18nProvider, UI_LABELS } from "../../i18n";
import type { ChatPort, StoragePort } from "../../ports";
import { TourismRouteBuilder } from "./TourismRouteBuilder";

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * Display language for the whole file. It is also the language the conversion
 * receives, so `localizedDescriptions` is expected under this key (Req 1.6).
 */
const LANG: LangCode = "ja";

/**
 * Resolve a label the same way the screen does.
 *
 * Queries go through this rather than through hard-coded Japanese strings: the
 * copy in `labels.ts` is editorial and moves independently of this wiring, and a
 * test that named the button by its current wording would fail on a rewrite that
 * changed nothing about behaviour.
 */
function label(key: string): string {
  return resolveLabel(UI_LABELS, LANG, key);
}

// ---------------------------------------------------------------------------
// Candidate fixtures
// ---------------------------------------------------------------------------

/**
 * The area the theme covers. Every fixture coordinate below sits a few hundred
 * metres from this centre, well inside the radius, because the screen drops any
 * candidate further out than the applied radius — a fixture outside it would
 * vanish from the deck for reasons that have nothing to do with what is tested.
 */
const AREA: GeoArea = {
  center: { lat: 33.8416, lng: 132.7657 },
  radiusMeters: 3_000,
};

/**
 * Build one candidate.
 *
 * `title` and `place.name` are deliberately different strings: the conversion
 * takes `Spot.name` from the candidate's `title` (Req 1.3) and `Spot.id` from
 * `place.id` (Req 1.2), so a mix-up between the two pairs is visible instead of
 * hidden behind identical values.
 */
function candidate(spec: {
  readonly id: string;
  readonly kind: RouteCandidateKind;
  readonly title: string;
  readonly placeId: string;
  readonly placeName: string;
  readonly location: GeoPoint;
}): RouteCandidate {
  return {
    id: spec.id,
    kind: spec.kind,
    title: spec.title,
    description: `${spec.title}の紹介文`,
    searchQuery: spec.title,
    place: {
      id: spec.placeId,
      name: spec.placeName,
      formattedAddress: `愛媛県松山市（${spec.placeName}）`,
      location: spec.location,
    },
  };
}

const SIGHTSEEING_KEPT = candidate({
  id: "candidate-sightseeing-kept",
  kind: "sightseeing",
  title: "松山城の天守",
  placeId: "place-matsuyama-castle",
  placeName: "Matsuyama Castle",
  location: { lat: 33.8457, lng: 132.7657 },
});

const SIGHTSEEING_SKIPPED = candidate({
  id: "candidate-sightseeing-skipped",
  kind: "sightseeing",
  title: "萬翠荘",
  placeId: "place-bansuiso",
  placeName: "Bansuiso",
  location: { lat: 33.8430, lng: 132.7622 },
});

/**
 * A 食事 candidate for a place already offered in the 観光 deck: a different
 * `candidate.id`, the same `place.id`.
 *
 * This is the only route by which the same place can be decided twice. Coming
 * back from 見送り does not do it — `restoreCandidate` inserts into the route and
 * opens the final screen rather than returning the card to the deck, and `decide`
 * only ever moves the index forward — so a candidate is never presented twice
 * inside one stage. Across stages it can be, which is what AC 2.3 has to survive.
 */
const FOOD_SAME_PLACE = candidate({
  id: "candidate-food-same-place",
  kind: "food",
  title: "松山城のふもとの食堂",
  placeId: SIGHTSEEING_KEPT.place.id,
  placeName: SIGHTSEEING_KEPT.place.name,
  location: SIGHTSEEING_KEPT.place.location,
});

const FOOD_NEW_PLACE = candidate({
  id: "candidate-food-new-place",
  kind: "food",
  title: "五色そうめんの店",
  placeId: "place-goshiki-somen",
  placeName: "Goshiki Somen",
  location: { lat: 33.8390, lng: 132.7680 },
});

const CAFE_CANDIDATE = candidate({
  id: "candidate-cafe",
  kind: "cafe",
  title: "城下の喫茶室",
  placeId: "place-castle-cafe",
  placeName: "Castle Cafe",
  location: { lat: 33.8422, lng: 132.7669 },
});

const CUSTOM_CANDIDATE = candidate({
  id: "candidate-custom",
  kind: "custom",
  title: "夕日のきれいな堤防",
  placeId: "place-sunset-bank",
  placeName: "Sunset Bank",
  location: { lat: 33.8402, lng: 132.7641 },
});

/** What the fake `ChatPort` hands back for each stage. */
const CANDIDATES_BY_KIND: Record<RouteCandidateKind, RouteCandidate[]> = {
  sightseeing: [SIGHTSEEING_KEPT, SIGHTSEEING_SKIPPED],
  food: [FOOD_SAME_PLACE, FOOD_NEW_PLACE],
  cafe: [CAFE_CANDIDATE],
  custom: [CUSTOM_CANDIDATE],
};

/** Arrival times the fake plan hands back, one per selected stop. */
const PLAN_TIMES = ["09:00", "10:30", "12:00", "13:30"];

/**
 * The theme the builder starts from.
 *
 * `stops` is empty so `initialRouteFromTheme` seeds nothing: the route and
 * お気に入り both start empty and everything that ends up in them came from a
 * decision made in this test. `area` is set explicitly because the screen needs
 * a centre — with neither an area nor a located stop the deck cannot load at all.
 */
const THEME: RecommendedPlan = {
  id: "theme-castle-town",
  mode: "tourism",
  icon: "🏯",
  title: "城下町をゆっくり歩く",
  summary: "松山城のまわりをのんびり回るテーマ。",
  reason: "はじめての松山でも歩きやすい範囲にまとまっているため。",
  duration: "半日",
  transport: "徒歩",
  intensity: "ゆったり",
  area: AREA,
  stops: [],
};

// ---------------------------------------------------------------------------
// Fake ports
// ---------------------------------------------------------------------------

/**
 * `I18nProvider` requires a `StoragePort`, but with `rehydrate={false}` nothing
 * is read and no language is changed, so nothing is written either. This keeps
 * persistence out of a file about the store wiring; the persistence seam has its
 * own tests.
 */
const NOOP_STORAGE: StoragePort = {
  async load() {
    return null;
  },
  async save() {
    // Nothing is persisted in these tests.
  },
  async enqueueOffline() {
    // Unused.
  },
  async flushOffline() {
    return [];
  },
};

/** A `ChatPort` with fixed candidate sets that records what it was asked for. */
interface FakeChat extends ChatPort {
  /** The `kind` of every candidate request, in call order. */
  readonly candidateRequests: RouteCandidateKind[];
  /** Every final-plan request, in call order. */
  readonly planRequests: TourismRoutePlanInput[];
}

function createFakeChat(): FakeChat {
  const candidateRequests: RouteCandidateKind[] = [];
  const planRequests: TourismRoutePlanInput[] = [];
  return {
    candidateRequests,
    planRequests,
    async generateRouteCandidates(
      input: RouteCandidatesInput,
    ): Promise<RouteCandidatesResult> {
      candidateRequests.push(input.kind);
      const candidates = CANDIDATES_BY_KIND[input.kind];
      return {
        candidates,
        appliedRadiusMeters: input.area.radiusMeters,
        // Reported as exactly what is supplied. Anything higher would put the
        // response under the minimum and the screen's own guard would top the
        // deck up from `DEFAULT_FALLBACK_POOLS`, mixing cards these tests never
        // declared into the deck.
        minimumCount: candidates.length,
      };
    },
    async generateTourismRoutePlan(
      input: TourismRoutePlanInput,
    ): Promise<TourismRoutePlan> {
      planRequests.push(input);
      // Keeps the order it was given, so the confirmed route is the order the
      // user built. Every `candidateId` echoes back a selected stop — the screen
      // treats an unmatched id as a plan failure.
      return {
        stops: input.selectedStops.map((stop, position) => ({
          candidateId: stop.candidateId,
          time: PLAN_TIMES[position] ?? "18:00",
        })),
      };
    },
    generateRecommendedPlans() {
      throw new Error("generateRecommendedPlans は Route_Builder から呼ばれない");
    },
    generatePilgrimagePlan() {
      throw new Error("generatePilgrimagePlan は Route_Builder から呼ばれない");
    },
    estimateNextTempleNav() {
      throw new Error("estimateNextTempleNav は Route_Builder から呼ばれない");
    },
  };
}

// ---------------------------------------------------------------------------
// Probe + harness
// ---------------------------------------------------------------------------

/**
 * Renders both collections and hands the live context value to the test.
 *
 * Same shape as the probe in `src/app/TourismContext.test.tsx`, and both halves
 * earn their place for the same reasons: the rendered ids prove React
 * re-rendered with the new list (so the お気に入り screen would show it), while
 * the handed-back value lets a test compare whole spots and seed the store.
 */
function StoreProbe({
  store,
}: {
  store: { current: TourismContextValue | null };
}): JSX.Element {
  const tourism = useTourism();
  // Assigning during render is safe here: this probe is the only consumer, and
  // nothing in this file renders under StrictMode.
  store.current = tourism;
  return (
    <>
      <ul data-testid="favorites">
        {tourism.favorites.map((spot) => (
          <li key={spot.id}>{spot.id}</li>
        ))}
      </ul>
      <ul data-testid="shiori">
        {tourism.shiori.map((spot) => (
          <li key={spot.id}>{spot.id}</li>
        ))}
      </ul>
    </>
  );
}

/** A mounted route builder plus the handles a test needs to drive and read it. */
interface MountedBuilder {
  /** The fake port, for asserting which stages were requested. */
  readonly chat: FakeChat;
  /** The `onComplete` spy the screen calls from 「このルートで旅を始める」. */
  readonly onComplete: ReturnType<typeof vi.fn>;
  /** The live store value. */
  readonly store: () => TourismContextValue;
  /** Ids for one collection, as the probe rendered them. */
  readonly renderedIds: (key: "favorites" | "shiori") => string[];
  /** Stop names in the route preview, in route order. */
  readonly routeTitles: () => string[];
  /** Run store actions inside `act` so React flushes before assertions. */
  readonly run: (action: (store: TourismContextValue) => void) => Promise<void>;
  /** Wait until a swipe deck is on screen. */
  readonly deckReady: () => Promise<void>;
  /** Press ♥ (`true`) or ✕ (`false`) on the current card. */
  readonly decide: (interested: boolean) => Promise<void>;
  /** Press the button whose accessible name is the label for `labelKey`. */
  readonly press: (labelKey: string) => Promise<void>;
  /** From an exhausted deck, skip the remaining stages through to 最終画面. */
  readonly advanceToFinal: () => Promise<void>;
  /** Wait for final-plan generation to settle. */
  readonly planSettled: () => Promise<void>;
}

/**
 * Mount the screen under `I18nProvider` + `TourismProvider` with a probe beside
 * it.
 *
 * No `storage` is given to the provider, so both collections live in memory
 * only — the supported configuration (Req 3.6) and the one that keeps these
 * tests about the wiring rather than about persistence.
 */
function mountRouteBuilder(theme: RecommendedPlan = THEME): MountedBuilder {
  const chat = createFakeChat();
  const onComplete = vi.fn();
  const onBack = vi.fn();
  const ref: { current: TourismContextValue | null } = { current: null };
  const { container } = render(
    <I18nProvider storage={NOOP_STORAGE} initialLang={LANG} rehydrate={false}>
      <TourismProvider>
        <StoreProbe store={ref} />
        <TourismRouteBuilder
          chat={chat}
          theme={theme}
          onBack={onBack}
          onComplete={onComplete}
        />
      </TourismProvider>
    </I18nProvider>,
  );

  const store = (): TourismContextValue => {
    if (ref.current === null) throw new Error("StoreProbe did not render");
    return ref.current;
  };
  const press = async (labelKey: string): Promise<void> => {
    await userEvent.click(
      screen.getByRole("button", { name: label(labelKey) }),
    );
  };
  const planSettled = async (): Promise<void> => {
    await waitFor(() => {
      expect(
        screen.queryByText(label("routeBuilder.planLoading")),
      ).toBeNull();
    });
  };

  return {
    chat,
    onComplete,
    store,
    press,
    planSettled,
    renderedIds: (key) =>
      Array.from(container.querySelectorAll(`[data-testid="${key}"] li`)).map(
        (item) => item.textContent ?? "",
      ),
    // The preview puts each stop's name in a `<span>` beside an optional
    // `<time>`; reading the span alone keeps the arrival times — which the
    // しおり deliberately does not carry — out of the comparison.
    routeTitles: () =>
      Array.from(
        container.querySelectorAll(".route-builder-preview__list li span"),
      ).map((item) => item.textContent ?? ""),
    run: async (action) => {
      await act(async () => {
        action(store());
      });
    },
    deckReady: async () => {
      await screen.findByRole("button", {
        name: label("routeBuilder.interested"),
      });
    },
    decide: async (interested) => {
      await press(
        interested
          ? "routeBuilder.interested"
          : "routeBuilder.notInterested",
      );
    },
    advanceToFinal: async () => {
      await press("routeBuilder.next");
      await press("routeBuilder.skip"); // 食事は聞かれるがスキップ
      await press("routeBuilder.skip"); // カフェも同様
      await press("routeBuilder.skip"); // 自由入力を飛ばすと最終画面へ
      await planSettled();
    },
  };
}

afterEach(cleanup);

// ---------------------------------------------------------------------------
// お気に入りへの配線
// ---------------------------------------------------------------------------

describe("TourismRouteBuilder — お気に入りへの配線", () => {
  // Validates: Requirements 2.1
  //
  // The point of the whole change. Before it, a place the traveller marked
  // 「興味あり」 existed only inside this screen's route state and was gone the
  // moment they left, which is the re-hunting the feature exists to end.
  //
  // Asserted against literal expected values rather than against the output of
  // `spotFromRouteCandidate`: comparing the screen's write to the same function
  // it calls would pass no matter what that function did.
  it("♥ で候補が変換規則どおり favorites に入る", async () => {
    const mounted = mountRouteBuilder();
    await mounted.deckReady();

    await mounted.decide(true);

    const favorites = mounted.store().favorites;
    expect(favorites).toHaveLength(1);
    // AC 1.2: the id is the Google Place id, not the candidate id — the two are
    // different strings in the fixture, so this pins down which one is used.
    expect(favorites[0].id).toBe(SIGHTSEEING_KEPT.place.id);
    // AC 1.3: the name is the candidate's title, not `place.name`.
    expect(favorites[0].name).toBe(SIGHTSEEING_KEPT.title);
    // AC 1.5: kind `sightseeing` maps to category `sightseeing`.
    expect(favorites[0].category).toBe("sightseeing");
    // AC 1.6: the description lands under the language on screen.
    expect(favorites[0].localizedDescriptions).toEqual({
      [LANG]: SIGHTSEEING_KEPT.description,
    });
    expect(favorites[0].location).toEqual(SIGHTSEEING_KEPT.place.location);

    // Rendered too, so a お気に入り consumer under the same provider sees it —
    // not just a context object the screen happened to mutate.
    expect(mounted.renderedIds("favorites")).toEqual([
      SIGHTSEEING_KEPT.place.id,
    ]);
  });

  // Validates: Requirements 2.2
  //
  // お気に入り is an addition, not a replacement: 「興味あり」 still has to build
  // the route it always built. A write that had been bolted on in place of the
  // insertion would leave the traveller with a full お気に入り list and an empty
  // route, and every later stage of the builder disabled behind it.
  //
  // The route becomes visible once the deck is exhausted, so the second card is
  // skipped — which also shows the preview holds only what was kept.
  it("♥ でルートプレビューにも候補が現れる", async () => {
    const mounted = mountRouteBuilder();
    await mounted.deckReady();

    await mounted.decide(true); // 松山城の天守
    await mounted.decide(false); // 萬翠荘

    await screen.findByText(label("routeBuilder.routeTitle"));
    expect(mounted.routeTitles()).toEqual([SIGHTSEEING_KEPT.title]);
    expect(mounted.routeTitles()).not.toContain(SIGHTSEEING_SKIPPED.title);
  });

  // Validates: Requirements 2.4
  //
  // The other half of the same claim: only 「興味あり」 writes. A screen that
  // added on every decision would turn お気に入り into a log of everything the
  // traveller was shown, which is worse than not having it — the list stops
  // meaning anything.
  it("✕ では favorites が空のまま", async () => {
    const mounted = mountRouteBuilder();
    await mounted.deckReady();

    await mounted.decide(false);

    expect(mounted.store().favorites).toEqual([]);
    expect(mounted.renderedIds("favorites")).toEqual([]);

    // Anti-vacuity: the decision really was processed — the deck moved on to the
    // next card, so this is a 見送り that wrote nothing rather than a click that
    // did nothing at all.
    expect(
      screen.getByRole("group", { name: SIGHTSEEING_SKIPPED.title }),
    ).toBeInTheDocument();
  });

  // Validates: Requirements 2.3
  //
  // The same place can be offered twice — once as 観光, once as 食事 — and the
  // screen calls `addFavorite` on both decisions, because its own guard is on the
  // route, not on お気に入り. The store's de-duplication is the last line of
  // defence, and without it the traveller's list would show the same place twice
  // with two different names.
  it("2ステージで同一 place.id を選んでも favorites は1件", async () => {
    const mounted = mountRouteBuilder();
    await mounted.deckReady();

    await mounted.decide(true); // 観光: 松山城の天守 → place-matsuyama-castle
    await mounted.decide(false); // 観光デッキを消化
    await mounted.press("routeBuilder.next");
    await mounted.press("routeBuilder.findFood");
    await mounted.deckReady();

    // Anti-vacuity: the 食事 deck really is showing the duplicate-place
    // candidate, so the decision below is a second decision on the same place.
    expect(mounted.chat.candidateRequests).toEqual(["sightseeing", "food"]);
    expect(
      screen.getByRole("group", { name: FOOD_SAME_PLACE.title }),
    ).toBeInTheDocument();

    await mounted.decide(true); // 食事: 同じ place.id

    expect(mounted.store().favorites).toHaveLength(1);
    expect(mounted.renderedIds("favorites")).toEqual([
      SIGHTSEEING_KEPT.place.id,
    ]);
    // Skipped rather than overwritten: the entry is still the one the 観光
    // decision produced.
    expect(mounted.store().favorites[0].name).toBe(SIGHTSEEING_KEPT.title);
    expect(mounted.store().favorites[0].category).toBe("sightseeing");

    // Anti-vacuity: a different place on the same deck does get added, so the
    // single entry above is de-duplication and not a store that stopped
    // accepting writes after the first one.
    await mounted.decide(true); // 食事: 別の place.id
    expect(mounted.renderedIds("favorites")).toEqual([
      SIGHTSEEING_KEPT.place.id,
      FOOD_NEW_PLACE.place.id,
    ]);
    expect(mounted.store().favorites[1].category).toBe("food");
  });

  // Validates: Requirements 2.5
  //
  // お気に入り and the route are separate lists once a place is in both. Dropping
  // a stop from the itinerary is a scheduling decision — it does not mean the
  // traveller lost interest in the place — so the entry has to survive it.
  // Wiring the removal through to `removeFavorite` would silently discard
  // something the user never asked to discard.
  it("最終画面でルートから削除しても favorites に残る", async () => {
    const mounted = mountRouteBuilder();
    await mounted.deckReady();

    await mounted.decide(true);
    await mounted.decide(false);
    await mounted.advanceToFinal();

    // The stop is in both lists before the removal.
    expect(mounted.routeTitles()).toEqual([SIGHTSEEING_KEPT.title]);
    expect(mounted.renderedIds("favorites")).toEqual([
      SIGHTSEEING_KEPT.place.id,
    ]);

    await userEvent.click(
      screen.getByRole("button", {
        name: `${label("routeBuilder.remove")} ${SIGHTSEEING_KEPT.title}`,
      }),
    );

    // Anti-vacuity: the removal landed — the route is empty and the screen says
    // so — so what follows is a surviving お気に入り and not an unchanged screen.
    expect(mounted.routeTitles()).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      label("routeBuilder.emptyRoute"),
    );

    expect(mounted.store().favorites).toHaveLength(1);
    expect(mounted.renderedIds("favorites")).toEqual([
      SIGHTSEEING_KEPT.place.id,
    ]);
    expect(mounted.store().favorites[0].name).toBe(SIGHTSEEING_KEPT.title);
  });
});

// ---------------------------------------------------------------------------
// しおりへの統合
// ---------------------------------------------------------------------------

/**
 * The hand-off at the end of the builder: 「このルートで旅を始める」 has to leave
 * the finished itinerary somewhere the しおり画面 can read it, and hand the same
 * itinerary to the app as the Active_Plan.
 *
 * This is the seam the feature exists for. Everything the traveller does in this
 * screen is throw-away state until this button is pressed; if the write is
 * missing, mis-ordered, or lands after `onComplete` has already unmounted the
 * screen, the itinerary they just built is gone and they start the しおり from
 * scratch — the exact rebuild the change was meant to remove.
 *
 * **Validates: Requirements 4.1, 4.2, 4.4, 4.10**
 */
describe("TourismRouteBuilder — しおりへの統合", () => {
  /**
   * The conversion's kind → category rule, restated.
   *
   * Written out here rather than imported: checking the screen's output against
   * the same table the conversion reads would agree with any table at all. Note
   * both `cafe` and `food` land on `food`, and `custom` on `sightseeing` — the
   * two collapsing cases are the ones worth stating from the outside.
   */
  const EXPECTED_CATEGORY: Record<RouteCandidateKind, Spot["category"]> = {
    sightseeing: "sightseeing",
    food: "food",
    cafe: "food",
    custom: "sightseeing",
  };

  /** Every candidate the fake port can hand out, keyed by its display title. */
  const BY_TITLE = new Map(
    Object.values(CANDIDATES_BY_KIND)
      .flat()
      .map((item) => [item.title, item] as const),
  );

  /**
   * What しおり entries are expected for a route, given the stop names the
   * preview is showing.
   *
   * Route order is read off the screen instead of predicted. The builder inserts
   * a 食事 / カフェ stop at whichever position adds the least detour, and the
   * final plan may reorder again — a hard-coded sequence here would be this test
   * re-deriving that heuristic, and would start failing on a change to the
   * insertion cost that has nothing to do with the しおり. Reading the preview
   * keeps the claim as "しおり matches the route the user confirmed".
   */
  function expectedEntries(
    titles: string[],
  ): { id: string; name: string; category: Spot["category"] }[] {
    return titles.map((title) => {
      const found = BY_TITLE.get(title);
      if (!found) throw new Error(`ルートに未知の立寄先: ${title}`);
      return {
        id: found.place.id,
        name: found.title,
        category: EXPECTED_CATEGORY[found.kind],
      };
    });
  }

  /** The しおり entries as the store holds them, projected for comparison. */
  function shioriEntries(
    mounted: MountedBuilder,
  ): { id: string; name: string; category: Spot["category"] }[] {
    return mounted.store().shiori.map((spot) => ({
      id: spot.id,
      name: spot.name,
      category: spot.category,
    }));
  }

  /**
   * Drive the builder to the final screen with three stops of three different
   * kinds, then return the confirmed route order.
   *
   * Three stops rather than one because order is half of what is being tested,
   * and mixed kinds because a route of one kind could not distinguish "route
   * order" from "the order candidates arrived in". The 食事 deck's first card
   * shares a `place.id` with the 観光 stop already kept, so it is skipped here —
   * keeping it would be a no-op on the route and add nothing.
   */
  async function buildThreeStopRoute(mounted: MountedBuilder): Promise<string[]> {
    await mounted.deckReady();
    await mounted.decide(true); // 観光: 松山城の天守
    await mounted.decide(false); // 観光: 萬翠荘 → 見送り

    await mounted.press("routeBuilder.next");
    await mounted.press("routeBuilder.findFood");
    await mounted.deckReady();
    await mounted.decide(false); // 食事: 同一 place.id は見送り
    await mounted.decide(true); // 食事: 五色そうめんの店

    await mounted.press("routeBuilder.next");
    await mounted.press("routeBuilder.findCafe");
    await mounted.deckReady();
    await mounted.decide(true); // カフェ: 城下の喫茶室

    await mounted.press("routeBuilder.next");
    await mounted.press("routeBuilder.skip"); // 自由入力を飛ばして最終画面へ
    await mounted.planSettled();

    return mounted.routeTitles();
  }

  // Validates: Requirements 4.1, 4.2
  //
  // The whole hand-off in one claim. Order matters as much as membership: a
  // しおり holding the right places in the wrong sequence is a different day out
  // than the one the traveller just arranged, and they would have to reorder it
  // by hand to get back what they already had.
  //
  // The write also has to happen before `onComplete`, which in the real app
  // unmounts this screen — an effect-based or post-callback write would drop
  // everything. Nothing here has to say that explicitly: the entries simply
  // would not be there.
  it("「このルートで旅を始める」で shiori がルート順で埋まる", async () => {
    const mounted = mountRouteBuilder();
    const routeTitles = await buildThreeStopRoute(mounted);

    // Anti-vacuity: the route really is the three-stop mix this test set up, so
    // the sequence compared below is a non-trivial order.
    expect(routeTitles).toHaveLength(3);
    expect(routeTitles).toEqual(
      expect.arrayContaining([
        SIGHTSEEING_KEPT.title,
        FOOD_NEW_PLACE.title,
        CAFE_CANDIDATE.title,
      ]),
    );
    // Nothing is in the しおり until the button is pressed — the builder's own
    // state is not a しおり.
    expect(mounted.store().shiori).toEqual([]);

    await mounted.press("routeBuilder.complete");

    // AC 4.2: same order as the confirmed route. AC 4.1: each entry converted by
    // the Requirement 1 rules — `name` from the candidate title (not the Google
    // place name, which differs in the fixtures) and `category` from the kind.
    expect(shioriEntries(mounted)).toEqual(expectedEntries(routeTitles));
    // Rendered too, so a しおり consumer under the same provider sees the list.
    expect(mounted.renderedIds("shiori")).toEqual(
      expectedEntries(routeTitles).map((entry) => entry.id),
    );
  });

  // Validates: Requirements 4.4
  //
  // The しおり is one list the traveller owns across sessions, not a view of the
  // last route they built. Starting a second trip must not overwrite what is
  // already planned — an implementation that assigned the converted route rather
  // than appending would quietly delete the earlier itinerary, and the traveller
  // would have no way to notice until they went looking for it.
  it("既存のしおりがある状態で開始すると既存が先頭に残り新規が末尾に付く", async () => {
    const mounted = mountRouteBuilder();
    // Seeded through the store the way a restored session or the しおり画面 would
    // have added it. `onsen` is a category the conversion never produces, so this
    // entry is unmistakably not from the route below.
    const seeded: Spot = {
      id: "place-dogo-onsen",
      name: "道後温泉本館",
      category: "onsen",
      location: { lat: 33.8511, lng: 132.7866 },
      localizedDescriptions: { [LANG]: "前の旅でしおりに入れた場所。" },
      reviews: [],
      imageUrls: [],
    };
    await mounted.run((store) => store.addToShiori(seeded));
    expect(mounted.renderedIds("shiori")).toEqual([seeded.id]);

    const routeTitles = await buildThreeStopRoute(mounted);

    await mounted.press("routeBuilder.complete");

    // The existing entry keeps its place at the front, unmodified, and the route
    // follows it in route order.
    expect(shioriEntries(mounted)).toEqual([
      { id: seeded.id, name: seeded.name, category: seeded.category },
      ...expectedEntries(routeTitles),
    ]);
    expect(mounted.store().shiori[0]).toEqual(seeded);
  });

  // Validates: Requirements 4.10
  //
  // The しおり write is an addition, not a replacement for the existing
  // transition. `onComplete` is what makes the confirmed route the Active_Plan
  // and lands the app on the map tab; a change that wrote to the store and
  // stopped there would leave the traveller on this screen with a filled しおり
  // and no way forward.
  //
  // `stops` is the part worth pinning down — the plan is what the map draws, so
  // an itinerary handed over without located stops is an empty map.
  it("onComplete が stops 付きのプランで呼ばれる", async () => {
    const mounted = mountRouteBuilder();
    const routeTitles = await buildThreeStopRoute(mounted);

    // Anti-vacuity: the final plan really came back from the port, so the times
    // asserted below are the generated ones and not the screen's local fallback.
    expect(mounted.chat.planRequests).toHaveLength(1);
    expect(
      mounted.chat.planRequests[0].selectedStops.map((stop) => stop.title),
    ).toEqual(routeTitles);
    expect(mounted.onComplete).not.toHaveBeenCalled();

    await mounted.press("routeBuilder.complete");

    expect(mounted.onComplete).toHaveBeenCalledTimes(1);
    const plan = mounted.onComplete.mock.calls[0][0] as RecommendedPlan;
    expect(plan.mode).toBe("tourism");
    expect(plan.area).toEqual(AREA);
    // Distinguished from the theme it grew out of, so the plan selector does not
    // show the confirmed route under the generic theme name.
    expect(plan.title).toBe(`${THEME.title} — ${label("routeBuilder.myRoute")}`);

    // Same stops, same order as the route — and as the しおり, since both derive
    // from `route` at the same moment.
    expect(plan.stops.map((stop) => stop.title)).toEqual(routeTitles);
    expect(plan.stops.map((stop) => stop.time)).toEqual(
      PLAN_TIMES.slice(0, routeTitles.length),
    );
    plan.stops.forEach((stop, position) => {
      const source = BY_TITLE.get(routeTitles[position]);
      if (!source) throw new Error(`ルートに未知の立寄先: ${routeTitles[position]}`);
      expect(stop.kind).toBe(source.kind);
      expect(stop.description).toBe(source.description);
      expect(stop.searchQuery).toBe(source.searchQuery);
      // The located place travels with the stop: the map has coordinates to draw.
      expect(stop.place).toEqual(source.place);
    });
  });
});
