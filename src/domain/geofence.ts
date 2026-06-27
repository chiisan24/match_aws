/**
 * Pure geofence containment check for 札所到着判定 (Req 13.1 / Property 23).
 *
 * Uses the haversine great-circle distance. No I/O.
 */

import type { GeoPoint, Geofence } from "./types";

/** Mean Earth radius in metres (used by the haversine formula). */
const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points in metres (haversine).
 *
 * Exported so the geofence threshold can be tested directly. Always returns a
 * finite, non-negative number for finite inputs.
 */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  // Clamp to [0, 1] to guard against tiny floating-point overshoot before asin.
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Return whether point `p` lies inside the geofence (Req 13.1).
 *
 * Guarantees (Property 23): the point is "inside" iff its distance from the
 * fence centre is less than or equal to the radius. The centre is therefore
 * always inside (distance 0), and any point beyond the radius is outside.
 */
export function isInsideGeofence(p: GeoPoint, fence: Geofence): boolean {
  return haversineDistanceMeters(p, fence.center) <= fence.radiusMeters;
}
