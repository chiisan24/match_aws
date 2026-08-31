/**
 * Pure, shared logic for settling interactive swipe candidates.
 *
 * This module is consumed by the API handler (`api/route-candidates.ts` via
 * `api/_fallback-candidates.ts`), the mock chat adapter and the client-side
 * final guard in `TourismRouteBuilder`. It therefore MUST stay free of DOM,
 * React, `import.meta` and environment-variable access: the only dependencies
 * allowed are types from `./types` and `haversineDistanceMeters` from
 * `./geofence`.
 */
import type {
  CandidateSource,
  GeoPoint,
  RouteCandidate,
  RouteCandidateKind,
} from "./types";
import { haversineDistanceMeters } from "./geofence";

export type { CandidateSource } from "./types";

/** Lower bound of the swipe candidate set (Minimum_Count). */
export const CANDIDATE_MINIMUM_COUNT = 5;
/** Upper bound of the swipe candidate set (Maximum_Count). */
export const CANDIDATE_MAXIMUM_COUNT = 8;
/** Base search radius (Base_Radius) in metres. */
export const CANDIDATE_BASE_RADIUS_METERS = 5_000;
/** Base radius plus the stepwise expansion radii, ascending by contract. */
export const CANDIDATE_RADII_METERS = [5_000, 10_000, 20_000] as const;

/** A single fallback source point: temples and spots normalised to one shape. */
export interface FallbackPoint {
  /** Stable id used as `place.id` (`temple-49` for temples, `Spot.id` for spots). */
  id: string;
  source: Exclude<CandidateSource, "primary">;
  name: string;
  location: GeoPoint;
  formattedAddress: string;
  /** Language code to description. Unlisted languages fall back to `ja`. */
  descriptions: Partial<Record<string, string>>;
  /**
   * Spot-derived only. Decides which kinds a point may stand in for — see
   * {@link isEligibleFallback}: `sightseeing` excludes food, `food` / `cafe`
   * accept nothing else.
   */
  category?: "sightseeing" | "food" | "souvenir" | "onsen";
  photoUrl?: string;
  websiteUri?: string;
}

/** The fallback inventory, split by data source. */
export interface FallbackPools {
  temples: FallbackPoint[];
  spots: FallbackPoint[];
}

/** Inputs that drive {@link finalizeCandidates}. */
export interface FinalizeContext {
  kind: RouteCandidateKind;
  lang: string;
  center: GeoPoint;
  /** Requested base radius (normally 5,000m). */
  baseRadiusMeters: number;
  /** Place ids already present in the current route. */
  usedPlaceIds: readonly string[];
  /** Upper bound of the candidate set (already clamped). */
  maximumCount: number;
  /** Lower bound of the candidate set. Defaults to {@link CANDIDATE_MINIMUM_COUNT}. */
  minimumCount?: number;
}

/** The settled candidate set plus the radius and minimum count that produced it. */
export interface FinalizeResult {
  candidates: RouteCandidate[];
  /** Radius actually applied when the candidate set was settled. */
  appliedRadiusMeters: number;
  /** Minimum count used for the shortage decision. */
  minimumCount: number;
}

/**
 * Clamps a requested candidate count into `[minimum, CANDIDATE_MAXIMUM_COUNT]`.
 *
 * Non-numeric, NaN and negative inputs fall back to `fallback` (itself clamped),
 * fractional values are floored, and integers already inside the range are
 * returned unchanged.
 */
export function clampCandidateCount(
  value: unknown,
  fallback: number,
  minimum: number = CANDIDATE_MINIMUM_COUNT,
): number {
  const lowerBound = Number.isFinite(minimum)
    ? Math.min(Math.max(Math.floor(minimum), 0), CANDIDATE_MAXIMUM_COUNT)
    : CANDIDATE_MINIMUM_COUNT;
  const clamp = (candidate: number): number =>
    Math.min(Math.max(Math.floor(candidate), lowerBound), CANDIDATE_MAXIMUM_COUNT);
  const safeFallback = Number.isFinite(fallback) && fallback >= 0 ? clamp(fallback) : lowerBound;

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return safeFallback;
  }
  return clamp(value);
}

/**
 * Picks the i18n key and interpolation value for a distance from the area centre.
 *
 * Under 1,000m the distance is reported as whole metres, at or above 1,000m as
 * kilometres with one decimal place. Rendering is left to the caller's `t()`:
 * only the key and the `{value}` substitution are returned here. Non-finite or
 * negative inputs are treated as 0m.
 */
export function centerDistanceLabel(meters: number): {
  key: "routeBuilder.distanceMeters" | "routeBuilder.distanceKilometers";
  value: string;
} {
  const safeMeters = Number.isFinite(meters) && meters > 0 ? meters : 0;
  if (safeMeters < 1_000) {
    return { key: "routeBuilder.distanceMeters", value: String(Math.round(safeMeters)) };
  }
  return {
    key: "routeBuilder.distanceKilometers",
    value: (safeMeters / 1_000).toFixed(1),
  };
}

/** Resolves the effective lower bound, defaulting to {@link CANDIDATE_MINIMUM_COUNT}. */
function resolveMinimumCount(minimumCount: number | undefined): number {
  if (typeof minimumCount !== "number" || !Number.isFinite(minimumCount) || minimumCount < 0) {
    return CANDIDATE_MINIMUM_COUNT;
  }
  return Math.floor(minimumCount);
}

/** Resolves the effective upper bound, defaulting to {@link CANDIDATE_MAXIMUM_COUNT}. */
function resolveMaximumCount(maximumCount: number): number {
  if (!Number.isFinite(maximumCount) || maximumCount < 0) {
    return CANDIDATE_MAXIMUM_COUNT;
  }
  return Math.floor(maximumCount);
}

/**
 * Settles the candidate set: keeps every Primary candidate that is not already
 * on the route (order preserved, duplicate `place.id` dropped, truncated at
 * `maximumCount`), then tops the set up from the local fallback pools while
 * stepping the radius outwards.
 *
 * Which pool entries may stand in is decided per kind by
 * {@link isEligibleFallback}. `food` and `cafe` used to return here empty-handed,
 * which is why a lunch deck could come back with two cards while the 観光 deck
 * beside it always filled: the primary source is the model naming at most six
 * restaurants, and every one that failed its Places lookup simply vanished.
 *
 * `custom` is the one kind that still never receives fallbacks — the request is
 * free text, so padding it from a local pool would answer a question the
 * traveller did not ask.
 */
export function finalizeCandidates(
  primary: readonly RouteCandidate[],
  context: FinalizeContext,
  pools: FallbackPools,
): FinalizeResult {
  const minimum = resolveMinimumCount(context.minimumCount);
  const maximum = resolveMaximumCount(context.maximumCount);
  const seen = new Set<string>(context.usedPlaceIds);
  const candidates: RouteCandidate[] = [];

  for (const candidate of primary) {
    if (candidates.length >= maximum) {
      break;
    }
    const placeId = candidate.place.id;
    if (seen.has(placeId)) {
      continue;
    }
    seen.add(placeId);
    candidates.push(candidate);
  }

  if (context.kind === "custom") {
    return {
      candidates,
      appliedRadiusMeters: context.baseRadiusMeters,
      minimumCount: minimum,
    };
  }

  // Fallback top-up and stepwise radius expansion happen from here on, appending
  // to `candidates`, so Primary candidates always precede fallback candidates.
  const target = Math.min(maximum, minimum);
  const pool = [...pools.temples, ...pools.spots];
  const radii = CANDIDATE_RADII_METERS.filter((radius) => radius >= context.baseRadiusMeters);
  let appliedRadiusMeters = context.baseRadiusMeters;

  for (const radius of radii) {
    appliedRadiusMeters = radius;
    if (candidates.length < target) {
      const eligible = pool
        .flatMap((point) => {
          if (seen.has(point.id)) {
            return [];
          }
          if (!isEligibleFallback(point, context.kind)) {
            return [];
          }
          const distance = distanceFromCenter(context.center, point);
          if (distance === null || distance > radius) {
            return [];
          }
          return [{ point, distance }];
        })
        .sort((a, b) =>
          a.distance === b.distance
            ? compareIds(a.point.id, b.point.id)
            : a.distance - b.distance,
        );

      for (const { point } of eligible) {
        if (candidates.length >= target) {
          break;
        }
        seen.add(point.id);
        candidates.push(toCandidate(point, context.kind, context.lang));
      }
    }
    if (candidates.length >= minimum) {
      break;
    }
  }

  return { candidates, appliedRadiusMeters, minimumCount: minimum };
}

/** True when a pool entry is a食事どころ from the spot catalogue. */
function isFoodPoint(point: FallbackPoint): boolean {
  return point.source === "spot" && point.category === "food";
}

/**
 * Whether a pool entry may stand in for this candidate kind.
 *
 * - `sightseeing`: temples and non-food spots. A restaurant is not a sight.
 * - `food` / `cafe`: food spots only. A 札所 is not lunch.
 * - `custom`: never reaches here — {@link finalizeCandidates} returns first.
 *
 * `cafe` accepting any food spot is a deliberate approximation: the catalogue
 * maps OSM's `restaurant`, `cafe` and `fast_food` all to a single `food`
 * category, so the pool cannot tell a coffee house from a ramen shop. The card
 * shows the real name either way, so nothing misrepresents the place, and a deck
 * with two cards is worse than one with five.
 */
function isEligibleFallback(point: FallbackPoint, kind: RouteCandidateKind): boolean {
  if (kind === "food" || kind === "cafe") {
    return isFoodPoint(point);
  }
  return !isFoodPoint(point);
}

/** Distance from the area centre, or `null` when the point has no usable location. */
function distanceFromCenter(center: GeoPoint, point: FallbackPoint): number | null {
  const { location } = point;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return null;
  }
  const distance = haversineDistanceMeters(center, location);
  return Number.isFinite(distance) ? distance : null;
}

/** Deterministic tie-break so equal distances never depend on pool order. */
function compareIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/**
 * Returns a non-empty description for a fallback point that carries no localized
 * text, so `description` is never empty (Req 2.5).
 *
 * Temple points read as "第49番札所 浄土寺をお参りできます。" because the pool
 * already stores the full "第{n}番札所 {寺名}" form in `name`; spot points reuse
 * the wording of the existing mock candidates.
 */
function defaultDescription(point: FallbackPoint): string {
  const name = point.name.trim();
  if (point.source === "temple") {
    return name ? `${name}をお参りできます。` : "お遍路の札所をお参りできます。";
  }
  return name ? `${name}を楽しめるスポットです。` : "立ち寄って楽しめるスポットです。";
}

/** First non-blank description among the requested language, Japanese, default. */
function resolveDescription(point: FallbackPoint, lang: string): string {
  const localized = point.descriptions[lang];
  if (typeof localized === "string" && localized.trim().length > 0) {
    return localized;
  }
  const japanese = point.descriptions.ja;
  if (typeof japanese === "string" && japanese.trim().length > 0) {
    return japanese;
  }
  return defaultDescription(point);
}

/**
 * Converts a fallback point into a route candidate with the same shape as a
 * Primary candidate (Req 2.4): a `{kind}:{source}:{id}` id, a guaranteed
 * non-empty description, the `source` discriminator (Req 2.6), and optional
 * place fields only when present.
 */
function toCandidate(
  point: FallbackPoint,
  kind: RouteCandidateKind,
  lang: string,
): RouteCandidate {
  return {
    id: `${kind}:${point.source}:${point.id}`,
    kind,
    title: point.name,
    description: resolveDescription(point, lang),
    searchQuery: point.name,
    source: point.source,
    place: {
      id: point.id,
      name: point.name,
      formattedAddress: point.formattedAddress,
      location: point.location,
      ...(point.photoUrl ? { photoUrl: point.photoUrl } : {}),
      ...(point.websiteUri ? { websiteUri: point.websiteUri } : {}),
    },
  };
}
