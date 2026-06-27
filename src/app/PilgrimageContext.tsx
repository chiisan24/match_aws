/**
 * Pilgrimage shared-state context — the seam お遍路モード screens share.
 *
 * Originally (task 10.1) this only held the **visited temple set** consulted by
 * the 札所マップ 未訪問のみ filter (Req 8.3). Task 10.4 (巡礼進捗ダッシュボード)
 * extends it — additively — into the richer pilgrimage store the progress
 * screen and task 10.5 (デジタル納経帳・訪問管理) both build on:
 *
 *  - the **visited set** (unchanged — the map filter keeps reading `visited`),
 *  - the **selected 対象県** (`area`, default `ehime`) that scopes progress
 *    (Req 9.6, Property 20),
 *  - the assembled {@link ProgressState} (`progress`) the domain progress
 *    functions consume (`achievementRate` / `applyVisit` / `remainingInArea` /
 *    `shikoku*` — Req 9.1–9.6), and
 *  - a **visit-record seam** (`visitRecords` + setters) so the 今日/今月 tallies
 *    (Req 9.5) have a source and task 10.5 can populate the デジタル納経帳
 *    without changing this provider's shape.
 *
 * Persistence: visited + selected area are persisted through the injected
 * {@link StoragePort} under the `"progress"` key, and visit records are
 * persisted (loaded on mount, saved on change) under the `"visitRecords"` key
 * (the納経帳 key task 10.5 owns — closing the save→load round-trip, Req 10.5 /
 * Property 12). All persistence is resilient — a failed load/save never throws
 * and the in-memory state is always authoritative (Req 11.5 spirit: keep the
 * UI working).
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

import { EHIME_TEMPLES } from "../adapters/mock";
import type {
  ProgressState,
  ShikokuPrefecture,
  StorageKey,
  VisitRecord,
} from "../domain/types";
import type { StoragePort } from "../ports";

/** The four Shikoku prefectures, in pilgrimage order, for the area selector. */
export const SHIKOKU_PREFECTURES: readonly ShikokuPrefecture[] = [
  "tokushima",
  "kochi",
  "ehime",
  "kagawa",
];

/** Total temples across the four Shikoku prefectures (四国 88 札所, Req 9.2). */
export const SHIKOKU_TOTAL = 88;

/** Default 対象県 — Ehime is the MVP focus and the mockup default (Req 9.1). */
const DEFAULT_AREA: ShikokuPrefecture = "ehime";

/** Storage keys this provider owns / reads. */
const PROGRESS_KEY: StorageKey = "progress";
const VISIT_RECORDS_KEY: StorageKey = "visitRecords";

/**
 * Default per-area temple-id map. Only Ehime (札所 40–65) has a fixed mock
 * dataset for the MVP; the other prefectures are empty until their data lands,
 * which keeps `areaTotal`/`remainingInArea` honest (0/0) for those areas while
 * still letting the user select them (Req 9.6). Built from the same mock
 * fixture the 札所マップ uses so the two screens always agree.
 */
function defaultTemplesByArea(): Record<ShikokuPrefecture, string[]> {
  return {
    ehime: EHIME_TEMPLES.map((t) => t.id),
    kagawa: [],
    tokushima: [],
    kochi: [],
  };
}

/** Shape persisted under the `"progress"` storage key. */
interface PersistedProgress {
  area: ShikokuPrefecture;
  visited: string[];
}

export interface PilgrimageContextValue {
  // -- Visited set (task 10.1 — the 未訪問のみ filter reads this) -----------
  /** Temple ids recorded as visited (訪問済). Read by the 未訪問のみ filter. */
  visited: ReadonlySet<string>;
  /** Whether a given temple id is recorded as visited. */
  isVisited: (templeId: string) => boolean;
  /** Mark a temple visited (true) or unvisited (false). */
  setVisited: (templeId: string, visited: boolean) => void;
  /** Flip a temple's visited state. */
  toggleVisited: (templeId: string) => void;

  // -- Progress state (task 10.4 — 巡礼進捗ダッシュボード) -------------------
  /** The selected 対象県 that scopes progress (Req 9.6). */
  area: ShikokuPrefecture;
  /** Choose the 対象県 for progress (Req 9.6). */
  setArea: (area: ShikokuPrefecture) => void;
  /**
   * The assembled {@link ProgressState} for the domain progress functions
   * (Req 9). `visited` and `area` track this context's state; `templesByArea`
   * and `shikokuTotal` come from the mock dataset (88).
   */
  progress: ProgressState;

  // -- Visit-record seam (task 10.5 — デジタル納経帳; feeds 今日/今月) -------
  /** Recorded visits, source of the 今日/今月 tallies (Req 9.5, 10). */
  visitRecords: readonly VisitRecord[];
  /** Replace the visit-record list (task 10.5 owns the editing UI). */
  setVisitRecords: (records: readonly VisitRecord[]) => void;
  /** Append a single visit record (convenience for task 10.5 / 到着記録). */
  addVisitRecord: (record: VisitRecord) => void;

  // -- お遍路 しおり (task 11.4 — 到着シートの「しおりに追加」先, Req 13.2) ---
  /**
   * Temple ids saved to the お遍路 しおり (後で巡る list) — the target of the
   * 札所到着シートの「しおりに追加」action (Req 13.2). Kept in memory for the
   * session; a sensible, additive home that needs no new storage key.
   */
  shioriTempleIds: readonly string[];
  /** Whether a temple id is already in the お遍路 しおり. */
  isInShiori: (templeId: string) => boolean;
  /** Add a temple to the お遍路 しおり (idempotent — never duplicates). */
  addToShiori: (templeId: string) => void;
}

const PilgrimageContext = createContext<PilgrimageContextValue | null>(null);

export interface PilgrimageProviderProps {
  /**
   * Persistence backend; inject `gateway.storage` in the app, a fake/omitted in
   * tests. When omitted the provider is purely in-memory (still fully
   * functional) — handy for unit tests of the progress screen.
   */
  storage?: StoragePort;
  /**
   * Initial visited temple ids. Defaults to empty. Persisted state (if any)
   * loaded from `"progress"` takes precedence once it rehydrates.
   */
  initialVisited?: Iterable<string>;
  /** Initial 対象県. Defaults to Ehime (Req 9.1 / mockup). */
  initialArea?: ShikokuPrefecture;
  /**
   * Per-area temple-id map. Defaults to the mock dataset (Ehime 40–65 + empty
   * others). Injectable for tests.
   */
  templesByArea?: Record<ShikokuPrefecture, string[]>;
  children: ReactNode;
}

export function PilgrimageProvider({
  storage,
  initialVisited,
  initialArea = DEFAULT_AREA,
  templesByArea,
  children,
}: PilgrimageProviderProps): JSX.Element {
  const [visited, setVisitedSet] = useState<Set<string>>(
    () => new Set(initialVisited ?? []),
  );
  const [area, setAreaState] = useState<ShikokuPrefecture>(initialArea);
  const [visitRecords, setVisitRecordsState] = useState<readonly VisitRecord[]>(
    [],
  );
  const [shioriTempleIds, setShioriTempleIds] = useState<readonly string[]>([]);

  // Stable per-area temple map (mock dataset unless injected for tests).
  const areaMap = useMemo<Record<ShikokuPrefecture, string[]>>(
    () => templesByArea ?? defaultTemplesByArea(),
    [templesByArea],
  );

  // Guards saving until after the initial rehydration so a slow load never
  // clobbers persisted state with the empty initial value.
  const hydratedRef = useRef(false);

  // Rehydrate visited/area (key "progress") and visit records (key
  // "visitRecords") once on mount. Resilient: any failure leaves the in-memory
  // defaults in place and the screen still works.
  useEffect(() => {
    if (!storage) {
      hydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<PersistedProgress>(PROGRESS_KEY);
        if (!cancelled && saved) {
          if (Array.isArray(saved.visited)) {
            setVisitedSet(new Set(saved.visited));
          }
          if (typeof saved.area === "string") {
            setAreaState(saved.area);
          }
        }
      } catch {
        // Ignore — keep defaults.
      }
      try {
        const records = await storage.load<VisitRecord[]>(VISIT_RECORDS_KEY);
        if (!cancelled && Array.isArray(records)) {
          setVisitRecordsState(records);
        }
      } catch {
        // Ignore — keep empty.
      }
      if (!cancelled) hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persist visited + area under "progress" whenever they change (after
  // hydration). Resilient: a failed save is swallowed so the UI continues.
  useEffect(() => {
    if (!storage || !hydratedRef.current) return;
    const payload: PersistedProgress = { area, visited: [...visited] };
    void storage.save<PersistedProgress>(PROGRESS_KEY, payload).catch(() => {
      // Persistence failed — in-memory state remains authoritative.
    });
  }, [storage, area, visited]);

  // Persist visit records under "visitRecords" whenever they change (after
  // hydration) — the デジタル納経帳 store task 10.5 writes through
  // addVisitRecord / setVisitRecords. Together with the load above this closes
  // the save→load round-trip (Req 10.5, Property 12). Resilient by design: a
  // failed save is swallowed so the納経帳 UI keeps working (Req 11.5 spirit).
  useEffect(() => {
    if (!storage || !hydratedRef.current) return;
    void storage
      .save<VisitRecord[]>(VISIT_RECORDS_KEY, [...visitRecords])
      .catch(() => {
        // Persistence failed — in-memory records remain authoritative.
      });
  }, [storage, visitRecords]);

  const isVisited = useCallback(
    (templeId: string): boolean => visited.has(templeId),
    [visited],
  );

  const setVisited = useCallback((templeId: string, value: boolean): void => {
    setVisitedSet((prev) => {
      const has = prev.has(templeId);
      if (value === has) return prev; // no change — keep the same reference
      const next = new Set(prev);
      if (value) next.add(templeId);
      else next.delete(templeId);
      return next;
    });
  }, []);

  const toggleVisited = useCallback((templeId: string): void => {
    setVisitedSet((prev) => {
      const next = new Set(prev);
      if (next.has(templeId)) next.delete(templeId);
      else next.add(templeId);
      return next;
    });
  }, []);

  const setArea = useCallback((next: ShikokuPrefecture): void => {
    setAreaState(next);
  }, []);

  const setVisitRecords = useCallback(
    (records: readonly VisitRecord[]): void => {
      setVisitRecordsState(records);
    },
    [],
  );

  const addVisitRecord = useCallback((record: VisitRecord): void => {
    setVisitRecordsState((prev) => [...prev, record]);
  }, []);

  const isInShiori = useCallback(
    (templeId: string): boolean => shioriTempleIds.includes(templeId),
    [shioriTempleIds],
  );

  const addToShiori = useCallback((templeId: string): void => {
    setShioriTempleIds((prev) =>
      prev.includes(templeId) ? prev : [...prev, templeId],
    );
  }, []);

  // Assemble the ProgressState the domain progress functions consume (Req 9).
  const progress = useMemo<ProgressState>(
    () => ({
      area,
      visited,
      templesByArea: areaMap,
      shikokuTotal: SHIKOKU_TOTAL,
    }),
    [area, visited, areaMap],
  );

  const value = useMemo<PilgrimageContextValue>(
    () => ({
      visited,
      isVisited,
      setVisited,
      toggleVisited,
      area,
      setArea,
      progress,
      visitRecords,
      setVisitRecords,
      addVisitRecord,
      shioriTempleIds,
      isInShiori,
      addToShiori,
    }),
    [
      visited,
      isVisited,
      setVisited,
      toggleVisited,
      area,
      setArea,
      progress,
      visitRecords,
      setVisitRecords,
      addVisitRecord,
      shioriTempleIds,
      isInShiori,
      addToShiori,
    ],
  );

  return (
    <PilgrimageContext.Provider value={value}>
      {children}
    </PilgrimageContext.Provider>
  );
}

/** Access the pilgrimage shared state. Throws outside a {@link PilgrimageProvider}. */
export function usePilgrimage(): PilgrimageContextValue {
  const ctx = useContext(PilgrimageContext);
  if (ctx === null) {
    throw new Error("usePilgrimage must be used within a <PilgrimageProvider>.");
  }
  return ctx;
}
