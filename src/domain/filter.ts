/**
 * Pure temple filtering for the 札所マップ (Req 8.3 / Property 16).
 *
 * Supports the filter axes described in the requirement: 車 (car) / 徒歩 (walk)
 * by available time, and 未訪問のみ (unvisited only). No I/O.
 */

import type { Temple } from "./types";

/** Travel time (minutes) to a temple by transport mode. */
export interface TempleTravelTime {
  /** Minutes by car (車). */
  car: number;
  /** Minutes on foot (徒歩). */
  walk: number;
}

/**
 * Filter criteria for the temple map (Req 8.3).
 *
 * All fields are optional; an empty criteria object matches every temple. When
 * a constraint is present but the data needed to evaluate it is missing for a
 * given temple, that temple is excluded — this keeps the invariant that every
 * returned temple provably satisfies the active criteria.
 */
export interface TempleFilterCriteria {
  /** Transport mode used when evaluating `maxMinutes`. Defaults to "car". */
  transport?: "car" | "walk";
  /** Maximum allowed travel time in minutes (時間 filter). */
  maxMinutes?: number;
  /** When true, only temples not present in `visited` are kept (未訪問のみ). */
  unvisitedOnly?: boolean;
  /** Set of visited temple ids, consulted when `unvisitedOnly` is true. */
  visited?: ReadonlySet<string>;
  /** Per-temple travel times keyed by temple id, consulted when `maxMinutes` is set. */
  travelMinutes?: Readonly<Record<string, TempleTravelTime>>;
}

/**
 * Return whether a single temple satisfies the given criteria.
 *
 * Exported so tests can assert the predicate directly. The predicate is total
 * and never throws.
 */
export function satisfiesTempleCriteria(
  temple: Temple,
  criteria: TempleFilterCriteria,
): boolean {
  // 未訪問のみ: exclude temples recorded as visited.
  if (criteria.unvisitedOnly && criteria.visited?.has(temple.id)) {
    return false;
  }

  // 時間 + 車/徒歩: keep only temples reachable within the time budget by the
  // chosen transport. Missing travel data means we cannot prove the constraint
  // holds, so the temple is excluded.
  if (criteria.maxMinutes !== undefined) {
    const times = criteria.travelMinutes?.[temple.id];
    if (!times) {
      return false;
    }
    const mode = criteria.transport ?? "car";
    if (times[mode] > criteria.maxMinutes) {
      return false;
    }
  }

  return true;
}

/**
 * Filter a temple list down to those matching `criteria` (Req 8.3).
 *
 * Guarantees (Property 16):
 * - The result is a subset of `temples` (order preserved, no new elements).
 * - Every temple in the result satisfies `criteria`.
 */
export function filterTemples(
  temples: Temple[],
  criteria: TempleFilterCriteria,
): Temple[] {
  return temples.filter((temple) => satisfiesTempleCriteria(temple, criteria));
}
