/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Regenerate with: node scripts/build-api-shared.mjs
 *
 * Bundled so the Vercel function build has no `../src/` specifier to
 * resolve; see scripts/build-api-shared.mjs for why that mattered.
 *
 * Sources (sha256 c88620c1228352a0):
 *   src/adapters/mock/ehime-food.curated.ts
 *   src/adapters/mock/ehime-spots.generated.ts
 *   src/adapters/mock/spots.ts
 *   src/data/fallbackPools.ts
 *   src/data/templeDetails.ts
 *   src/data/templeGeo.ts
 *   src/domain/candidateFallback.ts
 *   src/domain/geofence.ts
 */

/** Origin of a route candidate. Mirrors `CandidateSource` in src/domain/types.ts. */
export type CandidateSource = "primary" | "temple" | "spot";

/** Mirrors `RouteCandidateKind` in src/domain/types.ts. */
export type RouteCandidateKind = "sightseeing" | "food" | "cafe" | "custom";

/** Mirrors `GeoPoint` in src/domain/types.ts. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Mirrors `RecommendedPlace` in src/domain/types.ts, which is also the shape of
 * `EnrichedPlace` in api/_google-places.ts.
 */
export interface CandidatePlace {
  id: string;
  name: string;
  formattedAddress: string;
  location?: GeoPoint;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: string[];
  photoUrl?: string;
  photoAttributions?: Array<{ displayName: string; uri?: string }>;
}

/** Mirrors `RouteCandidate` in src/domain/types.ts. */
export interface RouteCandidate {
  id: string;
  kind: RouteCandidateKind;
  title: string;
  description: string;
  searchQuery: string;
  /** Omitted means primary (Google-verified). Fallbacks use "temple" / "spot". */
  source?: CandidateSource;
  place: CandidatePlace & { location: GeoPoint };
}

/** A single fallback source point: temples and spots normalised to one shape. */
export interface FallbackPoint {
  id: string;
  source: Exclude<CandidateSource, "primary">;
  name: string;
  location: GeoPoint;
  formattedAddress: string;
  /** Language code to description. Unlisted languages fall back to `ja`. */
  descriptions: Partial<Record<string, string>>;
  /** Spot-derived only. Used to exclude food spots for `sightseeing`. */
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

/** Lower bound of the swipe candidate set (Minimum_Count). */
export declare const CANDIDATE_MINIMUM_COUNT: 5;
/** Upper bound of the swipe candidate set (Maximum_Count). */
export declare const CANDIDATE_MAXIMUM_COUNT: 8;
/** Base search radius (Base_Radius) in metres. */
export declare const CANDIDATE_BASE_RADIUS_METERS: 5000;
/** Base radius plus the stepwise expansion radii, ascending by contract. */
export declare const CANDIDATE_RADII_METERS: readonly [5000, 10000, 20000];

/** Clamps a requested candidate count into `[minimum, CANDIDATE_MAXIMUM_COUNT]`. */
export declare function clampCandidateCount(
  value: unknown,
  fallback: number,
  minimum?: number,
): number;

/** Settles the candidate set, topping `sightseeing` up from the fallback pools. */
export declare function finalizeCandidates(
  primary: readonly RouteCandidate[],
  context: FinalizeContext,
  pools: FallbackPools,
): FinalizeResult;

/** The default Fallback inventory used by every Candidate_Provider. */
export declare const DEFAULT_FALLBACK_POOLS: FallbackPools;
