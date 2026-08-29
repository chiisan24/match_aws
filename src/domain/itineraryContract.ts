/**
 * The single implementation of Itinerary_Contract.
 *
 * Shared by the Vercel function (`api/recommendations.ts` via
 * `api/_recommendation-fallback.ts`), the Plan_First_Screen and the test suite,
 * so a payload the server accepts can never be rejected by the client. Like
 * `./candidateFallback`, this module is reached from `api/` and therefore MUST
 * stay free of DOM, React, `import.meta` and environment-variable access: the
 * only dependency allowed is types from `./types`.
 */
import type { RecommendedPlan } from "./types";

/** Required number of recommendations (Plan_Count). */
export const ITINERARY_PLAN_COUNT = 5;
/** 24-hour `HH:MM`. */
export const ITINERARY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
/** Stop kinds the contract accepts, mirroring `RouteCandidateKind`. */
export const ITINERARY_KINDS = new Set(["sightseeing", "food", "cafe", "custom"]);

/** A `RecommendedPlan` narrowed to the tourism itinerary contract. */
export type ItineraryPlan = RecommendedPlan & { mode: "tourism" };

/** A plan before validation: the fields the contract reads are still unknown. */
interface UnvalidatedPlan {
  mode?: unknown;
  stops?: unknown;
}

/** A stop before validation: the fields the contract reads are still unknown. */
interface UnvalidatedStop {
  time?: unknown;
  kind?: unknown;
  title?: unknown;
  place?: { location?: { lat?: unknown; lng?: unknown } };
}

/**
 * Reads any value as a plan-shaped record.
 *
 * A non-object becomes an empty record so the checks below still run and report
 * `mode` / `stopCount` instead of needing a violation of their own.
 */
function asPlan(value: unknown): UnvalidatedPlan {
  return typeof value === "object" && value !== null ? (value as UnvalidatedPlan) : {};
}

/** Reads any value as a stop-shaped record. See {@link asPlan}. */
function asStop(value: unknown): UnvalidatedStop {
  return typeof value === "object" && value !== null ? (value as UnvalidatedStop) : {};
}

/**
 * Contract violations of a single plan. Empty means the plan conforms.
 *
 * The conditions are the ones the Plan_First_Screen used to carry inline, so a
 * plan conforms iff this returns an empty array. Unlike a predicate the scan
 * does not stop at the first failure: one call reports every violated rule for
 * the server log, which means a stop with a malformed `time` may additionally
 * be reported as out of order.
 */
export function itineraryPlanViolations(value: unknown): string[] {
  const plan = asPlan(value);
  const violations: string[] = [];

  if (plan.mode !== "tourism") {
    violations.push("mode");
  }

  const stops = Array.isArray(plan.stops) ? (plan.stops as unknown[]) : [];
  if (!Array.isArray(plan.stops) || stops.length < 2 || stops.length > 4) {
    violations.push("stopCount");
  }

  let previousTime = "";
  stops.forEach((entry, index) => {
    const stop = asStop(entry);
    const time = String(stop.time ?? "");
    const location = stop.place?.location;

    if (!ITINERARY_TIME_PATTERN.test(time)) {
      violations.push(`stop[${index}].time`);
    }
    // The first stop has no predecessor, so an empty `previousTime` passes.
    if (previousTime && time <= previousTime) {
      violations.push(`stop[${index}].order`);
    }
    if (typeof stop.kind !== "string" || !ITINERARY_KINDS.has(stop.kind)) {
      violations.push(`stop[${index}].kind`);
    }
    if (typeof stop.title !== "string" || stop.title.trim() === "") {
      violations.push(`stop[${index}].title`);
    }
    if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
      violations.push(`stop[${index}].location`);
    }

    previousTime = time;
  });

  return violations;
}

/** Type guard form of {@link itineraryPlanViolations}. */
export function isItineraryPlan(value: unknown): value is ItineraryPlan {
  return itineraryPlanViolations(value).length === 0;
}

/** Exactly {@link ITINERARY_PLAN_COUNT} conforming tourism itineraries. */
export function isTourismRecommendations(value: unknown): value is ItineraryPlan[] {
  return Array.isArray(value)
    && value.length === ITINERARY_PLAN_COUNT
    && value.every((plan) => isItineraryPlan(plan));
}
