/**
 * DiscoveryContext — the 発見 (discovery) screen's own store.
 *
 * Kept separate from {@link TourismProvider} on purpose. The two hold different
 * kinds of state: the tourism store owns the user's *collections* (お気に入り /
 * しおり / the saved itinerary), while this one owns *progress through a game*
 * (which spots have been decided, where the deck is, and which photos have
 * already been paid for). Splitting them keeps three promises easy to keep:
 *
 *  - **Independent persistence.** Seen_Record and Photo_Cache each get their own
 *    storage key and their own hydrate/save pair, so a failure on one never
 *    blocks the other or お気に入り (Req 10.1, 10.7).
 *  - **Deck position survives tab switches.** It lives here rather than in the
 *    screen, so leaving 発見 and coming back resumes where the user was
 *    (Req 1.7) — component state would be lost on unmount.
 *  - **One paid lookup per spot.** The photo cache is the single gate in front
 *    of the Places API, and it is consulted before any request is made
 *    (Req 7.2, 7.3).
 *
 * With no {@link StoragePort} injected everything stays in memory (Req 10.6).
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

import {
  normalizePhotoCache,
  photoCacheGet,
  photoCacheHas,
  photoCachePut,
  type PhotoCache,
  type PhotoCacheEntry,
} from "../domain/photoCache";
import type { StorageKey } from "../domain/types";
import type { StoragePort } from "../ports";

/** Storage key the decided-spot record is persisted under (Req 10.1, 10.9). */
const SEEN_KEY: StorageKey = "discoverySeen";
/** Storage key the photo cache is persisted under (Req 7.4, 10.9). */
const PHOTOS_KEY: StorageKey = "discoveryPhotos";

export interface DiscoveryContextValue {
  /** Ids of spots the user has decided on (興味あり or 興味なし). */
  seen: ReadonlySet<string>;
  /** Position in the presentation order — the card currently on top. */
  deckPosition: number;
  /**
   * Record a decision: adds the id to {@link seen} and advances the deck.
   *
   * Re-deciding an id already recorded leaves the record untouched (Req 4.12)
   * but still advances, so a second pass through the deck moves normally.
   */
  recordDecision: (spotId: string) => void;
  /** Restart from the top of the deck without clearing the record (Req 5.3, 5.4). */
  restartDeck: () => void;
  /** The cached photo for a spot, or `undefined` when never looked up. */
  cachedPhoto: (spotId: string) => PhotoCacheEntry | undefined;
  /** True when this spot has been looked up — the gate on the paid API call. */
  hasPhoto: (spotId: string) => boolean;
  /** Store one lookup result, evicting the oldest entry past the cap. */
  cachePhoto: (entry: PhotoCacheEntry) => void;
  /**
   * True once a lookup for this spot failed in **this** session.
   *
   * Held in memory only, so a transient outage is retried on the next visit
   * rather than being remembered forever (Req 8.10, 8.11, 8.12).
   */
  photoFailed: (spotId: string) => boolean;
  /** Mark a lookup as failed for the rest of this session. */
  markPhotoFailed: (spotId: string) => void;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

export interface DiscoveryProviderProps {
  /** Persistence backend; inject `gateway.storage`, omit to stay in memory. */
  storage?: StoragePort;
  children: ReactNode;
}

export function DiscoveryProvider({
  storage,
  children,
}: DiscoveryProviderProps): JSX.Element {
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [photos, setPhotos] = useState<PhotoCache>(() => []);
  const [deckPosition, setDeckPosition] = useState(0);

  // Lookups that failed this session. A ref, not state: it must not trigger a
  // render, and it is deliberately dropped when the app reloads (Req 8.12).
  const failedRef = useRef<Set<string>>(new Set<string>());

  // One hydration guard per key so the two never gate each other (Req 10.7).
  const seenHydratedRef = useRef(false);
  const photosHydratedRef = useRef(false);

  // Rehydrate the decided-spot record. A throw or a non-array value leaves an
  // empty record rather than failing the screen (Req 10.4).
  useEffect(() => {
    if (!storage) {
      seenHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<unknown>(SEEN_KEY);
        if (!cancelled && Array.isArray(saved)) {
          const ids = saved.filter((id): id is string => typeof id === "string");
          if (ids.length > 0) setSeen(new Set(ids));
        }
      } catch {
        // Ignore — continue with an empty record.
      }
      if (!cancelled) seenHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persist the record as a plain array (a Set is not JSON-serialisable).
  useEffect(() => {
    if (!storage || !seenHydratedRef.current) return;
    void storage.save<string[]>(SEEN_KEY, [...seen]).catch(() => {
      // Persistence failed — the in-memory record stays authoritative (Req 10.5).
    });
  }, [storage, seen]);

  // Rehydrate the photo cache, dropping unusable entries (Req 7.5, 7.9).
  useEffect(() => {
    if (!storage) {
      photosHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<unknown>(PHOTOS_KEY);
        if (!cancelled) {
          const restored = normalizePhotoCache(saved);
          if (restored.length > 0) setPhotos(restored);
        }
      } catch {
        // Ignore — continue with an empty cache.
      }
      if (!cancelled) photosHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persist the photo cache (Req 7.4). Never before hydration (Req 7.6).
  useEffect(() => {
    if (!storage || !photosHydratedRef.current) return;
    void storage.save<PhotoCache>(PHOTOS_KEY, photos).catch(() => {
      // Persistence failed — the in-memory cache stays usable (Req 7.10).
    });
  }, [storage, photos]);

  const recordDecision = useCallback((spotId: string): void => {
    setSeen((current) => {
      if (current.has(spotId)) return current;
      const next = new Set(current);
      next.add(spotId);
      return next;
    });
    setDeckPosition((current) => current + 1);
  }, []);

  const restartDeck = useCallback((): void => {
    setDeckPosition(0);
  }, []);

  const cachedPhoto = useCallback(
    (spotId: string): PhotoCacheEntry | undefined => photoCacheGet(photos, spotId),
    [photos],
  );

  const hasPhoto = useCallback(
    (spotId: string): boolean => photoCacheHas(photos, spotId),
    [photos],
  );

  const cachePhoto = useCallback((entry: PhotoCacheEntry): void => {
    setPhotos((current) => photoCachePut(current, entry));
  }, []);

  const photoFailed = useCallback(
    (spotId: string): boolean => failedRef.current.has(spotId),
    [],
  );

  const markPhotoFailed = useCallback((spotId: string): void => {
    failedRef.current.add(spotId);
  }, []);

  const value = useMemo<DiscoveryContextValue>(
    () => ({
      seen,
      deckPosition,
      recordDecision,
      restartDeck,
      cachedPhoto,
      hasPhoto,
      cachePhoto,
      photoFailed,
      markPhotoFailed,
    }),
    [
      seen,
      deckPosition,
      recordDecision,
      restartDeck,
      cachedPhoto,
      hasPhoto,
      cachePhoto,
      photoFailed,
      markPhotoFailed,
    ],
  );

  return (
    <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>
  );
}

/** Access the discovery store. Throws outside a {@link DiscoveryProvider}. */
export function useDiscovery(): DiscoveryContextValue {
  const ctx = useContext(DiscoveryContext);
  if (ctx === null) {
    throw new Error("useDiscovery must be used within a <DiscoveryProvider>.");
  }
  return ctx;
}
