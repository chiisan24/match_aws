/**
 * Pilgrimage progress — pure, side-effect-free domain logic (Req 9).
 *
 * Houses achievement-rate calculation, visit application, remaining/total
 * accounting, area scoping against the selected ShikokuPrefecture, and
 * today/this-month visit tallies. Every function here is referentially
 * transparent: inputs are never mutated and no I/O is performed. These
 * functions are written so that design Properties 17, 18, 19, 20, 21 hold.
 */

import type {
  ProgressState,
  ShikokuPrefecture,
  VisitRecord,
} from "./types";

// ---------------------------------------------------------------------------
// Achievement rate (達成率)
// ---------------------------------------------------------------------------

/**
 * Achievement rate as a floored percentage (Req 9.3).
 *
 * Returns `floor(visitedCount / total * 100)`, clamped to the inclusive range
 * `0..100`. A non-positive `total` (no temples in scope) is handled gracefully
 * by returning `0` rather than dividing by zero. Negative `visitedCount` is
 * treated as `0`.
 *
 * Properties: visitedCount=0 → 0, visitedCount=total → 100 (Property 17).
 */
export function achievementRate(visitedCount: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }
  const safeVisited = Number.isFinite(visitedCount)
    ? Math.max(0, visitedCount)
    : 0;
  const rate = Math.floor((safeVisited / total) * 100);
  return clamp(rate, 0, 100);
}

// ---------------------------------------------------------------------------
// Visit application (純粋更新)
// ---------------------------------------------------------------------------

/**
 * Apply a visit toggle, returning a NEW ProgressState (Req 9.4, 11.4).
 *
 * When `visited` is true the temple id is added to the visited membership;
 * when false it is removed. The input `state` and its `visited` Set are never
 * mutated — a fresh Set is always produced. Marking an already-visited temple
 * visited (or an unvisited temple unvisited) is idempotent, which makes the
 * toggle round-trip (Property 21) hold.
 */
export function applyVisit(
  state: ProgressState,
  templeId: string,
  visited: boolean,
): ProgressState {
  const next = new Set(state.visited);
  if (visited) {
    next.add(templeId);
  } else {
    next.delete(templeId);
  }
  return { ...state, visited: next };
}

// ---------------------------------------------------------------------------
// Area scoping (対象県限定)
// ---------------------------------------------------------------------------

/**
 * Temple ids in scope for the given area, defaulting to the selected area
 * (Req 9.6). Returns the area's temple set exactly (Property 20).
 */
export function areaTemples(
  state: ProgressState,
  area: ShikokuPrefecture = state.area,
): string[] {
  return state.templesByArea[area] ?? [];
}

/** Total number of temples in the selected area (Req 9.5, 9.6). */
export function areaTotal(
  state: ProgressState,
  area: ShikokuPrefecture = state.area,
): number {
  return areaTemples(state, area).length;
}

/** Visited temple ids that belong to the selected area's temple set. */
export function visitedInArea(
  state: ProgressState,
  area: ShikokuPrefecture = state.area,
): string[] {
  return areaTemples(state, area).filter((id) => state.visited.has(id));
}

/** Count of visited temples within the selected area (Req 9.1, 9.5). */
export function visitedCountInArea(
  state: ProgressState,
  area: ShikokuPrefecture = state.area,
): number {
  return visitedInArea(state, area).length;
}

/**
 * Remaining (unvisited) temples in the selected area (Req 9.5).
 *
 * Invariant: `remainingInArea + visitedCountInArea === areaTotal`
 * (Property 19).
 */
export function remainingInArea(
  state: ProgressState,
  area: ShikokuPrefecture = state.area,
): number {
  return areaTotal(state, area) - visitedCountInArea(state, area);
}

/** Achievement rate for the selected area (Req 9.1). */
export function areaAchievementRate(
  state: ProgressState,
  area: ShikokuPrefecture = state.area,
): number {
  return achievementRate(visitedCountInArea(state, area), areaTotal(state, area));
}

// ---------------------------------------------------------------------------
// Shikoku-wide totals (四国 88 札所)
// ---------------------------------------------------------------------------

/** All temple ids across the four Shikoku prefectures, de-duplicated. */
function allShikokuTempleIds(state: ProgressState): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(state.templesByArea)) {
    for (const id of list) {
      ids.add(id);
    }
  }
  return ids;
}

/** Count of visited temples across all of Shikoku (Req 9.2). */
export function shikokuVisitedCount(state: ProgressState): number {
  const all = allShikokuTempleIds(state);
  let count = 0;
  for (const id of state.visited) {
    if (all.has(id)) {
      count += 1;
    }
  }
  return count;
}

/** Achievement rate against the Shikoku 88 total (Req 9.2, 9.3). */
export function shikokuAchievementRate(state: ProgressState): number {
  return achievementRate(shikokuVisitedCount(state), state.shikokuTotal);
}

/** Remaining temples across all of Shikoku (Req 9.5). */
export function shikokuRemaining(state: ProgressState): number {
  return state.shikokuTotal - shikokuVisitedCount(state);
}

// ---------------------------------------------------------------------------
// Today / this-month visit tallies (Req 9.5)
// ---------------------------------------------------------------------------

/**
 * Number of distinct temples visited on the same calendar day as `now`
 * (Req 9.5). Pure: the reference date is passed in rather than read from the
 * clock. `visitDate` values that do not parse to a valid date are ignored.
 */
export function visitedTodayCount(
  records: readonly VisitRecord[],
  now: Date,
): number {
  return countTemplesMatching(records, (d) => isSameDay(d, now));
}

/**
 * Number of distinct temples visited within the same calendar month as `now`
 * (Req 9.5). Pure: the reference date is passed in.
 */
export function visitedThisMonthCount(
  records: readonly VisitRecord[],
  now: Date,
): number {
  return countTemplesMatching(records, (d) => isSameMonth(d, now));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countTemplesMatching(
  records: readonly VisitRecord[],
  predicate: (visitDate: Date) => boolean,
): number {
  const temples = new Set<string>();
  for (const record of records) {
    const date = new Date(record.visitDate);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    if (predicate(date)) {
      temples.add(record.templeId);
    }
  }
  return temples.size;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
