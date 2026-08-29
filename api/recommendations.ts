import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorDetail } from "./_aws.js";
import { extractJson, invokeClaude } from "./_bedrock.js";
import { searchEhimePlace, type EnrichedPlace } from "./_google-places.js";
import {
  isItineraryPlan,
  isTourismRecommendations,
  ITINERARY_PLAN_COUNT as PLAN_COUNT,
  itineraryPlanViolations,
  RECOMMENDATION_FALLBACK_PLANS,
} from "./_recommendation-fallback.js";

interface RawStop {
  time?: unknown;
  kind?: unknown;
  title?: unknown;
  description?: unknown;
  searchQuery?: unknown;
}

type StopKind = "sightseeing" | "food" | "cafe" | "custom";

interface RawPlan {
  id?: unknown;
  mode?: unknown;
  icon?: unknown;
  title?: unknown;
  summary?: unknown;
  reason?: unknown;
  duration?: unknown;
  transport?: unknown;
  intensity?: unknown;
  stops?: unknown;
}

interface RecommendationExclusion {
  id: string;
  title: string;
  place: string;
  placeId?: string;
}

class InvalidRequestError extends Error {}

/**
 * Generation errors that a retry may fix but that Bedrock did not cause: the
 * reply arrived and simply failed the itinerary contract. Keeping it apart from
 * the transport errors of `invokeClaude` is what lets a degraded response name
 * `contract` rather than `bedrock` as its cause.
 */
class ContractViolationError extends Error {}

interface PlanStop {
  time: string;
  kind: StopKind;
  title: string;
  description: string;
  searchQuery: string;
  place?: EnrichedPlace;
}

/** Provenance of a plan in the response. */
type PlanOrigin = "ai" | "cache" | "fallback";

/** Why a response had to be degraded. Logged with the origin breakdown. */
type DegradedCause = "bedrock" | "contract" | "enrichment";

interface RecommendationPlan {
  id: string;
  mode: "tourism";
  icon: string;
  title: string;
  summary: string;
  reason: string;
  duration: string;
  transport: string;
  intensity: string;
  imageUrl?: string;
  imageAttributions?: EnrichedPlace["photoAttributions"];
  area?: { center: { lat: number; lng: number }; radiusMeters: number };
  stops: PlanStop[];
  /** Omitted until synthesis assigns one. */
  origin?: PlanOrigin;
}

/** Result of one or more generation attempts. */
interface GenerationOutcome {
  /** Verified plans, in the model's original order. */
  verified: RecommendationPlan[];
  /** Absent when {@link verified} reached Plan_Count. */
  cause?: DegradedCause;
  /** Failure summary for the log line and the 502 body. */
  detail?: string;
  /** `true` for a Fatal_Failure, which must not be retried. */
  fatal?: boolean;
}

/** The response payload after synthesis. */
interface ComposedResult {
  plans: RecommendationPlan[];
  degraded: boolean;
  counts: Record<PlanOrigin, number>;
  detail?: string;
}

/**
 * Fallback_Plan_Pool as seen by this handler.
 *
 * `ItineraryPlan` is structurally the same shape as {@link RecommendationPlan},
 * so the shared pool needs no conversion here.
 */
const FALLBACK_PLANS: RecommendationPlan[] = RECOMMENDATION_FALLBACK_PLANS;

function text(value: unknown, field: string, max = 240): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContractViolationError(`Bedrock recommendation is missing ${field}.`);
  }
  return value.trim().slice(0, max);
}

function requiredField(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidRequestError(`exclude[].${field} must be a non-empty string`);
  }
  return value.trim().slice(0, max);
}

function optionalField(value: unknown, field: string, max: number): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidRequestError(`exclude[].${field} must be a non-empty string when present`);
  }
  return value.trim().slice(0, max);
}

/**
 * Strictly validates the caller-provided exclusion list. A malformed `exclude`
 * is rejected instead of silently dropped so callers cannot believe a refresh
 * excluded past themes when it did not.
 */
function parseExclusions(value: unknown): RecommendationExclusion[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new InvalidRequestError("exclude must be an array");
  }
  if (value.length > 10) {
    throw new InvalidRequestError("exclude must contain at most 10 entries");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new InvalidRequestError("exclude[] entries must be objects");
    }
    const raw = item as {
      id?: unknown;
      title?: unknown;
      place?: unknown;
      placeId?: unknown;
    };
    const placeId = optionalField(raw.placeId, "placeId", 200);
    return {
      id: requiredField(raw.id, "id", 80),
      title: requiredField(raw.title, "title", 120),
      place: requiredField(raw.place, "place", 120),
      ...(placeId ? { placeId } : {}),
    };
  });
}

function comparisonKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/**
 * Collision signals of one plan.
 *
 * The five normalized keys are what the comparisons run on. {@link PlanKeys.raw}
 * carries the pre-normalization strings alongside them purely so reason strings
 * read the same way `duplicateReasons` used to write them into the log.
 */
interface PlanKeys {
  id: string;
  title: string;
  place: string;
  placeName: string;
  placeId: string;
  /** Original values, used only to build reason strings. */
  raw: { id: string; title: string; place: string; placeName: string };
}

function planKeys(plan: RecommendationPlan): PlanKeys {
  const searchQuery = plan.stops[0]?.searchQuery ?? "";
  const placeName = plan.stops[0]?.place?.name ?? "";
  return {
    id: comparisonKey(plan.id),
    title: comparisonKey(plan.title),
    place: comparisonKey(searchQuery),
    // Google's canonical name and id are the only表記揺れ-proof signals, so they
    // are compared once enrichment has resolved the representative place.
    placeName: comparisonKey(placeName),
    placeId: plan.stops[0]?.place?.id ?? "",
    raw: { id: plan.id, title: plan.title, place: searchQuery, placeName },
  };
}

/**
 * Keys of the plans already accepted into a response. Only the three signals
 * that make two plans the same plan are tracked (Requirements 2.4-2.6); a
 * shared area query is not one of them.
 */
interface SeenKeys {
  ids: Set<string>;
  titles: Set<string>;
  placeIds: Set<string>;
}

/**
 * Keys named by the Exclusion_List. `place` and `placeName` share one set
 * because a caller's `place` string may be either the query it swiped on or the
 * canonical name Google resolved for it.
 */
interface ExcludedKeys {
  ids: Set<string>;
  titles: Set<string>;
  places: Set<string>;
  placeIds: Set<string>;
}

function excludedKeys(exclusions: readonly RecommendationExclusion[]): ExcludedKeys {
  return {
    ids: new Set(exclusions.map((item) => comparisonKey(item.id)).filter(Boolean)),
    titles: new Set(exclusions.map((item) => comparisonKey(item.title)).filter(Boolean)),
    places: new Set(exclusions.map((item) => comparisonKey(item.place)).filter(Boolean)),
    placeIds: new Set(exclusions.map((item) => item.placeId ?? "").filter(Boolean)),
  };
}

/**
 * Splits collisions into the two decisions the caller needs: `duplicate`
 * always rejects (Requirements 2.4-2.6), `excluded` only rejects while enough
 * non-excluded candidates remain (Requirement 2.7). The asymmetry in signals is
 * deliberate — duplication is judged on 3, exclusion on 5.
 */
function collisionReasons(
  keys: PlanKeys,
  seen: SeenKeys,
  excluded: ExcludedKeys,
): { duplicate: string[]; excluded: string[] } {
  const duplicate: string[] = [];
  const excludedReasons: string[] = [];

  if (keys.id && seen.ids.has(keys.id)) duplicate.push(`id:${keys.raw.id}`);
  if (keys.title && seen.titles.has(keys.title)) duplicate.push(`title:${keys.raw.title}`);
  if (keys.placeId && seen.placeIds.has(keys.placeId)) duplicate.push(`placeId:${keys.placeId}`);

  if (keys.id && excluded.ids.has(keys.id)) excludedReasons.push(`id:${keys.raw.id}`);
  if (keys.title && excluded.titles.has(keys.title)) {
    excludedReasons.push(`title:${keys.raw.title}`);
  }
  if (keys.place && excluded.places.has(keys.place)) {
    excludedReasons.push(`place:${keys.raw.place}`);
  }
  if (keys.placeName && excluded.places.has(keys.placeName)) {
    excludedReasons.push(`placeName:${keys.raw.placeName}`);
  }
  if (keys.placeId && excluded.placeIds.has(keys.placeId)) {
    excludedReasons.push(`placeId:${keys.placeId}`);
  }
  return { duplicate, excluded: excludedReasons };
}

/** Registers an accepted plan so that later candidates collide with it. */
function remember(keys: PlanKeys, seen: SeenKeys): void {
  if (keys.id) seen.ids.add(keys.id);
  if (keys.title) seen.titles.add(keys.title);
  if (keys.placeId) seen.placeIds.add(keys.placeId);
}

/** Order the origins appear in the response (Requirement 1.2). */
const ORIGIN_RANK: Record<PlanOrigin, number> = { ai: 0, cache: 1, fallback: 2 };

/**
 * Fills the response with {@link PLAN_COUNT} plans: the verified ones first,
 * topped up from the retained cache and then the Fallback_Plan_Pool
 * (Requirements 1.2, 4.3, 4.4).
 *
 * Acceptance runs in two sweeps. The first one passes over candidates the caller
 * excluded; the second one admits them, and because a candidate skipped for
 * exclusion is never registered in `seen`, it is still available to be picked
 * up. Count therefore wins over exclusion only when it has to (Requirement 2.7),
 * while the response order stays ai → cache → fallback because the accepted
 * plans are re-sorted by origin afterwards.
 *
 * `origin` is stamped on every plan, not just on the degraded ones Requirement
 * 1.3 asks for, so that the response always carries the breakdown `degraded`
 * summarises.
 *
 * Named for the test suite; Vercel only reads this module's default export. May
 * return fewer than {@link PLAN_COUNT} plans when the pools run dry — answering
 * that with a 502 is the caller's call (Requirement 1.6).
 */
export function composeRecommendations(input: {
  verified: readonly RecommendationPlan[];
  cached: readonly RecommendationPlan[];
  fallback: readonly RecommendationPlan[];
  exclusions: readonly RecommendationExclusion[];
}): ComposedResult {
  const candidates = [
    ...input.verified.map((plan) => ({ plan, origin: "ai" as const })),
    ...input.cached.map((plan) => ({ plan, origin: "cache" as const })),
    ...input.fallback.map((plan) => ({ plan, origin: "fallback" as const })),
    // Requirement 2.2: a plan that breaks the contract is no candidate at all,
    // whichever pool it came from.
  ].filter(({ plan }) => isItineraryPlan(plan));

  const excluded = excludedKeys(input.exclusions);
  const seen: SeenKeys = {
    ids: new Set<string>(),
    titles: new Set<string>(),
    placeIds: new Set<string>(),
  };
  const accepted: Array<{
    plan: RecommendationPlan;
    origin: PlanOrigin;
    order: number;
  }> = [];

  const sweep = (allowExcluded: boolean): void => {
    for (const candidate of candidates) {
      if (accepted.length >= PLAN_COUNT) return;
      const keys = planKeys(candidate.plan);
      const reasons = collisionReasons(keys, seen, excluded);
      // Requirements 2.4-2.6: a duplicate is rejected in both sweeps.
      if (reasons.duplicate.length > 0) continue;
      if (!allowExcluded && reasons.excluded.length > 0) continue;
      remember(keys, seen);
      accepted.push({ ...candidate, order: accepted.length });
    }
  };
  // Requirement 2.7: prefer candidates the caller did not exclude, then top up
  // with excluded ones only while the response is still short of Plan_Count.
  sweep(false);
  sweep(true);

  // Requirement 1.2: ai → cache → fallback, input order kept within an origin.
  accepted.sort((a, b) => ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin]
    || a.order - b.order);

  const plans = accepted.map(({ plan, origin }) => ({ ...plan, origin }));
  const counts: Record<PlanOrigin, number> = { ai: 0, cache: 0, fallback: 0 };
  for (const { origin } of accepted) counts[origin] += 1;
  // Requirements 1.4, 1.5, 4.6: degraded iff a plan came from somewhere else
  // than this request's own generation.
  return { plans, degraded: counts.cache + counts.fallback > 0, counts };
}

function slug(value: unknown, index: number): string {
  const normalized = typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
    : "";
  return normalized.replace(/^-|-$/g, "").slice(0, 48) || `ehime-trip-${index + 1}`;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const STOP_KINDS = new Set<StopKind>(["sightseeing", "food", "cafe", "custom"]);
const FALLBACK_TIMES = ["09:00", "11:00", "13:00", "15:00"] as const;

function normalizeKind(value: unknown): StopKind {
  if (typeof value !== "string" || !STOP_KINDS.has(value as StopKind)) {
    throw new ContractViolationError("Bedrock recommendation is missing stop.kind.");
  }
  return value as StopKind;
}

function normalizeStop(value: unknown, index: number): PlanStop {
  if (!value || typeof value !== "object") {
    throw new ContractViolationError("Bedrock returned an invalid recommendation stop.");
  }
  const stop = value as RawStop;
  const proposedTime = typeof stop.time === "string" ? stop.time.trim() : "";
  return {
    time: TIME_PATTERN.test(proposedTime)
      ? proposedTime
      : FALLBACK_TIMES[index] ?? FALLBACK_TIMES[FALLBACK_TIMES.length - 1],
    kind: normalizeKind(stop.kind),
    title: text(stop.title, "stop.title", 100),
    description: text(stop.description, "stop.description", 240),
    searchQuery: text(stop.searchQuery ?? stop.title, "stop.searchQuery", 120),
  };
}

function normalizePlan(value: unknown, index: number): RecommendationPlan {
  if (!value || typeof value !== "object") {
    throw new ContractViolationError("Bedrock returned an invalid recommendation plan.");
  }
  const plan = value as RawPlan;
  const rawStops = Array.isArray(plan.stops) ? plan.stops : [];
  if (rawStops.length < 2 || rawStops.length > 4) {
    throw new ContractViolationError(
      "Each itinerary must contain between two and four stops.",
    );
  }
  const stops = rawStops.map(normalizeStop);
  if (stops.some((stop, stopIndex) => stopIndex > 0 && stop.time <= stops[stopIndex - 1].time)) {
    stops.forEach((stop, stopIndex) => {
      stop.time = FALLBACK_TIMES[stopIndex];
    });
  }
  return {
    id: slug(plan.id, index),
    mode: "tourism",
    icon: text(plan.icon, "icon", 8),
    title: text(plan.title, "title", 120),
    summary: text(plan.summary, "summary", 240),
    reason: text(plan.reason, "reason", 320),
    duration: text(plan.duration, "duration", 40),
    transport: text(plan.transport, "transport", 40),
    intensity: text(plan.intensity, "intensity", 40),
    stops,
  };
}

const MAX_PLACES_CONCURRENCY = 4;
const ITINERARY_RADIUS_METERS = 5_000;

type LocatedPlanStop = PlanStop & {
  place: EnrichedPlace & { location: { lat: number; lng: number } };
};

function isLocatedStop(stop: PlanStop): stop is LocatedPlanStop {
  return Number.isFinite(stop.place?.location?.lat)
    && Number.isFinite(stop.place?.location?.lng);
}

/**
 * Picks the anchor whose {@link ITINERARY_RADIUS_METERS} neighbourhood keeps the
 * most stops, preserving the model's visiting order. The prompt asks for one
 * compact area per itinerary, but a themed route ("Shimanto and Sadamisaki")
 * regularly spans the prefecture; anchoring on the first stop then discards
 * every other place. Taking the largest cluster instead salvages the usable
 * part of such an itinerary. Ties keep the earliest stop, so a well-behaved
 * itinerary still anchors on its first place.
 */
function largestNearbyCluster(stops: LocatedPlanStop[]): {
  anchor: { lat: number; lng: number };
  stops: LocatedPlanStop[];
} | null {
  let best: { anchor: { lat: number; lng: number }; stops: LocatedPlanStop[] } | null =
    null;
  for (const candidate of stops) {
    const anchor = candidate.place.location;
    const nearby = stops.filter(
      (stop) =>
        distanceMeters(anchor, stop.place.location) <= ITINERARY_RADIUS_METERS,
    );
    if (!best || nearby.length > best.stops.length) best = { anchor, stops: nearby };
  }
  return best;
}

function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRadians = (degrees: number): number => degrees * Math.PI / 180;
  const earthRadiusMeters = 6_371_000;
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toLat - fromLat;
  const deltaLng = toRadians(to.lng - from.lng);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function createTaskLimiter(maxConcurrency: number) {
  let active = 0;
  const pending: Array<() => void> = [];
  const startNext = (): void => {
    if (active >= maxConcurrency) return;
    const start = pending.shift();
    if (!start) return;
    active += 1;
    start();
  };
  return <T>(task: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    pending.push(() => {
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          startNext();
        });
    });
    startNext();
  });
}

/**
 * Re-resolves the stops that sit outside the anchor's area, keeping the model's
 * visiting order and rejecting duplicates. Returns the stops that are verified
 * and inside {@link ITINERARY_RADIUS_METERS} of the anchor.
 */
async function rescueStopsNearAnchor(
  enrichedStops: PlanStop[],
  cluster: { anchor: { lat: number; lng: number }; stops: LocatedPlanStop[] },
  findPlaceNear: (
    query: string,
    area: { center: { lat: number; lng: number }; radiusMeters: number },
  ) => Promise<EnrichedPlace | null>,
): Promise<LocatedPlanStop[]> {
  const area = { center: cluster.anchor, radiusMeters: ITINERARY_RADIUS_METERS };
  const keptPlaceIds = new Set(cluster.stops.map((stop) => stop.place.id));
  const candidates = await Promise.all(
    enrichedStops.map(async (stop): Promise<PlanStop> => {
      if (stop.place && keptPlaceIds.has(stop.place.id)) return stop;
      const place = await findPlaceNear(stop.searchQuery, area);
      return place ? { ...stop, place } : stop;
    }),
  );

  const seenPlaceIds = new Set<string>();
  return candidates.filter((stop): stop is LocatedPlanStop => {
    if (!isLocatedStop(stop) || seenPlaceIds.has(stop.place.id)) return false;
    if (distanceMeters(area.center, stop.place.location) > ITINERARY_RADIUS_METERS) {
      return false;
    }
    seenPlaceIds.add(stop.place.id);
    return true;
  });
}

/**
 * Outcome of enriching a single plan.
 *
 * `enrichPlans` reports shortages instead of throwing them, because the plans
 * are enriched concurrently: a rejection used to discard the four itineraries
 * that verified fine alongside the one that did not.
 */
type PlanEnrichment =
  | { status: "verified"; plan: RecommendationPlan }
  | { status: "insufficient"; planId: string; reason: string };

async function enrichPlans(
  plans: RecommendationPlan[],
  lang: string,
): Promise<PlanEnrichment[]> {
  const limit = createTaskLimiter(MAX_PLACES_CONCURRENCY);
  const cache = new Map<string, Promise<EnrichedPlace | null>>();
  const findPlace = (query: string): Promise<EnrichedPlace | null> => {
    const key = query.toLowerCase();
    const existing = cache.get(key);
    if (existing) return existing;
    const request = limit(() => searchEhimePlace(query, lang)).catch((error) => {
      console.error("Google Places enrichment failed", { query, error });
      return null;
    });
    cache.set(key, request);
    return request;
  };
  /**
   * Same lookup, biased towards an itinerary's anchor, used to pull a stop back
   * into the area when the unbiased match landed on the far side of the
   * prefecture (e.g. a common place name shared by several towns).
   */
  const findPlaceNear = (
    query: string,
    area: { center: { lat: number; lng: number }; radiusMeters: number },
  ): Promise<EnrichedPlace | null> => {
    const key = `${query.toLowerCase()}@${area.center.lat.toFixed(3)},${area.center.lng.toFixed(3)}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const request = limit(() => searchEhimePlace(query, lang, area)).catch((error) => {
      console.error("Google Places nearby enrichment failed", { query, error });
      return null;
    });
    cache.set(key, request);
    return request;
  };

  return Promise.all(
    plans.map(async (plan): Promise<PlanEnrichment> => {
      try {
        const enrichedStops = await Promise.all(
          plan.stops.map(async (stop) => {
            const place = await findPlace(stop.searchQuery);
            return place ? { ...stop, place } : stop;
          }),
        );
        const seenPlaceIds = new Set<string>();
        const verifiedStops = enrichedStops.filter((stop): stop is LocatedPlanStop => {
          if (!isLocatedStop(stop) || seenPlaceIds.has(stop.place.id)) return false;
          seenPlaceIds.add(stop.place.id);
          return true;
        });
        const cluster = largestNearbyCluster(verifiedStops);
        if (!cluster) {
          return { status: "insufficient", planId: plan.id, reason: "no verified stop" };
        }
        // One itinerary that cannot be pinned to a single area used to reject all
        // five recommendations, because the plans are enriched with Promise.all.
        // Retry the stops that fell outside the anchor's area with a biased search
        // first, which usually recovers the intended nearby place.
        const clusteredStops = cluster.stops.length < 2
          ? await rescueStopsNearAnchor(enrichedStops, cluster, findPlaceNear)
          : cluster.stops;
        if (clusteredStops.length < 2) {
          return {
            status: "insufficient",
            planId: plan.id,
            reason: "fewer than two verified stops within 5km",
          };
        }
        const stops = clusteredStops.slice(0, 4);
        const heroPlace = stops.map((stop) => stop.place).find((place) => place.photoUrl);
        return {
          status: "verified",
          plan: {
            ...plan,
            stops,
            area: { center: cluster.anchor, radiusMeters: ITINERARY_RADIUS_METERS },
            ...(heroPlace?.photoUrl ? { imageUrl: heroPlace.photoUrl } : {}),
            ...(heroPlace?.photoAttributions?.length
              ? { imageAttributions: heroPlace.photoAttributions }
              : {}),
          },
        };
      } catch (error) {
        // One plan's lookup must never discard the other four.
        return { status: "insufficient", planId: plan.id, reason: errorDetail(error) };
      }
    }),
  );
}

const RECOMMENDATION_SCHEMA = "itinerary-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;
/** Stale_Retention: how long an expired entry may still back a degraded reply. */
const STALE_RETENTION_MS = 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 60 * 1000;
const refreshAllowedAt = new Map<string, number>();

/**
 * A cached response with two lifetimes rather than one. Past {@link freshUntil}
 * the entry stops being an answer and becomes filler material: dropping it right
 * then is what left a failing generation with nothing but canned fallbacks.
 */
interface CacheEntry {
  plans: RecommendationPlan[];
  /** Until this instant the entry may be served as-is (Cache_TTL). */
  freshUntil: number;
  /** After this instant the entry is dropped (Stale_Retention). */
  staleUntil: number;
}

const recommendationCache = new Map<string, CacheEntry>();
const recommendationRequests = new Map<string, Promise<ComposedResult>>();

/** Drops entries past Stale_Retention. Expiry of Cache_TTL alone keeps them. */
function pruneRecommendationCache(now: number): void {
  for (const [key, entry] of recommendationCache) {
    if (entry.staleUntil <= now) recommendationCache.delete(key);
  }
}

/** The entry serveable as-is for this key, or `null` once Cache_TTL passed. */
function freshPlans(cacheKey: string, now: number): RecommendationPlan[] | null {
  const entry = recommendationCache.get(cacheKey);
  return entry && entry.freshUntil > now ? entry.plans : null;
}

/**
 * Retained cache plans usable as degraded filler, this key's entry first and
 * then other keys newest-first. A Stale_Cache_Entry always qualifies; a still
 * fresh entry of another key (or of this key during a refresh, where the fresh
 * entry is deliberately bypassed) is a strictly better filler than a canned
 * fallback, so it is included too.
 */
function cachedPlanCandidates(cacheKey: string, now: number): RecommendationPlan[] {
  return [...recommendationCache.entries()]
    .filter(([, entry]) => entry.staleUntil > now)
    .sort(([keyA, a], [keyB, b]) => Number(keyB === cacheKey) - Number(keyA === cacheKey)
      || b.freshUntil - a.freshUntil)
    .flatMap(([, entry]) => entry.plans);
}

function japanDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function recommendationPrompt(
  lang: string,
  exclusions: RecommendationExclusion[],
  retrying: boolean,
): string {
  return [
    "あなたは愛媛県専門の旅行プランナーです。",
    `基準日は ${japanDate()}。季節を意識した多様な日帰り旅行を提案してください。`,
    `表示文言は言語コード ${lang} で簡潔に書いてください。不明な場合は日本語にしてください。`,
    "愛媛県内に実在する場所を題材に、松山周辺に偏らない5つの具体的な日帰り旅程を作ってください。",
    "5件すべてmodeをtourismにし、地域・景色・文化・体験などテーマを重複させないでください。",
    "各旅程のstopsは、実在する観光地・飲食店・カフェなどを2〜4件含め、無理のない訪問順にしてください。",
    "各旅程の立寄先は最初の場所から概ね5km以内にまとめ、次画面で周辺スポットを選び直せるようにしてください。",
    "各stopのtimeは到着予定時刻を24時間制HH:MMで設定し、上から厳密な昇順にしてください。",
    "各stopのkindは観光地ならsightseeing、飲食店ならfood、カフェならcafe、その他の希望場所ならcustomにしてください。",
    ...(exclusions.length > 0 ? [
      "次の過去候補と同じID・旅行テーマ・代表スポットは提案しないでください。表現を変えただけの実質同一テーマも避けてください。",
      `除外する過去候補: ${JSON.stringify(exclusions)}`,
    ] : []),
    ...(retrying ? ["前回は除外候補または生成結果内で重複がありました。必ず異なる地域・テーマ・代表スポットで作り直してください。"] : []),
    "summary・reason・各descriptionは要点だけを短く書いてください。",
    "searchQueryはGoogle Mapsで一意に検索できる正式な場所名にしてください。住所やURLは作らないでください。",
    "営業時間・料金・イベント開催を断定しないでください。",
    "出力は次のJSONだけにしてください。説明やコードフェンスは禁止です。",
    '{"plans":[{"id":"lowercase-slug","mode":"tourism","icon":"絵文字1つ","title":"...","summary":"...","reason":"...","duration":"...","transport":"...","intensity":"...","stops":[{"time":"09:00","kind":"sightseeing","title":"...","description":"...","searchQuery":"実在する施設名"},{"time":"11:00","kind":"food","title":"...","description":"...","searchQuery":"実在する施設名"}]}]}',
    "plansは必ずちょうど5件、各stopsは必ず2〜4件にしてください。",
  ].join("\n");
}

/**
 * One generation attempt, returning only the plans that passed Place_Enricher
 * verification and the itinerary contract.
 *
 * The result may hold fewer than {@link PLAN_COUNT} plans, or none at all: the
 * caller tops the response up from the cache and the Fallback_Plan_Pool instead
 * of failing the request. Only a reply that cannot yield a single usable plan
 * raises {@link ContractViolationError}, which a retry may still fix.
 */
async function generateRecommendations(
  lang: string,
  exclusions: RecommendationExclusion[],
  retrying: boolean,
): Promise<RecommendationPlan[]> {
  const output = await invokeClaude({
    system: recommendationPrompt(lang, exclusions, retrying),
    messages: [{ role: "user", text: "今日の愛媛旅行プランを時刻付きで5件生成してください。" }],
    maxTokens: 3500,
  });
  const parsed = extractJson<{ plans?: unknown }>(output);
  if (!Array.isArray(parsed?.plans) || parsed.plans.length !== PLAN_COUNT) {
    throw new ContractViolationError("Bedrock did not return exactly five recommendations.");
  }

  // Normalization is per plan so a single malformed itinerary costs one plan
  // rather than the whole reply.
  const normalized: RecommendationPlan[] = [];
  parsed.plans.forEach((rawPlan, index) => {
    try {
      normalized.push(normalizePlan(rawPlan, index));
    } catch (error) {
      console.warn("recommendations plan not normalized", {
        planIndex: index,
        reason: errorDetail(error),
      });
    }
  });
  if (normalized.length === 0) {
    throw new ContractViolationError("Bedrock returned no usable recommendation plan.");
  }

  const enrichments = await enrichPlans(normalized, lang);
  for (const result of enrichments) {
    if (result.status === "insufficient") {
      console.warn("recommendations plan not verified", {
        planId: result.planId,
        reason: result.reason,
      });
    }
  }
  return enrichments
    .filter((result): result is Extract<PlanEnrichment, { status: "verified" }> =>
      result.status === "verified")
    .map((result) => result.plan)
    // Requirement 2.2: never let a non-conforming plan reach the response.
    .filter((plan) => {
      const violations = itineraryPlanViolations(plan);
      if (violations.length === 0) return true;
      console.warn("recommendations plan violates contract", {
        planId: plan.id,
        violations,
      });
      return false;
    });
}

/**
 * Bedrock rejections that a retry cannot fix (bad request, missing/denied
 * credentials, unknown model). Throttling (429) and 5xx are worth another try,
 * and so is a reply that failed the itinerary contract, since generation is
 * stochastic.
 */
const FATAL_BEDROCK_STATUSES = new Set(["400", "401", "403", "404"]);
const FATAL_BEDROCK_ERROR_NAMES = new Set([
  "AccessDeniedException",
  "CredentialsProviderError",
  "ResourceNotFoundException",
  "UnrecognizedClientException",
  "ValidationException",
]);

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const messageStatus = message.match(/^Bedrock HTTP (\d{3})/)?.[1];
  const metadataStatus = error && typeof error === "object"
    ? String((error as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode ?? "")
    : "";
  const name = error && typeof error === "object"
    ? String((error as { name?: unknown }).name ?? "")
    : "";
  const status = messageStatus || metadataStatus;
  return !FATAL_BEDROCK_ERROR_NAMES.has(name)
    && (status === "" || !FATAL_BEDROCK_STATUSES.has(status));
}

/** Backoff_Delays, inserted before the 2nd and the 3rd attempt. */
const BACKOFF_DELAYS_MS = [300, 900] as const;

/** Maximum number of generation attempts, the first one included. */
const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Retry_Budget. A full generation takes ~35s, so only retry while enough of the
 * function's time budget is left for another attempt to finish. In practice that
 * retries the fast failures (throttling) and lets slow ones surface immediately
 * instead of turning one timeout into several.
 */
const RETRY_BUDGET_MS = 20_000;

/**
 * Retry timing indirection. Production waits for real time; the test suite
 * replaces `sleep` (and optionally `now`) so backoff assertions run instantly.
 * Vercel only reads this module's default export, so an extra named export is
 * safe here.
 */
export const recommendationTiming = {
  now: (): number => Date.now(),
  sleep: (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};

/**
 * One generation attempt, with its failure classified for the degraded-response
 * log (Requirement 1.8).
 *
 * A shortage of verified plans is reported as `enrichment` rather than thrown:
 * the plans that did verify are kept so the caller can top the response up.
 */
async function attemptGeneration(
  lang: string,
  exclusions: RecommendationExclusion[],
  retrying: boolean,
): Promise<GenerationOutcome> {
  try {
    const verified = await generateRecommendations(lang, exclusions, retrying);
    if (verified.length === PLAN_COUNT) return { verified };
    return {
      verified,
      cause: "enrichment",
      detail: `only ${verified.length} of ${PLAN_COUNT} plans were verified`,
    };
  } catch (error) {
    return {
      verified: [],
      cause: error instanceof ContractViolationError ? "contract" : "bedrock",
      detail: errorDetail(error),
      fatal: !isRetryable(error),
    };
  }
}

/**
 * Runs up to {@link MAX_GENERATION_ATTEMPTS} generations, waiting out
 * {@link BACKOFF_DELAYS_MS} before each retry.
 *
 * Never throws. An unexpected error is reported as a `bedrock` failure so the
 * caller can still synthesise a degraded response, which is what keeps the
 * screen selectable (Requirement 1.1).
 */
async function generateWithBackoff(
  lang: string,
  exclusions: RecommendationExclusion[],
): Promise<GenerationOutcome> {
  const startedAt = recommendationTiming.now();
  let outcome: GenerationOutcome = { verified: [] };
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    outcome = await attemptGeneration(lang, exclusions, attempt > 1);
    if (!outcome.cause) return outcome;
    // Place_Enricher shortage is not a Retryable_Failure: the verified plans
    // are kept and Requirement 4.3 tops the response up instead.
    if (outcome.cause === "enrichment") return outcome;
    if (outcome.fatal) {
      console.error("recommendations generation failed fatally", {
        attempt,
        cause: outcome.cause,
        detail: outcome.detail,
      });
      return outcome;
    }
    const elapsedMs = recommendationTiming.now() - startedAt;
    // Annotated because running past the last delay is only `undefined` at run
    // time; the tuple's type never admits it.
    const delayMs: number | undefined = BACKOFF_DELAYS_MS[attempt - 1];
    if (attempt === MAX_GENERATION_ATTEMPTS || delayMs === undefined) {
      console.warn("recommendations retries exhausted", {
        attempt,
        elapsedMs,
        cause: outcome.cause,
        detail: outcome.detail,
      });
      return outcome;
    }
    // Measured before the wait, so the budget gates the decision to retry
    // rather than the retry's own duration.
    if (elapsedMs > RETRY_BUDGET_MS) {
      console.warn("recommendations retry budget exhausted", {
        attempt,
        elapsedMs,
        cause: outcome.cause,
        detail: outcome.detail,
      });
      return outcome;
    }
    console.warn("recommendations retrying", {
      attempt,
      elapsedMs,
      delayMs,
      cause: outcome.cause,
      detail: outcome.detail,
    });
    await recommendationTiming.sleep(delayMs);
  }
  return outcome;
}

/**
 * Resolves the response for one request: a fresh cache hit, or a generation
 * topped up from the retained cache and the Fallback_Plan_Pool.
 *
 * Always resolves. A generation that yielded nothing still comes back with
 * {@link PLAN_COUNT} plans and `degraded: true` as long as either pool has
 * material (Requirements 1.1, 4.3, 4.4, 5.5).
 */
async function recommendationsFor(
  date: string,
  lang: string,
  schema: string,
  bypassCache: boolean,
  exclusions: RecommendationExclusion[],
): Promise<ComposedResult> {
  const now = Date.now();
  const cacheKey = `${schema}:${date}:${lang}`;
  pruneRecommendationCache(now);

  if (!bypassCache) {
    const fresh = freshPlans(cacheKey, now);
    // Only an `ai`-only response is ever stored, so a hit needs no synthesis.
    if (fresh) {
      return {
        plans: fresh,
        degraded: false,
        counts: { ai: fresh.length, cache: 0, fallback: 0 },
      };
    }
  }

  const requestKey = bypassCache
    ? `${cacheKey}:refresh:${JSON.stringify(exclusions)}`
    : cacheKey;
  const pending = recommendationRequests.get(requestKey);
  if (pending) return pending;

  const request = (async (): Promise<ComposedResult> => {
    try {
      const outcome = await generateWithBackoff(lang, exclusions);
      const composed = composeRecommendations({
        verified: outcome.verified,
        cached: cachedPlanCandidates(cacheKey, Date.now()),
        fallback: FALLBACK_PLANS,
        exclusions,
      });
      if (composed.degraded || composed.plans.length !== PLAN_COUNT) {
        // Requirement 1.8: one line carrying the cause and the origin mix.
        console.error("recommendations degraded", {
          cause: outcome.cause ?? "composition",
          detail: outcome.detail,
          origins: composed.counts,
          plans: composed.plans.length,
        });
      }
      // Requirement 1.9: a degraded response never becomes the shared default,
      // and neither does a refresh, which is tailored to one caller's exclusions.
      if (!bypassCache && !composed.degraded && composed.plans.length === PLAN_COUNT) {
        const storedAt = Date.now();
        recommendationCache.set(cacheKey, {
          plans: composed.plans,
          freshUntil: storedAt + CACHE_TTL_MS,
          staleUntil: storedAt + STALE_RETENTION_MS,
        });
      }
      return { ...composed, ...(outcome.detail ? { detail: outcome.detail } : {}) };
    } finally {
      recommendationRequests.delete(requestKey);
    }
  })();
  recommendationRequests.set(requestKey, request);
  return request;
}

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function refreshClientKey(req: VercelRequest): string {
  const forwarded = firstQueryValue(req.headers["x-forwarded-for"]);
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = firstQueryValue(req.headers["x-real-ip"]);
  return typeof realIp === "string" && realIp.trim() ? realIp.trim() : "unknown";
}

/**
 * Read-only check. Never consumes the caller's refresh slot: deciding and
 * reserving in one call is what turned a failed fetch into a 60 second block.
 */
function refreshWaitSeconds(req: VercelRequest, now: number): number {
  for (const [key, allowedAt] of refreshAllowedAt) {
    if (allowedAt <= now) refreshAllowedAt.delete(key);
  }
  const allowedAt = refreshAllowedAt.get(refreshClientKey(req)) ?? 0;
  return allowedAt > now ? Math.ceil((allowedAt - now) / 1000) : 0;
}

/**
 * Consumes the caller's refresh slot. Called only just before answering an
 * Intentional_Refresh with a Plan_Origin `ai`-only response, so a failed or
 * degraded attempt never blocks the next try (Requirements 6.2-6.4).
 */
function reserveRefresh(req: VercelRequest, now: number): void {
  refreshAllowedAt.set(refreshClientKey(req), now + REFRESH_INTERVAL_MS);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body ?? {}) as {
      lang?: unknown;
      count?: unknown;
      schema?: unknown;
      date?: unknown;
      exclude?: unknown;
    };
    const source = req.method === "GET" ? req.query : body;
    const rawLang = firstQueryValue(source.lang);
    const rawCount = firstQueryValue(source.count);
    const rawSchema = firstQueryValue(source.schema);
    const rawDate = firstQueryValue(source.date);
    const querySchema = firstQueryValue(req.query.schema);
    const queryDate = firstQueryValue(req.query.date);
    const lang = typeof rawLang === "string" ? rawLang.slice(0, 16) : "ja";
    if (rawSchema !== RECOMMENDATION_SCHEMA) {
      res.status(400).json({ error: `schema must be ${RECOMMENDATION_SCHEMA}` });
      return;
    }
    if (req.method === "POST" && querySchema != null && querySchema !== rawSchema) {
      res.status(400).json({ error: "Query and body schemas must match" });
      return;
    }
    if (req.method === "POST" && queryDate != null && queryDate !== rawDate) {
      res.status(400).json({ error: "Query and body dates must match" });
      return;
    }
    if (rawCount != null && Number(rawCount) !== PLAN_COUNT) {
      res.status(400).json({ error: "Exactly five recommendations are required" });
      return;
    }

    const currentDate = japanDate();
    const hasDate = typeof rawDate === "string" && rawDate !== "";
    const date = hasDate ? (rawDate as string) : currentDate;
    if (date !== currentDate) {
      res.status(400).json({ error: "The recommendation date must be today's JST date" });
      return;
    }

    const refresh = firstQueryValue(req.query.refresh) === "1";
    const bypassCache = req.method === "POST" || refresh;
    const exclusions = bypassCache ? parseExclusions(body.exclude) : [];
    if (bypassCache) {
      const retryAfter = refreshWaitSeconds(req, Date.now());
      if (retryAfter > 0) {
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("Retry-After", String(retryAfter));
        res.status(429).json({ error: "Please wait before refreshing recommendations" });
        return;
      }
    }
    const result = await recommendationsFor(
      date,
      lang,
      RECOMMENDATION_SCHEMA,
      bypassCache,
      exclusions,
    );

    // Requirement 2.2: the last check before the response leaves. Synthesis
    // already filters its candidates with `isItineraryPlan`, so this is a safety
    // net; when it trips, the violations name what broke and why the count fell
    // short (Requirement 1.6).
    if (result.plans.length !== PLAN_COUNT || !isTourismRecommendations(result.plans)) {
      console.error("recommendations contract violation", {
        plans: result.plans.length,
        detail: result.detail,
        violations: result.plans
          .map((plan) => ({ planId: plan.id, violations: itineraryPlanViolations(plan) }))
          .filter((entry) => entry.violations.length > 0),
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.status(502).json({
        error: "AI recommendations backend error",
        detail: result.detail
          ?? `Only ${result.plans.length} of ${PLAN_COUNT} plans satisfied the itinerary contract.`,
      });
      return;
    }

    // Requirement 1.7: a degraded response is never cached, anywhere. Shared
    // caching also requires the JST date in the URL; without it a CDN entry
    // would keep serving yesterday's picks under the same key.
    res.setHeader(
      "Cache-Control",
      result.degraded || bypassCache || !hasDate
        ? "private, no-store"
        : "public, s-maxage=900, stale-while-revalidate=86400",
    );
    // Requirements 6.2-6.4: the refresh slot is consumed here only, right before
    // an `ai`-only 200. The 405 / 400 / 429 / 502 paths never reach this line, so
    // a failed or degraded attempt leaves the next try unblocked.
    if (bypassCache && !result.degraded) reserveRefresh(req, Date.now());
    res.status(200).json({ plans: result.plans, degraded: result.degraded });
  } catch (error) {
    if (error instanceof InvalidRequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("recommendations error", error);
    res.status(502).json({
      error: "AI recommendations backend error",
      detail: errorDetail(error),
    });
  }
}