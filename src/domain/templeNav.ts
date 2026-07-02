/**
 * Local (offline) heuristic for the 次の札所ナビ figures — the guaranteed
 * fallback behind the AI estimate (Req: AI 算出 / 目安・参考情報).
 *
 * Pure and total: given a start point and a target it returns rough distance
 * and travel-time numbers derived from the great-circle distance, scaled by a
 * road-detour factor so the values read like a realistic road estimate rather
 * than a straight-line minimum. When the start point is unknown every figure is
 * `null` (the UI renders an em dash). These are estimates only — every caller
 * must present them with a disclaimer.
 */

import { haversineDistanceMeters } from "./geofence";
import type { GeoPoint } from "./types";

/** Assumed average driving speed for estimates (~36 km/h). */
const CAR_METERS_PER_MIN = 600;
/** Assumed average walking speed for estimates (~4.5 km/h). */
const WALK_METERS_PER_MIN = 75;
/**
 * Rough multiplier turning a straight-line distance into a road distance.
 * Real roads wind, so the driven/walked distance is longer than the crow-flies
 * distance; 1.3 is a common, deliberately conservative approximation.
 */
const ROAD_DETOUR_FACTOR = 1.3;

/** The numeric portion of a next-temple navigation estimate. */
export interface LocalNavNumbers {
  /** Estimated road distance in kilometers (one decimal), or null if unknown. */
  distanceKm: number | null;
  /** Estimated driving time in minutes (≥1), or null if unknown. */
  carMinutes: number | null;
  /** Estimated walking time in minutes (≥1), or null if unknown. */
  walkMinutes: number | null;
}

/**
 * Estimate distance and travel times from `from` to `to`. Returns all-null when
 * `from` is null (start point unknown). Never throws.
 */
export function estimateLocalTempleNav(
  from: GeoPoint | null,
  to: GeoPoint,
): LocalNavNumbers {
  if (from == null) {
    return { distanceKm: null, carMinutes: null, walkMinutes: null };
  }

  const straightMeters = haversineDistanceMeters(from, to);
  const roadMeters = straightMeters * ROAD_DETOUR_FACTOR;

  return {
    distanceKm: Math.round((roadMeters / 1000) * 10) / 10,
    carMinutes: Math.max(1, Math.round(roadMeters / CAR_METERS_PER_MIN)),
    walkMinutes: Math.max(1, Math.round(roadMeters / WALK_METERS_PER_MIN)),
  };
}

/**
 * Strips development-only markers (e.g. the "（モックデータ）" suffix on the mock
 * temple dataset) from an address so a placeholder tag never surfaces in the
 * UI. Returns a trimmed address, or an empty string when nothing usable remains.
 * Pure and total.
 */
export function cleanTempleAddress(address: string | undefined): string {
  if (!address) return "";
  return address
    // Full-width or half-width parenthesised "モックデータ" / "mock data" notes.
    .replace(/[（(]\s*(?:モックデータ|mock\s*data)\s*[)）]/gi, "")
    .trim();
}
