/**
 * Pure travel estimates per transport mode — the numbers the しおり shows for
 * 「現在地からどのくらい？」.
 *
 * Two things live here on purpose:
 *
 *  1. **One speed table.** Before this module the same rough figures were
 *     re-declared per screen (`TempleMap` 600/75, `TourismLayeredMap` 500/80,
 *     `templeNav` 600/75), so the same walk could read as two different
 *     estimates depending on which screen you were on. The table below is the
 *     single source those numbers now come from.
 *  2. **A per-mode road factor.** A straight line is not a route, and how much
 *     longer the real route is depends on the mode: a pedestrian cuts through
 *     alleys, a car is bound to roads, a bus or tram follows a line that was
 *     drawn for someone else's trip. Applying one factor to every mode would
 *     make transit look as direct as walking.
 *
 * Everything is pure and total: no I/O, no clock, no i18n, no DOM. Callers own
 * the presentation — {@link formatDistanceMeters} returns locale-independent
 * `m` / `km`, and durations come back as plain minutes so the view can pick its
 * own i18n pattern via {@link splitDurationMinutes}.
 *
 * Every figure is an **estimate**. Callers must label it as such; the しおり
 * renders a disclaimer next to the numbers.
 */

import { haversineDistanceMeters } from "./geofence";
import type { GeoPoint } from "./types";

/** A transport mode the しおり can estimate. */
export type TravelMode = "walk" | "bicycle" | "car" | "transit";

/**
 * Modes in the order the UI lists them: slowest and most local first, so the
 * list reads as "can I just walk?" → "do I need a car?".
 */
export const TRAVEL_MODES: readonly TravelMode[] = [
  "walk",
  "bicycle",
  "car",
  "transit",
];

/** The tuning knobs behind one mode's estimate. */
interface TravelModeProfile {
  /** Average travel speed in metres per minute, once moving. */
  metersPerMinute: number;
  /**
   * Multiplier turning the crow-flies distance into a route distance for this
   * mode. Always ≥ 1 — a route is never shorter than the straight line.
   */
  detourFactor: number;
  /**
   * Fixed minutes added regardless of distance: waiting, transfers, parking,
   * the walk to and from the vehicle. Zero for walking, which starts the moment
   * you stand up.
   */
  overheadMinutes: number;
}

/**
 * Speeds and road factors per mode, tuned for Ehime rather than for a city:
 *
 *  - `walk` — 4.5 km/h, the pace the existing 札所ナビ estimate already used.
 *    The lowest detour factor: footpaths and crossings cut corners cars cannot.
 *  - `bicycle` — 12 km/h, a rental bike on しまなみ-style roads, not a racer.
 *  - `car` — 36 km/h average, deliberately below the limit: it has to absorb
 *    town traffic, mountain roads and parking at the far end.
 *  - `transit` — 21 km/h scheduled speed for tram / bus / local rail, the
 *    largest detour factor because a line goes where the line goes, plus 12
 *    minutes of overhead for the wait and the walk to the stop. On a rural
 *    timetable that is optimistic, which is exactly why the UI labels it 目安.
 */
const TRAVEL_MODE_PROFILES: Readonly<Record<TravelMode, TravelModeProfile>> = {
  walk: { metersPerMinute: 75, detourFactor: 1.2, overheadMinutes: 0 },
  bicycle: { metersPerMinute: 200, detourFactor: 1.25, overheadMinutes: 2 },
  car: { metersPerMinute: 600, detourFactor: 1.3, overheadMinutes: 5 },
  transit: { metersPerMinute: 350, detourFactor: 1.45, overheadMinutes: 12 },
};

/** One mode's estimate between two points. */
export interface TravelEstimate {
  mode: TravelMode;
  /** Great-circle distance in metres. Mode-independent. */
  straightMeters: number;
  /** Estimated route distance in metres for this mode (detour applied). */
  routeMeters: number;
  /** Estimated door-to-door minutes, an integer ≥ 1 (overhead included). */
  minutes: number;
}

/** True for a coordinate pair usable in a distance calculation. */
function isUsablePoint(point: GeoPoint | null | undefined): point is GeoPoint {
  return (
    point != null
    && Number.isFinite(point.lat)
    && Number.isFinite(point.lng)
  );
}

/**
 * Straight-line distance between two points, or `null` when either point is
 * missing or non-finite.
 *
 * Returning `null` rather than `0` matters to the caller: "I don't know where
 * you are" and "you are standing on it" must not render the same way.
 */
export function straightLineMeters(
  from: GeoPoint | null | undefined,
  to: GeoPoint | null | undefined,
): number | null {
  if (!isUsablePoint(from) || !isUsablePoint(to)) return null;
  return haversineDistanceMeters(from, to);
}

/**
 * Estimate one mode's route distance and duration between two points.
 *
 * Returns `null` when either point is unusable, so the view can show 「—」
 * instead of an invented number. Minutes are floored at 1: any distance takes
 * *some* time, and a 0 would read as "you are already there".
 */
export function estimateTravel(
  from: GeoPoint | null | undefined,
  to: GeoPoint | null | undefined,
  mode: TravelMode,
): TravelEstimate | null {
  const straightMeters = straightLineMeters(from, to);
  if (straightMeters == null) return null;
  return estimateTravelFromDistance(straightMeters, mode);
}

/**
 * Same estimate as {@link estimateTravel} but from an already-known straight-line
 * distance — used when one distance feeds every mode, so the haversine runs once
 * per pair instead of once per mode.
 */
export function estimateTravelFromDistance(
  straightMeters: number,
  mode: TravelMode,
): TravelEstimate | null {
  if (!Number.isFinite(straightMeters) || straightMeters < 0) return null;
  const profile = TRAVEL_MODE_PROFILES[mode];
  const routeMeters = straightMeters * profile.detourFactor;
  const minutes = Math.max(
    1,
    Math.round(routeMeters / profile.metersPerMinute + profile.overheadMinutes),
  );
  return { mode, straightMeters, routeMeters, minutes };
}

/**
 * Estimates for every mode in {@link TRAVEL_MODES} order, or `[]` when the
 * points are unusable.
 *
 * The straight-line distance is computed once and shared, which also guarantees
 * every row of the resulting table quotes the *same* `straightMeters` — a table
 * where the modes disagreed about how far away the place is would be worse than
 * no table.
 */
export function estimateTravelAllModes(
  from: GeoPoint | null | undefined,
  to: GeoPoint | null | undefined,
): TravelEstimate[] {
  const straightMeters = straightLineMeters(from, to);
  if (straightMeters == null) return [];
  const estimates: TravelEstimate[] = [];
  for (const mode of TRAVEL_MODES) {
    const estimate = estimateTravelFromDistance(straightMeters, mode);
    if (estimate) estimates.push(estimate);
  }
  return estimates;
}

/**
 * Human-readable distance, locale-independent: whole metres below 1 km, one
 * decimal in km above it. Matches the formatting the maps already use, so the
 * same place reads the same on the map and in the しおり.
 *
 * Negative or non-finite input yields an em dash — the same "unknown" marker the
 * screens use when there is no current location.
 */
export function formatDistanceMeters(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Minutes split into whole hours plus the remainder. */
export interface DurationParts {
  hours: number;
  minutes: number;
}

/**
 * Split a duration so the view can choose between its "{min}分" / "{h}時間{m}分"
 * / "{h}時間" i18n patterns without doing arithmetic in JSX.
 *
 * Non-finite or negative input collapses to zeroes rather than throwing; the
 * caller decides what to render for that (the しおり never asks, because it only
 * calls this with an estimate that already exists).
 */
export function splitDurationMinutes(minutes: number): DurationParts {
  if (!Number.isFinite(minutes) || minutes <= 0) return { hours: 0, minutes: 0 };
  const total = Math.round(minutes);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
