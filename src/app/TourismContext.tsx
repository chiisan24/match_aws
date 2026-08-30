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
 *  - **{@link TourismContextValue.activePlan}**: the recommendation picked during
 *    onboarding, which the map uses to draw the guided route.
 *
 * **Persistence** is delegated to the optional {@link StoragePort} prop. Both
 * the しおり (`"shiori"` key) and お気に入り (`"favorites"` key) are rehydrated
 * once on mount and re-saved on every change. Each list gets its own hydration
 * guard and its own pair of effects, so the two keys are persisted
 * independently and a failure on one never blocks the other (Req 3.8). The
 * guard keeps the empty initial value from overwriting saved data before the
 * load resolves, and both directions swallow failures so the in-memory lists
 * stay authoritative and the UI keeps working. With no port injected the state
 * simply lives in memory.
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
import type { RecommendedPlan, Spot, StorageKey } from "../domain/types";
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
}

const TourismContext = createContext<TourismContextValue | null>(null);

/** Storage key the しおり is persisted under (Req 6.4). */
const SHIORI_KEY: StorageKey = "shiori";
/** Storage key お気に入り is persisted under (Req 3.1, 3.2). */
const FAVORITES_KEY: StorageKey = "favorites";

/** Internal store shape held in a single state object. */
interface TourismState {
  activePlan: RecommendedPlan | null;
  /** お気に入り (右スワイプ, Req 4.2). */
  favorites: Spot[];
  /** しおり (Req 4.4). */
  shiori: Spot[];
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
