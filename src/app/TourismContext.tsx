/**
 * Tourism React wiring: the {@link TourismProvider} context and {@link useTourism}
 * hook — the shared state seam for 通常観光モード.
 *
 * This store owns the three pieces of state the tourism screens read and write:
 *
 *  - **お気に入り** (`favorites`): the spots the user marked 「興味あり」 while
 *    building a route. Added de-duplicated by id, removed by id, and surfaced by
 *    the favorites screen and the map's お気に入り layer.
 *  - **しおり** (`shiori`): the single ordered itinerary list. It is appended to,
 *    removed from and reordered through the pure {@link reorder} helper, and is
 *    the one list the しおり editor, the favorites しおり tab and the map all read.
 *  - **{@link TourismContextValue.savedItineraries}**: the しおり **library** —
 *    every confirmed schedule saved from the route builder, newest first. Each
 *    can be renamed and deleted on its own, and one of them is open at a time
 *    ({@link TourismContextValue.activeItineraryId}).
 *  - **{@link TourismContextValue.activePlan}**: the recommendation picked during
 *    onboarding, which the map uses to draw the guided route.
 *
 * **Persistence** is delegated to the optional {@link StoragePort} prop. The
 * しおり (`"shiori"`), お気に入り (`"favorites"`) and the itinerary library
 * (`"savedItineraries"`) are each rehydrated once on mount and re-saved on every
 * change. Each gets its own hydration guard and its own pair of effects, so the
 * keys are persisted independently and a failure on one never blocks the others
 * (Req 3.8). The guard keeps the empty initial value from overwriting saved data
 * before the load resolves, and both directions swallow failures so the
 * in-memory state stays authoritative and the UI keeps working. With no port
 * injected the state simply lives in memory.
 *
 * The library load also **migrates** the superseded single-itinerary key: a
 * schedule saved by an older build is promoted into a one-entry library and the
 * old key is cleared, so upgrading does not look like the trip was deleted.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { reorder } from "../domain/reorder";
import { appendUniqueById } from "../domain/routeCandidate";
import {
  activeSavedItinerary,
  addSavedItinerary,
  newSavedItineraryId,
  normalizeSavedItineraries,
  removeSavedItinerary,
  renameSavedItinerary,
  savedItineraryFromPlan,
} from "../domain/savedItinerary";
import type {
  RecommendedPlan,
  SavedItinerary,
  Spot,
  StorageKey,
} from "../domain/types";
import type { StoragePort } from "../ports";

/**
 * A saved travel plan surfaced under the favorites 「プラン」 tab (Req 5.2).
 *
 * Plan sharing / saving is task 8.8's territory; for the favorites screen this
 * is just the shape the プラン tab classifies, and the live list is empty until
 * that feature lands. Kept minimal on purpose.
 */
export interface FavoritePlan {
  id: string;
  title: string;
}

/** Which favorites tab an entry is classified into (excludes the すべて view). */
export type FavoriteTabKind = "spot" | "shiori" | "plan";

/**
 * One classified favorites entry. `key` is unique across every entry (it is
 * kind-scoped) so the same spot appearing in both スポット and しおり stays two
 * distinct entries — each belonging to exactly one tab (Property 9).
 */
export interface FavoriteEntry {
  /** Stable, globally-unique key (kind-scoped) for React + membership checks. */
  key: string;
  /** The tab this entry belongs to. */
  kind: FavoriteTabKind;
  /** The underlying spot for スポット / しおり entries (undefined for plans). */
  spot?: Spot;
  /** The underlying plan for プラン entries (undefined for spots). */
  plan?: FavoritePlan;
}

/** The favorites split into すべて + each per-type tab. */
export interface FavoriteTabClassification {
  /** すべて — the union of every tab, in spot → shiori → plan order. */
  all: FavoriteEntry[];
  /** スポット — spots swiped 行きたい (favorites). */
  spot: FavoriteEntry[];
  /** しおり — spots added to the しおり. */
  shiori: FavoriteEntry[];
  /** プラン — saved plans. */
  plan: FavoriteEntry[];
}

/**
 * Classify the favorites collections into the すべて/スポット/しおり/プラン tabs
 * (Req 5.2). Pure and total.
 *
 * Each source collection maps to exactly one tab, and every entry carries a
 * single {@link FavoriteEntry.kind}; the すべて list is the concatenation of the
 * three per-type lists. This makes the classification both **exhaustive** (the
 * union equals すべて) and **exclusive** (each entry lands in exactly one tab) by
 * construction — Property 9.
 */
export function classifyFavoriteTabs(
  favorites: Spot[],
  shiori: Spot[],
  plans: FavoritePlan[],
): FavoriteTabClassification {
  const spot: FavoriteEntry[] = favorites.map((s) => ({
    key: `spot:${s.id}`,
    kind: "spot",
    spot: s,
  }));
  const shioriEntries: FavoriteEntry[] = shiori.map((s) => ({
    key: `shiori:${s.id}`,
    kind: "shiori",
    spot: s,
  }));
  const planEntries: FavoriteEntry[] = plans.map((p) => ({
    key: `plan:${p.id}`,
    kind: "plan",
    plan: p,
  }));
  return {
    all: [...spot, ...shioriEntries, ...planEntries],
    spot,
    shiori: shioriEntries,
    plan: planEntries,
  };
}

export interface TourismContextValue {
  /** Bedrock recommendation selected during onboarding, used by the map. */
  activePlan: RecommendedPlan | null;
  /** Select the itinerary that the tourism map should guide. */
  selectPlan: (plan: RecommendedPlan) => void;
  /**
   * Spots swiped right — 「行きたい」/ お気に入り (Req 4.2). The home that the
   * favorites screen (task 8.5) consumes.
   */
  favorites: Spot[];
  /**
   * Spots swiped up — added to the しおり (Req 4.4). The home that the shiori
   * screen (task 8.8) consumes.
   */
  shiori: Spot[];
  /** Add a spot to お気に入り — 右スワイプ (Req 4.2). De-duplicated by id. */
  addFavorite: (spot: Spot) => void;
  /** Remove a spot from お気に入り by id — leaves the favorites list (Req 5.3). */
  removeFavorite: (spotId: string) => void;
  /** Add a spot to the しおり — 上スワイプ (Req 4.4). De-duplicated by id. */
  addToShiori: (spot: Spot) => void;
  /**
   * Add every spot in `spots` to the しおり in one update, skipping ids already
   * present (Req 4.1-4.4). Used by the route builder when the user starts the
   * trip; an empty list is a no-op (Req 4.9).
   */
  addSpotsToShiori: (spots: Spot[]) => void;
  /** Remove a spot from the しおり by id — leaves the しおり (Req 6.3). */
  removeFromShiori: (spotId: string) => void;
  /**
   * Reorder the しおり, moving the item at `from` to `to` (Req 6.2). Pure
   * {@link reorder} under the hood, so order is preserved and elements are kept
   * (Property 11). Accessible up/down controls in the editor drive this.
   */
  reorderShiori: (from: number, to: number) => void;
  /**
   * The しおり library: every confirmed schedule saved from the route builder,
   * **newest first**. Empty until a plan is saved.
   *
   * A list rather than a single value because planning a trip is iterative — the
   * user builds a route for Saturday, then another for Sunday, then a rainy-day
   * alternative — and each of those is a schedule they want to come back to, not
   * a draft that should silently replace the last one.
   *
   * Distinct from {@link TourismContextValue.activePlan}, which is the live
   * in-memory selection driving the map and is deliberately not persisted.
   */
  savedItineraries: SavedItinerary[];
  /**
   * Id of the itinerary the しおり screen has open, or `null` to follow the
   * newest. Session-only UI state: it is not persisted, because "which one was I
   * looking at" is not worth surviving a reload when the fallback is the newest.
   */
  activeItineraryId: string | null;
  /**
   * The itinerary currently open — the entry matching
   * {@link TourismContextValue.activeItineraryId}, falling back to the newest,
   * and `null` only when the library is empty.
   */
  savedItinerary: SavedItinerary | null;
  /**
   * Save a confirmed plan as a **new** itinerary in the library and open it.
   *
   * Adds rather than replaces, so building a second route never destroys the
   * first. Saving the same plan twice yields two entries: they are separate
   * copies of a schedule and the user may want to rename them differently
   * (「土曜プラン」/「雨の日プラン」). The library is capped, and the oldest entry
   * is dropped once it is full.
   */
  saveItinerary: (plan: RecommendedPlan) => void;
  /** Open a saved itinerary by id. Unknown ids leave the selection unchanged. */
  selectItinerary: (itineraryId: string) => void;
  /**
   * Rename a saved itinerary — the しおり's heading. A blank or unchanged title is
   * a no-op, so an accidentally emptied field does not leave an untitled entry.
   */
  renameItinerary: (itineraryId: string, title: string) => void;
  /**
   * Delete one saved itinerary, leaving the rest of the library and the しおり's
   * spot list untouched.
   */
  removeItinerary: (itineraryId: string) => void;
  /**
   * Delete the itinerary currently open, leaving the しおり's spot list untouched.
   * Equivalent to {@link TourismContextValue.removeItinerary} on the active id.
   */
  clearItinerary: () => void;
}

const TourismContext = createContext<TourismContextValue | null>(null);

/** Storage key the しおり is persisted under (Req 6.4). */
const SHIORI_KEY: StorageKey = "shiori";
/** Storage key お気に入り is persisted under (Req 3.1, 3.2). */
const FAVORITES_KEY: StorageKey = "favorites";
/** Storage key the しおり library (many itineraries, newest first) lives under. */
const SAVED_ITINERARIES_KEY: StorageKey = "savedItineraries";
/**
 * Superseded key that held a single itinerary. Read once on mount so an older
 * build's schedule is migrated into the library, then cleared. Never written
 * with a new value.
 */
const LEGACY_SAVED_ITINERARY_KEY: StorageKey = "savedItinerary";

/** Internal store shape held in a single state object. */
interface TourismState {
  activePlan: RecommendedPlan | null;
  /** お気に入り (右スワイプ, Req 4.2). */
  favorites: Spot[];
  /** しおり (Req 4.4). */
  shiori: Spot[];
  /** Every schedule saved from the route builder, newest first. */
  savedItineraries: SavedItinerary[];
  /** Which saved itinerary the しおり has open; null follows the newest. */
  activeItineraryId: string | null;
}

export interface TourismProviderProps {
  /**
   * Persistence backend; inject `gateway.storage` in the app, omit in tests.
   * When present the しおり is persisted (and rehydrated) under the `"shiori"`
   * key (Req 6.4 / Property 12) and お気に入り under the `"favorites"` key
   * (Req 3.1, 3.2) — independently of each other (Req 3.8). Resilient — a failed
   * load/save never throws and the in-memory lists stay authoritative, so the UI
   * keeps working. Omitting the port keeps both lists in memory only (Req 3.6).
   */
  storage?: StoragePort;
  children: ReactNode;
}

function createInitialState(): TourismState {
  return {
    activePlan: null,
    favorites: [],
    shiori: [],
    savedItineraries: [],
    activeItineraryId: null,
  };
}

export function TourismProvider({
  storage,
  children,
}: TourismProviderProps): JSX.Element {
  const [state, setState] = useState<TourismState>(createInitialState);

  // Guards saving until after the initial rehydration so a slow load never
  // clobbers persisted しおり with the empty initial value (Req 6.4).
  const shioriHydratedRef = useRef(false);

  // Rehydrate the しおり (key "shiori") once on mount. Resilient: any failure
  // leaves the in-memory state in place and the editor still works (Req 6.4).
  useEffect(() => {
    if (!storage) {
      shioriHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<Spot[]>(SHIORI_KEY);
        if (!cancelled && Array.isArray(saved)) {
          setState((s) => ({ ...s, shiori: saved }));
        }
      } catch {
        // Ignore — keep the in-memory しおり.
      }
      if (!cancelled) shioriHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persist the しおり under "shiori" whenever it changes (after hydration).
  // Resilient by design: a failed save is swallowed so the UI continues
  // (Req 6.4) and the in-memory しおり remains authoritative.
  useEffect(() => {
    if (!storage || !shioriHydratedRef.current) return;
    void storage.save<Spot[]>(SHIORI_KEY, state.shiori).catch(() => {
      // Persistence failed — in-memory しおり remains authoritative.
    });
  }, [storage, state.shiori]);

  // Guards saving until after the initial rehydration so a slow load never
  // clobbers persisted お気に入り with the empty initial value (Req 3.3). Kept
  // separate from shioriHydratedRef so the two keys hydrate independently.
  const favoritesHydratedRef = useRef(false);

  // Rehydrate お気に入り (key "favorites") once on mount. Resilient: a throw or a
  // non-array value leaves the in-memory list in place (Req 3.4).
  useEffect(() => {
    if (!storage) {
      // No StoragePort injected — お気に入り stays in memory only (Req 3.6).
      favoritesHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<Spot[]>(FAVORITES_KEY);
        if (!cancelled && Array.isArray(saved)) {
          setState((s) => ({ ...s, favorites: saved }));
        }
      } catch {
        // Ignore — keep the in-memory お気に入り.
      }
      if (!cancelled) favoritesHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persist お気に入り under "favorites" whenever it changes (after hydration).
  // Independent of the しおり effect, so a failure on one key never blocks the
  // other (Req 3.8). A failed save is swallowed and the in-memory list stays
  // authoritative (Req 3.5).
  useEffect(() => {
    if (!storage || !favoritesHydratedRef.current) return;
    void storage.save<Spot[]>(FAVORITES_KEY, state.favorites).catch(() => {
      // Persistence failed — in-memory お気に入り remains authoritative.
    });
  }, [storage, state.favorites]);

  // Third independent hydration guard. Kept separate from the two above so the
  // itinerary library, お気に入り and しおり each hydrate and save on their own
  // schedule and one key's failure never blocks another's write.
  const itineraryHydratedRef = useRef(false);

  // Rehydrate the しおり library once on mount, migrating the superseded
  // single-itinerary key on the way.
  //
  // Storage is untrusted, so the loaded value goes through
  // `normalizeSavedItineraries`: an older shape, a hand-edited value or a
  // truncated write is dropped **per entry**, so one unreadable trip costs that
  // trip and not the whole library.
  //
  // The legacy key is only consulted when the library came back empty — once the
  // user has a library, an old single value is stale and re-importing it would
  // resurrect a trip they deleted. After a successful migration the old key is
  // cleared for the same reason.
  useEffect(() => {
    if (!storage) {
      itineraryHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stored = await storage.load<unknown>(SAVED_ITINERARIES_KEY);
        let itineraries = normalizeSavedItineraries(stored);
        if (itineraries.length === 0) {
          const legacy = await storage.load<unknown>(LEGACY_SAVED_ITINERARY_KEY);
          itineraries = normalizeSavedItineraries(legacy);
          if (itineraries.length > 0) {
            // Best-effort: if clearing the old key fails the library still wins,
            // because the legacy branch only runs while the library is empty.
            await storage
              .save<null>(LEGACY_SAVED_ITINERARY_KEY, null)
              .catch(() => {});
          }
        }
        if (!cancelled && itineraries.length > 0) {
          setState((s) => ({ ...s, savedItineraries: itineraries }));
        }
      } catch {
        // Ignore — keep the in-memory library.
      }
      if (!cancelled) itineraryHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persist the しおり library whenever it changes (after hydration). A failed
  // save is swallowed: the in-memory library stays authoritative and the しおり
  // keeps rendering. `activeItineraryId` is deliberately absent from the written
  // value — it is view state, and persisting it would make a stale selection
  // outlive the reason for it.
  useEffect(() => {
    if (!storage || !itineraryHydratedRef.current) return;
    void storage
      .save<SavedItinerary[]>(SAVED_ITINERARIES_KEY, state.savedItineraries)
      .catch(() => {
        // Persistence failed — in-memory library remains authoritative.
      });
  }, [storage, state.savedItineraries]);

  // Add a spot to one of the route-driven collections, de-duplicated by id so
  // re-deciding the same place never creates duplicate entries. Returns the same
  // state reference when the spot is already present (cheap no-op).
  const addToCollection = useCallback(
    (key: "favorites" | "shiori", spot: Spot): void => {
      setState((s) => {
        const next = appendUniqueById(s[key], [spot]);
        return next === s[key] ? s : { ...s, [key]: next };
      });
    },
    [],
  );

  const addFavorite = useCallback(
    (spot: Spot): void => addToCollection("favorites", spot),
    [addToCollection],
  );

  // Remove a spot from お気に入り (Req 5.3). De-duplication on add means at most
  // one entry exists; filtering by id leaves the list without it. Returns the
  // same state reference when the spot is absent (cheap no-op).
  const removeFavorite = useCallback((spotId: string): void => {
    setState((s) => {
      if (!s.favorites.some((spot) => spot.id === spotId)) return s;
      return {
        ...s,
        favorites: s.favorites.filter((spot) => spot.id !== spotId),
      };
    });
  }, []);
  const addToShiori = useCallback(
    (spot: Spot): void => addToCollection("shiori", spot),
    [addToCollection],
  );

  // Append a whole confirmed route to the しおり in one update (Req 4.1-4.4):
  // existing entries and their order are kept, new spots land at the tail in
  // route order, and ids already present are skipped. Returns the same state
  // reference when nothing is new — so an empty route is a no-op (Req 4.9).
  const addSpotsToShiori = useCallback((spots: Spot[]): void => {
    setState((s) => {
      const next = appendUniqueById(s.shiori, spots);
      return next === s.shiori ? s : { ...s, shiori: next };
    });
  }, []);

  // Remove a spot from the しおり (Req 6.3, Property 10). De-duplication on add
  // means at most one entry exists; filtering by id leaves the list without it.
  // Returns the same state reference when absent (cheap no-op).
  const removeFromShiori = useCallback((spotId: string): void => {
    setState((s) => {
      if (!s.shiori.some((spot) => spot.id === spotId)) return s;
      return {
        ...s,
        shiori: s.shiori.filter((spot) => spot.id !== spotId),
      };
    });
  }, []);

  // Reorder the しおり with the pure domain reorder (Req 6.2, Property 11): the
  // result keeps every element and the moved item lands at the target index.
  const reorderShiori = useCallback((from: number, to: number): void => {
    setState((s) => {
      if (from === to) return s;
      return { ...s, shiori: reorder(s.shiori, from, to) };
    });
  }, []);

  const selectPlan = useCallback((plan: RecommendedPlan): void => {
    setState((s) => ({ ...s, activePlan: plan }));
  }, []);

  // Project the plan down to what the しおり renders and add it to the library.
  //
  // The timestamp and the id are both minted here rather than inside the pure
  // converter, so the conversion stays testable without freezing the clock or
  // stubbing a random source. The new entry becomes the open one: the user just
  // pressed 「このルートで旅を始める」, so that trip is what they want to see.
  const saveItinerary = useCallback((plan: RecommendedPlan): void => {
    const itinerary = savedItineraryFromPlan(
      plan,
      new Date().toISOString(),
      newSavedItineraryId(),
    );
    setState((s) => ({
      ...s,
      savedItineraries: addSavedItinerary(s.savedItineraries, itinerary),
      activeItineraryId: itinerary.id,
    }));
  }, []);

  // Open a saved itinerary. Unknown ids are ignored rather than clearing the
  // selection, so a stale id from a deleted entry cannot blank the screen.
  const selectItinerary = useCallback((itineraryId: string): void => {
    setState((s) => {
      if (s.activeItineraryId === itineraryId) return s;
      if (!s.savedItineraries.some((entry) => entry.id === itineraryId)) return s;
      return { ...s, activeItineraryId: itineraryId };
    });
  }, []);

  // Rename through the pure helper, which trims and returns the same list for a
  // no-op — so a blank or unchanged title costs neither a re-render nor a write.
  const renameItinerary = useCallback(
    (itineraryId: string, title: string): void => {
      setState((s) => {
        const next = renameSavedItinerary(s.savedItineraries, itineraryId, title);
        return next === s.savedItineraries ? s : { ...s, savedItineraries: next };
      });
    },
    [],
  );

  // Delete one entry. The selection is cleared only when the deleted entry was
  // the open one, in which case `activeSavedItinerary` falls back to the newest
  // remaining trip — the screen keeps showing a schedule instead of going blank.
  const removeItinerary = useCallback((itineraryId: string): void => {
    setState((s) => {
      const next = removeSavedItinerary(s.savedItineraries, itineraryId);
      if (next === s.savedItineraries) return s;
      return {
        ...s,
        savedItineraries: next,
        activeItineraryId:
          s.activeItineraryId === itineraryId ? null : s.activeItineraryId,
      };
    });
  }, []);

  // Delete whichever itinerary is open. Resolved through the same fallback the
  // view uses, so the button removes the card the user is actually looking at
  // even when nothing was explicitly selected.
  const clearItinerary = useCallback((): void => {
    setState((s) => {
      const active = activeSavedItinerary(s.savedItineraries, s.activeItineraryId);
      if (!active) return s;
      const next = removeSavedItinerary(s.savedItineraries, active.id);
      return { ...s, savedItineraries: next, activeItineraryId: null };
    });
  }, []);

  const value = useMemo<TourismContextValue>(
    () => ({
      activePlan: state.activePlan,
      selectPlan,
      favorites: state.favorites,
      shiori: state.shiori,
      addFavorite,
      removeFavorite,
      addToShiori,
      addSpotsToShiori,
      removeFromShiori,
      reorderShiori,
      savedItineraries: state.savedItineraries,
      activeItineraryId: state.activeItineraryId,
      // Derived here, not stored: keeping "which one is open" as a single source
      // (the id) means a rename or a delete cannot leave the card and the list
      // disagreeing about the same trip.
      savedItinerary: activeSavedItinerary(
        state.savedItineraries,
        state.activeItineraryId,
      ),
      saveItinerary,
      selectItinerary,
      renameItinerary,
      removeItinerary,
      clearItinerary,
    }),
    [
      state,
      selectPlan,
      addFavorite,
      removeFavorite,
      addToShiori,
      addSpotsToShiori,
      removeFromShiori,
      reorderShiori,
      saveItinerary,
      selectItinerary,
      renameItinerary,
      removeItinerary,
      clearItinerary,
    ],
  );

  return (
    <TourismContext.Provider value={value}>{children}</TourismContext.Provider>
  );
}

/** Access the tourism context. Throws if used outside a {@link TourismProvider}. */
export function useTourism(): TourismContextValue {
  const ctx = useContext(TourismContext);
  if (ctx === null) {
    throw new Error("useTourism must be used within a <TourismProvider>.");
  }
  return ctx;
}
