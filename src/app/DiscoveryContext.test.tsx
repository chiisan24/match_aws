/**
 * Tests for the {@link DiscoveryProvider} persistence seam.
 *
 * The store keeps two things behind an injected `StoragePort` — the decided-spot
 * record (Seen_Record) and the Places photo cache (Photo_Cache) — under one key
 * and one hydrate/save pair each. Two claims justify that structure, and this
 * file pins both down:
 *
 *  - **The round trip is lossless** (AC 12.12). Not just "the same bytes come
 *    back": what the user actually sees is the achievement rate and the badge
 *    grid, so the restored record is fed back through `discoveryProgress` and
 *    compared with the rate it produced before the reload (AC 10.8). And the
 *    photo cache is what keeps a billed Places lookup from happening twice, so a
 *    restored cache has to still answer `hasPhoto` (AC 7.3).
 *  - **The two keys are independent** (AC 10.7). One key rejecting its write must
 *    not stop the other from being saved. That is the promise a shared effect
 *    would break silently — a user whose progress quietly stopped being recorded
 *    because the photo cache outgrew the storage quota.
 *
 * The hostile cases follow: a `load` that throws or hands back the wrong shape
 * leaves an empty record and a working screen (AC 10.4, 7.9), nothing is written
 * before the initial load settles (AC 10.3, 7.6), and with no port injected the
 * store stays in memory and never calls out (AC 10.6).
 *
 * The `MockStorageAdapter` the app ships is used for the round trips, so JSON
 * encoding sits in the path — a `Set` is not serialisable, and the array
 * conversion either side of it is exactly the part that could lose content.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import { MockStorageAdapter } from "../adapters/mock/storage";
import { discoveryProgress } from "../domain/discovery";
import type { PhotoCache } from "../domain/photoCache";
import type { OfflineEntry, Spot, StorageKey } from "../domain/types";
import type { StoragePort } from "../ports";
import {
  DiscoveryProvider,
  useDiscovery,
  type DiscoveryContextValue,
} from "./DiscoveryContext";

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** The two keys the discovery store owns (AC 10.9). */
const SEEN_KEY: StorageKey = "discoverySeen";
const PHOTOS_KEY: StorageKey = "discoveryPhotos";

/**
 * Keys that belong to other stores. AC 10.1 requires the record's key to differ
 * from all of them, which is stated here rather than by reading the constant
 * back: the point is that no *other* store's data is overwritten.
 */
const FOREIGN_KEYS: StorageKey[] = ["favorites", "shiori", "savedItinerary"];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function spot(
  id: string,
  name: string,
  category: Spot["category"],
  lat: number,
  lng: number,
): Spot {
  return {
    id,
    name,
    category,
    location: { lat, lng },
    localizedDescriptions: { ja: `${name}の説明` },
    reviews: [],
    imageUrls: [],
  };
}

/**
 * A catalogue spread across all three regions and three categories, so the
 * badge state restored below is a non-trivial value: several groups, only some
 * of them complete. A single-area catalogue would make AC 10.8 pass for a store
 * that dropped everything but the count.
 */
const CATALOGUE: Spot[] = [
  spot("s-touyo-1", "今治城", "sightseeing", 34.066, 132.998),
  spot("s-touyo-2", "来島海峡", "sightseeing", 34.11, 133.0),
  spot("s-chuuyo-1", "道後温泉本館", "onsen", 33.851, 132.786),
  spot("s-chuuyo-2", "砥部焼", "souvenir", 33.749, 132.79),
  spot("s-nanyo-1", "宇和島城", "sightseeing", 33.219, 132.564),
];

/** Ids decided before the "reload": one whole group plus part of another. */
const DECIDED: string[] = ["s-touyo-1", "s-touyo-2", "s-chuuyo-1"];

const PHOTO_ENTRIES: PhotoCache = [
  {
    id: "s-touyo-1",
    photoUrl: "/api/places/photo?name=places/aaa/photos/bbb",
    attributions: [{ displayName: "撮影者 A", uri: "https://example.test/a" }],
  },
  {
    id: "s-chuuyo-1",
    photoUrl: "/api/places/photo?name=places/ccc/photos/ddd",
    attributions: [{ displayName: "Photographer B" }],
  },
];

// ---------------------------------------------------------------------------
// Fake StoragePort
// ---------------------------------------------------------------------------

/** How a fake `load` answers one key. */
type LoadBehaviour =
  /** Resolves with `value` — the interesting values are the malformed ones. */
  | { readonly kind: "value"; readonly value: unknown }
  /** Rejects, the way an adapter with a failing backend does. */
  | { readonly kind: "reject" }
  /**
   * Throws synchronously, before any promise exists. Kept apart from `reject`
   * because the throw escapes on a different path — during the call itself
   * rather than at the `await` — so only a `try` around the call catches it.
   */
  | { readonly kind: "throw" }
  /**
   * Hands back a promise the test settles by hand. The pre-hydration guard is
   * only observable while a load is in flight; once it settles there is no
   * window left to look at.
   */
  | { readonly kind: "pending"; readonly promise: Promise<unknown> };

/** One recorded `save`, so a test can check which key got what. */
interface SaveCall {
  readonly key: StorageKey;
  readonly value: unknown;
}

/** A `StoragePort` with scripted per-key answers that records what it was asked. */
interface FakeStorage extends StoragePort {
  readonly saves: SaveCall[];
  readonly loadedKeys: StorageKey[];
}

/**
 * Build a port whose answers are functions of the key.
 *
 * Per-key rather than per-port because AC 10.7 is a claim about the two keys
 * being independent, and that can only be stated against a port that treats
 * them differently.
 */
function createFakeStorage(behaviour: {
  readonly load: (key: StorageKey) => LoadBehaviour;
  readonly save: (key: StorageKey) => "resolve" | "reject";
}): FakeStorage {
  const saves: SaveCall[] = [];
  const loadedKeys: StorageKey[] = [];
  return {
    saves,
    loadedKeys,
    load<T>(key: StorageKey): Promise<T | null> {
      loadedKeys.push(key);
      const answer = behaviour.load(key);
      if (answer.kind === "throw") throw new Error(`load("${key}") threw`);
      if (answer.kind === "reject") {
        return Promise.reject(new Error(`load("${key}") rejected`));
      }
      if (answer.kind === "pending") return answer.promise as Promise<T | null>;
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

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------

/** Renders the record so assertions can see React actually re-rendered. */
function StoreProbe({
  store,
}: {
  store: { current: DiscoveryContextValue | null };
}): JSX.Element {
  const discovery = useDiscovery();
  // Safe here: this probe is the only consumer and nothing runs under StrictMode.
  store.current = discovery;
  return (
    <ul data-testid="seen">
      {[...discovery.seen].map((id) => (
        <li key={id}>{id}</li>
      ))}
    </ul>
  );
}

interface MountedStore {
  readonly store: () => DiscoveryContextValue;
  /** Ids as the probe rendered them. */
  readonly renderedSeen: () => string[];
  /** Run store actions inside `act` so React flushes effects first. */
  readonly run: (action: (store: DiscoveryContextValue) => void) => Promise<void>;
}

/** Mount over `storage`, or with no port at all when omitted (AC 10.6). */
function mountStore(storage?: StoragePort): MountedStore {
  const ref: { current: DiscoveryContextValue | null } = { current: null };
  const { container } = render(
    <DiscoveryProvider storage={storage}>
      <StoreProbe store={ref} />
    </DiscoveryProvider>,
  );
  const store = (): DiscoveryContextValue => {
    if (ref.current === null) throw new Error("StoreProbe did not render");
    return ref.current;
  };
  return {
    store,
    renderedSeen: () =>
      Array.from(container.querySelectorAll('[data-testid="seen"] li')).map(
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
 * Let the mount effects run to completion.
 *
 * Hydration is not observable from outside — the guard is a ref, and a load that
 * fails leaves the rendered output unchanged, so there is nothing to poll for.
 * Crossing one macrotask boundary settles it regardless: the fakes resolve
 * through promises only, and a microtask chain always drains before the next
 * macrotask.
 */
async function settleEffects(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

/** The value of the most recent `save` for `key`, or `undefined` if never written. */
function lastSaveFor(storage: FakeStorage, key: StorageKey): unknown {
  const forKey = storage.saves.filter((call) => call.key === key);
  return forKey.length === 0 ? undefined : forKey[forKey.length - 1].value;
}

beforeEach(() => {
  // MockStorageAdapter shares jsdom's `localStorage` across instances, so every
  // test has to start from nothing stored.
  globalThis.localStorage?.clear();
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Round trip
// ---------------------------------------------------------------------------

describe("DiscoveryProvider persistence round trip", () => {
  // Validates: Requirements 10.1, 10.2, 10.8, 10.9, 12.12
  //
  // The claim the whole feature rests on: decide some spots, reload, and the
  // achievement rate and badge state are the ones the user left behind. Stated
  // through `discoveryProgress` rather than over the id set, because the rate
  // and the badges are what is on screen — an id set that came back reordered or
  // as an array would pass a set comparison and still be the bug.
  it("Seen_Record を保存し次回マウントで達成率とバッジごと復元する (AC 10.8, 12.12)", async () => {
    const storage = new MockStorageAdapter();

    const first = mountStore(storage);
    await settleEffects();
    // Nothing stored yet, so this starts from an empty record.
    expect(first.store().seen.size).toBe(0);

    await first.run((store) => {
      for (const id of DECIDED) store.recordDecision(id);
    });
    await settleEffects();

    const before = discoveryProgress(CATALOGUE, first.store().seen);
    // Anti-vacuity: the fixture really does produce a partial, non-zero state,
    // so the comparison below is over something a broken restore could get wrong.
    expect(before.seen).toBe(DECIDED.length);
    expect(before.percent).toBe(60);
    expect(before.areaBadges.some((badge) => badge.earned)).toBe(true);
    expect(before.areaBadges.some((badge) => !badge.earned)).toBe(true);

    // The written value is a plain array of ids — a Set does not survive JSON,
    // and this is the conversion that would silently persist `{}`.
    expect(await storage.load<string[]>(SEEN_KEY)).toEqual(
      expect.arrayContaining(DECIDED),
    );
    expect((await storage.load<string[]>(SEEN_KEY))?.length).toBe(DECIDED.length);

    // AC 10.1: no other store's key was touched.
    for (const key of FOREIGN_KEYS) {
      expect(await storage.load<unknown>(key)).toBeNull();
    }

    cleanup();

    // The reload: a fresh provider over the same backend.
    const second = mountStore(storage);
    await settleEffects();

    const after = discoveryProgress(CATALOGUE, second.store().seen);
    expect(after).toEqual(before);
    // And the restore reached React, so the screen would render it.
    expect(second.renderedSeen().sort()).toEqual([...DECIDED].sort());
    // Deck position is session state, not progress — a reload starts at the top.
    expect(second.store().deckPosition).toBe(0);
  });

  // Validates: Requirements 7.3, 7.4, 7.5, 12.12
  //
  // The photo cache is the gate in front of a billed API. Persisting it is only
  // worth anything if `hasPhoto` still answers `true` after a reload — that is
  // the call site that decides whether Google gets asked again.
  it("Photo_Cache を保存し次回マウントで参照可能な状態で復元する (AC 7.3, 12.12)", async () => {
    const storage = new MockStorageAdapter();

    const first = mountStore(storage);
    await settleEffects();
    await first.run((store) => {
      for (const entry of PHOTO_ENTRIES) store.cachePhoto(entry);
    });
    await settleEffects();

    expect(await storage.load<PhotoCache>(PHOTOS_KEY)).toStrictEqual(PHOTO_ENTRIES);

    cleanup();

    const second = mountStore(storage);
    await settleEffects();

    for (const entry of PHOTO_ENTRIES) {
      // The gate on the paid call is closed again.
      expect(second.store().hasPhoto(entry.id)).toBe(true);
      // And the URL plus its required credits came back intact, so the card can
      // render the photo *and* the attribution Google's terms require.
      expect(second.store().cachedPhoto(entry.id)).toStrictEqual(entry);
    }
    // A spot never looked up is still unknown — the restore did not invent hits.
    expect(second.store().hasPhoto("s-nanyo-1")).toBe(false);
    expect(second.store().cachedPhoto("s-nanyo-1")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Independence
// ---------------------------------------------------------------------------

describe("DiscoveryProvider key independence", () => {
  // Validates: Requirements 10.7
  //
  // One rejecting write must not take the other key down with it. This is what
  // the separate hydration guards and separate effect pairs buy, and it is the
  // property a shared effect would break invisibly.
  //
  // Run in both directions so neither key is assumed to be the safe one.
  it.each<[StorageKey, StorageKey]>([
    [SEEN_KEY, PHOTOS_KEY],
    [PHOTOS_KEY, SEEN_KEY],
  ])(
    "%s の保存が失敗しても %s の保存を妨げない (AC 10.7)",
    async (failingKey, healthyKey) => {
      const storage = createFakeStorage({
        // `null` is what a real port answers for an absent key, keeping this
        // case about the save direction alone.
        load: () => ({ kind: "value", value: null }),
        save: (key) => (key === failingKey ? "reject" : "resolve"),
      });
      const mounted = mountStore(storage);
      await settleEffects();

      await mounted.run((store) => {
        store.recordDecision(DECIDED[0]);
        store.cachePhoto(PHOTO_ENTRIES[0]);
      });
      await settleEffects();

      // The healthy key carries what the store holds.
      expect(lastSaveFor(storage, healthyKey)).toStrictEqual(
        healthyKey === SEEN_KEY ? [DECIDED[0]] : [PHOTO_ENTRIES[0]],
      );
      // Two real writes with one refused — not one write and one no-op.
      expect(storage.saves.map((call) => call.key)).toContain(failingKey);

      // AC 10.5 / 7.10: memory stays authoritative either way.
      expect([...mounted.store().seen]).toEqual([DECIDED[0]]);
      expect(mounted.store().hasPhoto(PHOTO_ENTRIES[0].id)).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Hostile ports
// ---------------------------------------------------------------------------

describe("DiscoveryProvider under a failing StoragePort", () => {
  // Validates: Requirements 7.9, 10.4, 10.5
  //
  // Storage is untrusted. A load that throws, rejects, or hands back the wrong
  // shape has to leave an empty record and a store that still takes the next
  // decision — the alternative is a corrupted `localStorage` entry making the
  // 発見 tab unusable with no way for the user to clear it.
  it.each<[string, LoadBehaviour]>([
    ["throws synchronously", { kind: "throw" }],
    ["rejects", { kind: "reject" }],
    ["returns null", { kind: "value", value: null }],
    ["returns an object", { kind: "value", value: { a: 1 } }],
    ["returns a string", { kind: "value", value: "not-an-array" }],
    ["returns a number", { kind: "value", value: 42 }],
    ["returns junk entries", { kind: "value", value: [1, null, {}, false] }],
  ])("load が %s でも空の記録で動作を続ける (AC 10.4, 7.9)", async (_name, answer) => {
    const storage = createFakeStorage({
      load: () => answer,
      save: () => "resolve",
    });
    const mounted = mountStore(storage);
    await settleEffects();

    // Anti-vacuity: both keys really were consulted, so this is a rejected load
    // rather than a provider that skipped persistence entirely.
    expect(storage.loadedKeys).toContain(SEEN_KEY);
    expect(storage.loadedKeys).toContain(PHOTOS_KEY);

    // Nothing the broken load produced was adopted.
    expect(mounted.store().seen.size).toBe(0);
    expect(mounted.store().cachedPhoto(PHOTO_ENTRIES[0].id)).toBeUndefined();
    expect(discoveryProgress(CATALOGUE, mounted.store().seen).percent).toBe(0);

    // AC 10.5: the screen is still operable.
    await mounted.run((store) => store.recordDecision(DECIDED[0]));
    expect([...mounted.store().seen]).toEqual([DECIDED[0]]);
    expect(mounted.renderedSeen()).toEqual([DECIDED[0]]);
  });

  // Validates: Requirements 7.6, 10.3
  //
  // The guard that makes restoring safe at all. Saving is driven by the record
  // changing, and the record starts empty, so a provider that wrote before its
  // load settled would overwrite stored progress with `[]` on every launch — and
  // the round trip above would then depend on which effect finished first.
  //
  // A settled load leaves no window to observe, so this one is held open by hand.
  it("初回復元が完了するまで保存しない (AC 10.3, 7.6)", async () => {
    let releaseSeen!: (value: unknown) => void;
    const pendingSeen = new Promise<unknown>((resolve) => {
      releaseSeen = resolve;
    });
    const storage = createFakeStorage({
      load: (key) =>
        key === SEEN_KEY
          ? { kind: "pending", promise: pendingSeen }
          : { kind: "value", value: null },
      save: () => "resolve",
    });
    const mounted = mountStore(storage);
    await settleEffects();

    // Anti-vacuity: the load was issued, so what follows is a load in flight.
    expect(storage.loadedKeys).toContain(SEEN_KEY);
    expect(storage.saves.filter((call) => call.key === SEEN_KEY)).toEqual([]);

    // A decision arriving mid-load is held in memory — the screen stays usable —
    // but must not reach the port, or the stored record would be replaced by
    // this partial one.
    await mounted.run((store) => store.recordDecision(DECIDED[0]));
    await settleEffects();
    expect([...mounted.store().seen]).toEqual([DECIDED[0]]);
    expect(storage.saves.filter((call) => call.key === SEEN_KEY)).toEqual([]);

    // Once the load settles the stored record is adopted, and only then does the
    // key start being written.
    await act(async () => {
      releaseSeen(["s-nanyo-1"]);
      await pendingSeen;
    });
    await settleEffects();
    expect([...mounted.store().seen]).toEqual(["s-nanyo-1"]);

    await mounted.run((store) => store.recordDecision(DECIDED[0]));
    await settleEffects();
    expect(lastSaveFor(storage, SEEN_KEY)).toEqual(
      expect.arrayContaining(["s-nanyo-1", DECIDED[0]]),
    );
  });
});

// ---------------------------------------------------------------------------
// No port injected
// ---------------------------------------------------------------------------

describe("DiscoveryProvider without a StoragePort", () => {
  // Validates: Requirements 10.6
  //
  // The prop is optional, so this is exactly what the app does with no backend
  // configured: the game still works, it just does not outlive the tab.
  it("ポート未注入でもメモリ上で記録とキャッシュを保持する (AC 10.6)", async () => {
    const mounted = mountStore();
    await settleEffects();

    await mounted.run((store) => {
      for (const id of DECIDED) store.recordDecision(id);
      store.cachePhoto(PHOTO_ENTRIES[0]);
    });

    expect(discoveryProgress(CATALOGUE, mounted.store().seen).percent).toBe(60);
    expect(mounted.store().hasPhoto(PHOTO_ENTRIES[0].id)).toBe(true);
    expect(mounted.renderedSeen().sort()).toEqual([...DECIDED].sort());

    // Nothing leaked into the shared localStorage the MockStorageAdapter uses.
    expect(await new MockStorageAdapter().load<unknown>(SEEN_KEY)).toBeNull();
    expect(await new MockStorageAdapter().load<unknown>(PHOTOS_KEY)).toBeNull();
  });

  // Validates: Requirements 4.12, 5.3, 5.4
  //
  // Re-deciding a spot already in the record must not double-count it, or the
  // achievement rate would climb past 100 on a second pass — and 「もう一度見る」
  // restarts the deck without clearing anything.
  it("再判定は記録を増やさず、もう一度見るは記録を消さない (AC 4.12, 5.3, 5.4)", async () => {
    const mounted = mountStore();
    await settleEffects();

    await mounted.run((store) => {
      for (const id of DECIDED) store.recordDecision(id);
    });
    const afterFirstPass = mounted.store().seen;
    expect(mounted.store().deckPosition).toBe(DECIDED.length);

    await mounted.run((store) => store.restartDeck());
    expect(mounted.store().deckPosition).toBe(0);
    // Same record, and the same object — the restart did not rebuild the set,
    // so nothing downstream re-renders or re-sorts on a replay.
    expect(mounted.store().seen).toBe(afterFirstPass);

    await mounted.run((store) => store.recordDecision(DECIDED[0]));
    expect(mounted.store().seen.size).toBe(DECIDED.length);
    expect(discoveryProgress(CATALOGUE, mounted.store().seen).percent).toBe(60);
    // The deck still advanced, so a second pass moves normally.
    expect(mounted.store().deckPosition).toBe(1);
  });
});
