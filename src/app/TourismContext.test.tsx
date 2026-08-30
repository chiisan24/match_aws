/**
 * Tests for the {@link TourismProvider} persistence seam.
 *
 * The store keeps お気に入り and しおり behind an injected `StoragePort`, one
 * hydrate/save effect pair per key. This file starts at the port itself:
 * everything the provider promises about persisted collections rests on the
 * round trip being lossless, so that is fixed first — against the
 * {@link MockStorageAdapter} the app actually ships, not a stand-in.
 *
 * The second half turns the port hostile. Persistence is a convenience, never
 * the source of truth, so a `load` that throws or hands back something that is
 * not a list, and a `save` that refuses, both have to leave the user's lists
 * exactly as the app built them (Req 3.4, 3.5) — and one key failing must not
 * take the other key's write down with it (Req 3.8). Those cases mount the
 * provider, which is why the extension is `.tsx`.
 *
 * The last section is example-based, for the claims a property would state
 * awkwardly or not at all: a saved お気に入り list comes back on the next mount
 * (Req 3.2), nothing is written until that load settles (Req 3.3), the store
 * still works with no port injected (Req 3.6), and adding an empty list to the
 * しおり leaves the state reference untouched (Req 4.9).
 *
 * Shared fixtures (`textArb`, `locationArb`, `spotArb`, `PERSISTED_KEYS`,
 * `roundTrip`) sit at the top of the file so every property draws from the same
 * input space.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import fc from "fast-check";

import { MockStorageAdapter } from "../adapters/mock/storage";
import type {
  GeoPoint,
  OfflineEntry,
  Review,
  Spot,
  StorageKey,
} from "../domain/types";
import type { StoragePort } from "../ports";
import {
  TourismProvider,
  useTourism,
  type TourismContextValue,
} from "./TourismContext";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * The two collection keys the store persists: お気に入り (Req 3.1, 3.2) and
 * しおり (Req 4.6). Both hold `Spot[]`, so the round trip is one claim
 * parameterised over the key rather than two near-identical tests.
 */
const PERSISTED_KEYS: StorageKey[] = ["favorites", "shiori"];

const SPOT_CATEGORIES: Spot["category"][] = [
  "sightseeing",
  "food",
  "souvenir",
  "onsen",
];

/**
 * Human-facing text as the collections actually carry it. The Japanese and
 * mixed-script constants are drawn deliberately: JSON escaping is the part of
 * this round trip most likely to mangle content, and `fc.string()` alone stays
 * inside printable ASCII where nothing needs escaping.
 */
const textArb: fc.Arbitrary<string> = fc.oneof(
  fc.string(),
  fc.fullUnicodeString(),
  fc.constantFrom(
    "道後温泉本館",
    "内子座",
    "しまなみ海道 — Bakan",
    'quote " and \\ backslash',
  ),
);

/**
 * A coordinate. `-0` is folded to `0` because JSON has no signed zero: a stored
 * `-0` reads back as `0`, and the comparison below would fail over a
 * distinction that means nothing here (both are the equator / prime meridian)
 * and that no caller can observe. Every other finite double survives
 * `JSON.stringify` exactly, so nothing else needs constraining.
 */
const locationArb: fc.Arbitrary<GeoPoint> = fc
  .record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true }),
  })
  .map(({ lat, lng }) => ({
    lat: lat === 0 ? 0 : lat,
    lng: lng === 0 ? 0 : lng,
  }));

const reviewArb: fc.Arbitrary<Review> = fc.record({
  author: textArb,
  rating: fc.integer({ min: 1, max: 5 }),
  text: textArb,
});

/**
 * A `Spot` as お気に入り / しおり hold them — the seven required fields plus the
 * three optional ones.
 *
 * Defined here rather than shared with `domain/routeCandidate.test.ts` so
 * neither file's input space moves silently with the other's.
 *
 * The optional fields are drawn as **present or absent**, never as a key holding
 * `undefined`, which is how `spotFromRouteCandidate` builds a spot (one
 * conditional spread per optional field). That matters for this file
 * specifically: JSON cannot represent an explicit `undefined`, so a generated
 * `{ website: undefined }` would come back with the key gone and fail the
 * comparison for a reason that has nothing to do with persistence.
 */
const spotArb: fc.Arbitrary<Spot> = fc.record(
  {
    id: fc.string({ minLength: 1 }).map((suffix) => `spot-${suffix}`),
    name: textArb,
    category: fc.constantFrom(...SPOT_CATEGORIES),
    location: locationArb,
    localizedDescriptions: fc.record(
      { ja: textArb, en: textArb, iyo: textArb },
      { requiredKeys: [] },
    ),
    reviews: fc.array(reviewArb, { maxLength: 3 }),
    imageUrls: fc.array(fc.webUrl(), { maxLength: 2 }),
    popularityRank: fc.integer({ min: 1, max: 100 }),
    openingHours: fc.constantFrom("9:00–17:00", "月: 9:00–17:00 / 火: 定休"),
    website: fc.webUrl(),
  },
  {
    requiredKeys: [
      "id",
      "name",
      "category",
      "location",
      "localizedDescriptions",
      "reviews",
      "imageUrls",
    ],
  },
);

/**
 * Save a collection and read it back through the same port.
 *
 * The `Array.isArray` narrowing mirrors the provider's own hydration guard: it
 * only adopts a loaded value when that check passes (Req 3.4), so a round trip
 * that came back as anything else would never reach the state and asserting
 * over it would prove nothing. Narrowing here rather than casting keeps the
 * check in the test.
 */
async function roundTrip(
  storage: StoragePort,
  key: StorageKey,
  spots: Spot[],
): Promise<Spot[]> {
  await storage.save<Spot[]>(key, spots);
  const loaded = await storage.load<Spot[]>(key);
  if (!Array.isArray(loaded)) {
    throw new Error(`load("${key}") returned a non-array: ${String(loaded)}`);
  }
  return loaded;
}

// ---------------------------------------------------------------------------
// StoragePort round trip
// ---------------------------------------------------------------------------

describe("StoragePort round trip", () => {
  beforeEach(() => {
    // MockStorageAdapter persists through jsdom's `localStorage` under a fixed
    // namespace, so every instance shares one backend. Clearing it keeps each
    // test starting from nothing stored.
    globalThis.localStorage?.clear();
  });

  // Feature: swipe-favorites-itinerary, Property 6: 永続化は往復で内容と順序を保つ
  // Validates: Requirements 3.1, 3.2, 3.7, 4.6
  //
  // Persistence has to be a no-op on content. The store saves a collection on
  // every change (Req 3.1, 4.6) and reads it back on the next mount (Req 3.2);
  // if either direction reshaped or reordered the list, a user who closed the
  // app would return to a しおり in a different sequence from the one they built
  // — which is exactly what AC 3.7 rules out.
  //
  // Both keys are drawn from one generator because both hold `Spot[]` and the
  // port is key-agnostic: the claim is about the port, not about either
  // collection, so parameterising states that directly.
  //
  // `fc.array` includes the empty list, which is the value the store holds
  // before anything is added — it has to survive the round trip as `[]` and not
  // as `null`, or hydration would read "nothing stored" and the guard would skip
  // the update.
  it("Feature: swipe-favorites-itinerary, Property 6: 永続化は往復で内容と順序を保つ", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(spotArb),
        fc.constantFrom(...PERSISTED_KEYS),
        async (spots, key) => {
          const storage = new MockStorageAdapter();

          const loaded = await roundTrip(storage, key, spots);

          // AC 3.7: same spots in the same positions. Stated on the id sequence
          // first — the full comparison below covers order too, but a reordering
          // regression reads as a short, legible diff here instead of a dump of
          // whole spot objects.
          expect(loaded.map((spot) => spot.id)).toEqual(
            spots.map((spot) => spot.id),
          );

          // Structural equality over every field, optional ones included.
          // `toStrictEqual` rather than `toEqual` so a round trip that turned an
          // absent `website` into `website: undefined` fails: the two are the
          // same to `toEqual`, but only the absent form matches what the
          // conversion produces, and the difference is observable through
          // `"website" in spot`.
          expect(loaded).toStrictEqual(spots);

          // Anti-vacuity: an adapter that handed back the very array it was
          // given would satisfy everything above without persisting anything.
          // The list that comes out has to be an independent copy.
          expect(loaded).not.toBe(spots);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Broken StoragePort fakes + a probe for the mounted provider
// ---------------------------------------------------------------------------

/** How a fake `load` answers one key. */
type LoadBehaviour =
  /** Resolves with `value`. The interesting values are the ones that are not arrays. */
  | { readonly kind: "value"; readonly value: unknown }
  /** Returns a rejected promise, the way an adapter with a failing backend does. */
  | { readonly kind: "reject" }
  /**
   * Throws synchronously, before any promise exists. Worth keeping apart from
   * `reject`: the throw escapes on a different path — it happens during the call
   * itself rather than at the `await` — so only a `try` that wraps the call
   * catches it. A port that parses a corrupted entry eagerly fails this way.
   */
  | { readonly kind: "throw" }
  /**
   * Hands back a promise the test settles by hand. The hydration guard (Req 3.3)
   * is only observable while a load is in flight — once it settles there is no
   * window left to look at — so that state has to be held open deliberately.
   */
  | { readonly kind: "pending"; readonly promise: Promise<unknown> };

/** How a fake `save` answers one key. */
type SaveOutcome = "resolve" | "reject";

const SAVE_OUTCOMES: SaveOutcome[] = ["resolve", "reject"];

/** One recorded `save`, so a test can check which key was written with what. */
interface SaveCall {
  readonly key: StorageKey;
  readonly value: unknown;
}

/** A `StoragePort` with scripted per-key answers that records what it was asked. */
interface FakeStorage extends StoragePort {
  /** Every `save`, in call order. */
  readonly saves: SaveCall[];
  /** Every key `load` was asked for, in call order. */
  readonly loadedKeys: StorageKey[];
}

/**
 * Build a `StoragePort` whose answers are functions of the key.
 *
 * Per-key rather than per-port on purpose: AC 3.8 is a claim about the two keys
 * being independent, and that can only be stated against a port that treats
 * them differently. The offline-queue members are inert — the provider never
 * touches them.
 */
function createFakeStorage(behaviour: {
  readonly load: (key: StorageKey) => LoadBehaviour;
  readonly save: (key: StorageKey) => SaveOutcome;
}): FakeStorage {
  const saves: SaveCall[] = [];
  const loadedKeys: StorageKey[] = [];
  return {
    saves,
    loadedKeys,
    load<T>(key: StorageKey): Promise<T | null> {
      loadedKeys.push(key);
      const answer = behaviour.load(key);
      if (answer.kind === "throw") {
        throw new Error(`load("${key}") threw`);
      }
      if (answer.kind === "reject") {
        return Promise.reject(new Error(`load("${key}") rejected`));
      }
      if (answer.kind === "pending") {
        return answer.promise as Promise<T | null>;
      }
      return Promise.resolve(answer.value as T | null);
    },
    save<T>(key: StorageKey, value: T): Promise<void> {
      saves.push({ key, value });
      return behaviour.save(key) === "reject"
        ? Promise.reject(new Error(`save("${key}") rejected`))
        : Promise.resolve();
    },
    async enqueueOffline(): Promise<void> {
      // Unused by the provider.
    },
    async flushOffline(): Promise<OfflineEntry[]> {
      return [];
    },
  };
}

/**
 * A `load` that fails in each of the three ways a port can.
 *
 * `fc.anything()` supplies the resolved-but-wrong values, filtered to exclude
 * arrays — an array is precisely the one answer the provider is supposed to
 * adopt, so leaving it in would generate inputs the property does not describe.
 * Everything else it produces (`null`, `undefined`, numbers, strings, objects)
 * is a value the hydration guard has to reject.
 */
const brokenLoadArb: fc.Arbitrary<LoadBehaviour> = fc.oneof(
  fc
    .anything()
    .filter((value) => !Array.isArray(value))
    .map((value): LoadBehaviour => ({ kind: "value", value })),
  fc.constant<LoadBehaviour>({ kind: "reject" }),
  fc.constant<LoadBehaviour>({ kind: "throw" }),
);

const saveOutcomeArb: fc.Arbitrary<SaveOutcome> = fc.constantFrom(
  ...SAVE_OUTCOMES,
);

/**
 * Two fixed spots for the mounted cases, shaped by the shared `spotArb` with a
 * pinned seed so they are the same on every run.
 *
 * The properties below vary the *port*, not the payload: what a spot looks like
 * after a round trip is Property 6's claim, and re-drawing content here would
 * only buy extra renders. Sampling rather than hand-writing keeps these two
 * inside the same input space the round trip is stated over. Only the ids are
 * overridden, so a failed assertion names the collection it came from.
 */
const [favoriteSample, shioriSample] = fc.sample(spotArb, {
  numRuns: 2,
  seed: 20250601,
});
const FAVORITE_SPOT: Spot = { ...favoriteSample, id: "spot-favorite" };
const SHIORI_SPOT: Spot = { ...shioriSample, id: "spot-shiori" };

/**
 * Renders both collections and hands the live context value to the test.
 *
 * Both halves earn their place. The rendered ids prove React actually
 * re-rendered with the new list — an assertion against the context object alone
 * would also pass if the store had mutated an array in place without telling
 * React. The handed-back value is what lets a test call the store's actions and
 * compare whole spots.
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

/** A mounted provider plus the handles a test needs to drive and read it. */
interface MountedStore {
  /** The live context value. */
  readonly store: () => TourismContextValue;
  /** Ids for one collection, as the probe rendered them. */
  readonly renderedIds: (key: "favorites" | "shiori") => string[];
  /** Run store actions inside `act` so React flushes effects before assertions. */
  readonly run: (action: (store: TourismContextValue) => void) => Promise<void>;
}

/**
 * Mount the provider over `storage`, or with no port at all when it is omitted —
 * which is the whole of the Req 3.6 case: the prop is optional on the provider,
 * so leaving it out here is exactly what the app would do without a backend.
 */
function mountStore(storage?: StoragePort): MountedStore {
  const ref: { current: TourismContextValue | null } = { current: null };
  const { container } = render(
    <TourismProvider storage={storage}>
      <StoreProbe store={ref} />
    </TourismProvider>,
  );
  const store = (): TourismContextValue => {
    if (ref.current === null) throw new Error("StoreProbe did not render");
    return ref.current;
  };
  return {
    store,
    renderedIds: (key) =>
      Array.from(container.querySelectorAll(`[data-testid="${key}"] li`)).map(
        (item) => item.textContent ?? "",
      ),
    run: async (action) => {
      await act(async () => {
        action(store());
      });
    },
  };
}

/**
 * The value carried by the most recent `save` for `key`, or `undefined` if the
 * key was never written.
 *
 * "Most recent" rather than "the only one" because the number of writes is not
 * fixed: a `load` that throws synchronously lifts that key's hydration guard
 * inside the same effect pass, so the empty initial list is written once before
 * anything is added. The design calls for exactly that — a failed load permits
 * subsequent saves — and the count is not what any property here is about.
 */
function lastSaveFor(storage: FakeStorage, key: StorageKey): unknown {
  const forKey = storage.saves.filter((call) => call.key === key);
  return forKey.length === 0 ? undefined : forKey[forKey.length - 1].value;
}

/**
 * Let the provider's mount effects run to completion.
 *
 * Hydration is not observable from outside: the guard that holds off saving
 * until the initial load settles (Req 3.3) is a ref, and a load that fails or
 * hands back a non-array leaves the rendered output unchanged — there is
 * nothing to poll for. Crossing one macrotask boundary settles it regardless.
 * The fakes above resolve through promises only, and a chain of microtasks
 * always drains completely before the next macrotask runs, so by the time this
 * returns every hydration effect has finished and the guards are up.
 */
async function settleEffects(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

// ---------------------------------------------------------------------------
// Persistence failures
// ---------------------------------------------------------------------------

describe("TourismProvider under a failing StoragePort", () => {
  // Feature: swipe-favorites-itinerary, Property 7: 永続化の失敗はメモリ上のリストを壊さない
  // Validates: Requirements 3.4, 3.5
  //
  // Persistence is a convenience, not the source of truth. A port that throws,
  // hands back something that is not a list, or refuses to write must leave the
  // user exactly where they were: the spots they just added still listed, the
  // screen still able to take the next edit (Req 3.4, 3.5). The alternative — a
  // broken localStorage emptying someone's お気に入り mid-session, or wedging the
  // screen — is the failure this pins down.
  //
  // The three load failures and the two save outcomes are drawn per key, so a
  // single property covers all 36 combinations of how the two collections'
  // persistence can break, including the mixed ones.
  it("Feature: swipe-favorites-itinerary, Property 7: 永続化の失敗はメモリ上のリストを壊さない", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          loadFavorites: brokenLoadArb,
          loadShiori: brokenLoadArb,
          saveFavorites: saveOutcomeArb,
          saveShiori: saveOutcomeArb,
        }),
        async (script) => {
          const storage = createFakeStorage({
            load: (key) =>
              key === "favorites" ? script.loadFavorites : script.loadShiori,
            save: (key) =>
              key === "favorites" ? script.saveFavorites : script.saveShiori,
          });
          const mounted = mountStore(storage);
          try {
            await settleEffects();

            // Req 3.4: nothing the broken load produced was adopted — the lists
            // are still the empty values the provider started with.
            expect(mounted.store().favorites).toEqual([]);
            expect(mounted.store().shiori).toEqual([]);

            // Anti-vacuity: the broken port really was consulted on both keys.
            // Without this the property would also hold for a provider that
            // never persisted anything at all.
            expect(storage.loadedKeys).toContain("favorites");
            expect(storage.loadedKeys).toContain("shiori");

            await mounted.run((store) => {
              store.addFavorite(FAVORITE_SPOT);
              store.addToShiori(SHIORI_SPOT);
            });
            await settleEffects();

            // Req 3.4, 3.5: memory is authoritative. Whatever the port did with
            // the write, the lists hold what the app built — and the rendered
            // output agrees, so the user sees it.
            expect(mounted.store().favorites).toStrictEqual([FAVORITE_SPOT]);
            expect(mounted.store().shiori).toStrictEqual([SHIORI_SPOT]);
            expect(mounted.renderedIds("favorites")).toEqual([
              FAVORITE_SPOT.id,
            ]);
            expect(mounted.renderedIds("shiori")).toEqual([SHIORI_SPOT.id]);

            // Anti-vacuity again: each key really was written, carrying what
            // the app now holds — so a rejecting `save` was exercised rather
            // than skipped by a guard that never lifted, and the value handed to
            // the port matches memory instead of trailing it.
            expect(lastSaveFor(storage, "favorites")).toStrictEqual([
              FAVORITE_SPOT,
            ]);
            expect(lastSaveFor(storage, "shiori")).toStrictEqual([SHIORI_SPOT]);

            // Req 3.5: the screen stays operable after a failed save. A later
            // edit still lands instead of the store wedging on the rejection.
            await mounted.run((store) =>
              store.removeFavorite(FAVORITE_SPOT.id),
            );
            expect(mounted.store().favorites).toEqual([]);
            expect(mounted.renderedIds("favorites")).toEqual([]);
          } finally {
            cleanup();
          }
        },
      ),
      // Mount-bound, so the run count is held down deliberately: the design caps
      // provider-mounting cases at one or two, and the space being covered here
      // is the port's failure mode (36 combinations), not spot content.
      { numRuns: 24 },
    );
  });

  // Feature: swipe-favorites-itinerary, Property 7: 永続化の失敗はメモリ上のリストを壊さない
  // Validates: Requirements 3.8
  //
  // The second half of Property 7: the two keys are persisted independently, so
  // one failing write must not take the other down with it (AC 3.8). This is the
  // claim the store's structure is meant to make — a separate hydration guard
  // and a separate effect pair per key — and it is the one a shared effect would
  // silently break, leaving a user whose しおり quietly stopped being saved
  // because お気に入り happened to exceed the storage quota.
  //
  // Stated over which key fails rather than fixing one, so neither direction of
  // the pairing is assumed to be the safe one.
  it("Feature: swipe-favorites-itinerary, Property 7: 永続化の失敗はメモリ上のリストを壊さない — 片方のキーの失敗が他方の保存を妨げない", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...PERSISTED_KEYS),
        async (failingKey) => {
          const healthyKey: StorageKey =
            failingKey === "favorites" ? "shiori" : "favorites";
          const expectedHealthyValue =
            healthyKey === "favorites" ? [FAVORITE_SPOT] : [SHIORI_SPOT];

          const storage = createFakeStorage({
            // Nothing stored yet: `null` is what a real port answers for an
            // absent key, which keeps this case about the save direction alone.
            load: () => ({ kind: "value", value: null }),
            save: (key) => (key === failingKey ? "reject" : "resolve"),
          });
          const mounted = mountStore(storage);
          try {
            await settleEffects();
            await mounted.run((store) => {
              store.addFavorite(FAVORITE_SPOT);
              store.addToShiori(SHIORI_SPOT);
            });
            await settleEffects();

            // AC 3.8: the healthy key was written with the content the app
            // holds. The other key's rejection neither skipped this write nor
            // corrupted what it carried.
            expect(lastSaveFor(storage, healthyKey)).toStrictEqual(
              expectedHealthyValue,
            );

            // The failing key was attempted too, so this is two real writes with
            // one of them refused — not one write and one no-op.
            expect(storage.saves.map((call) => call.key)).toContain(failingKey);

            // Req 3.5: both lists stay intact in memory either way.
            expect(mounted.store().favorites).toStrictEqual([FAVORITE_SPOT]);
            expect(mounted.store().shiori).toStrictEqual([SHIORI_SPOT]);
          } finally {
            cleanup();
          }
        },
      ),
      // Two keys, so two distinct inputs — a handful of runs covers both, and
      // each one mounts the provider.
      { numRuns: 6 },
    );
  });
});
// ---------------------------------------------------------------------------
// Hydration, the hydration guard, and the no-port / no-op cases
// ---------------------------------------------------------------------------

/** A promise plus the handle that settles it, so a test can hold a load open. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/**
 * Two spots as they would already sit in storage before the app starts.
 *
 * Two rather than one so the restore is readable off the ids alone and a
 * hydration that reversed the list fails visibly (Req 3.7 in the mounted
 * direction). Derived from {@link FAVORITE_SPOT} to stay inside the input space
 * the round trip is stated over; only the ids differ.
 */
const STORED_FAVORITES: Spot[] = [
  { ...FAVORITE_SPOT, id: "spot-stored-1" },
  { ...FAVORITE_SPOT, id: "spot-stored-2" },
];

describe("TourismProvider hydration", () => {
  beforeEach(() => {
    // MockStorageAdapter shares jsdom's `localStorage` across instances, and the
    // round-trip property above leaves entries under both keys. Clearing keeps
    // "nothing stored" meaning nothing stored.
    globalThis.localStorage?.clear();
  });

  afterEach(cleanup);

  // Validates: Requirements 3.2
  //
  // The point of persisting お気に入り at all. Req 3.1 only gets the list into
  // storage; without this it could be written on every change and still never
  // come back, leaving a user who closed the app between planning sessions with
  // an empty list and no way to tell that anything had been saved.
  //
  // Run against the {@link MockStorageAdapter} the app actually ships rather
  // than a fake, so the JSON encoding sits in the path too — this is the same
  // load the real provider performs, one write earlier.
  it("マウント時に保存済みの favorites を復元する", async () => {
    const storage = new MockStorageAdapter();
    await storage.save<Spot[]>("favorites", STORED_FAVORITES);

    const mounted = mountStore(storage);
    await settleEffects();

    // The stored list is now the live one, in the order it was saved, and the
    // probe rendered it — so the favorites screen would show it rather than the
    // empty initial value.
    expect(mounted.store().favorites).toStrictEqual(STORED_FAVORITES);
    expect(mounted.renderedIds("favorites")).toEqual(
      STORED_FAVORITES.map((spot) => spot.id),
    );

    // Nothing was stored under "shiori", and hydrating one key did not invent
    // content for the other.
    expect(mounted.store().shiori).toEqual([]);
  });

  // Validates: Requirements 3.3
  //
  // The guard that makes restoring safe. Saving is driven by the list changing,
  // and the list starts empty, so a provider that wrote before its load settled
  // would overwrite stored お気に入り with `[]` on every launch — the restore
  // above would then depend on which effect happened to finish first.
  //
  // A load that has already settled leaves no window to observe, so this one is
  // held open by hand and released mid-test.
  it("初回復元が完了するまで favorites を保存しない", async () => {
    const deferred = createDeferred<unknown>();
    const storage = createFakeStorage({
      load: (key) =>
        key === "favorites"
          ? { kind: "pending", promise: deferred.promise }
          : { kind: "value", value: null },
      save: () => "resolve",
    });
    const mounted = mountStore(storage);
    const favoriteSaves = (): SaveCall[] =>
      storage.saves.filter((call) => call.key === "favorites");

    await settleEffects();

    // Anti-vacuity: the load really was issued, so the pending state below is a
    // load in flight and not a provider that skipped persistence entirely.
    expect(storage.loadedKeys).toContain("favorites");
    expect(favoriteSaves()).toEqual([]);

    // An edit arriving while the load is in flight is held in memory — the
    // screen stays usable — but still must not reach the port, or the stored
    // list would be replaced by this partial one.
    await mounted.run((store) => store.addFavorite(FAVORITE_SPOT));
    await settleEffects();
    expect(mounted.store().favorites).toStrictEqual([FAVORITE_SPOT]);
    expect(favoriteSaves()).toEqual([]);

    await act(async () => {
      deferred.resolve(STORED_FAVORITES);
    });
    await settleEffects();

    // Anti-vacuity for the two assertions above: once the load settles the guard
    // lifts and writes flow, carrying whatever the store now holds. Stated
    // against the live list rather than a fixed value so this does not also pin
    // down how hydration and a concurrent edit combine — that is not Req 3.3's
    // claim.
    const saved = favoriteSaves();
    expect(saved).toHaveLength(1);
    expect(saved[0].value).toStrictEqual(mounted.store().favorites);
  });
});

// ---------------------------------------------------------------------------
// No StoragePort injected
// ---------------------------------------------------------------------------

describe("TourismProvider without a StoragePort", () => {
  afterEach(cleanup);

  // Validates: Requirements 3.6
  //
  // The port is optional, so every collection has to work without one: the
  // provider is mounted this way throughout the tests and could be in an
  // environment with no storage at all. The failure this rules out is a store
  // whose adds are routed through persistence — with no port, `addFavorite`
  // would silently do nothing.
  it("storage 未注入でも addFavorite が機能する", async () => {
    const mounted = mountStore();
    await settleEffects();

    await mounted.run((store) => store.addFavorite(FAVORITE_SPOT));

    // In memory only, and rendered — so the favorites screen works unchanged.
    expect(mounted.store().favorites).toStrictEqual([FAVORITE_SPOT]);
    expect(mounted.renderedIds("favorites")).toEqual([FAVORITE_SPOT.id]);
  });
});

// ---------------------------------------------------------------------------
// addSpotsToShiori — the empty route
// ---------------------------------------------------------------------------

describe("addSpotsToShiori", () => {
  afterEach(cleanup);

  // Validates: Requirements 4.9
  //
  // Starting a trip with an empty route must leave the しおり alone. Property 5
  // already fixes that `appendUniqueById` returns its input reference when there
  // is nothing new; this is the store end of it — the same reference has to reach
  // the state, because `addSpotsToShiori` is called unconditionally when the
  // route is confirmed. A rebuilt-but-equal array would satisfy "unchanged
  // contents" while still re-running the persistence effect and re-rendering
  // every しおり consumer, which is why identity is what is asserted.
  it("空配列の追加は shiori を同一参照のまま残す", async () => {
    const mounted = mountStore();
    await settleEffects();

    const emptyShiori = mounted.store().shiori;
    await mounted.run((store) => store.addSpotsToShiori([]));
    expect(mounted.store().shiori).toBe(emptyShiori);

    // Anti-vacuity: a non-empty add does move the reference, so identity above
    // is a real no-op and not a store that never updates at all.
    await mounted.run((store) => store.addSpotsToShiori([SHIORI_SPOT]));
    const filledShiori = mounted.store().shiori;
    expect(filledShiori).not.toBe(emptyShiori);
    expect(filledShiori).toStrictEqual([SHIORI_SPOT]);

    // And the no-op holds on a しおり that already has entries — the case that
    // actually occurs, since the route builder appends to whatever is there.
    await mounted.run((store) => store.addSpotsToShiori([]));
    expect(mounted.store().shiori).toBe(filledShiori);
  });
});
