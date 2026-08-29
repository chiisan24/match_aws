/**
 * Bridge module: the second point where `api/` reaches into `src/`
 * (see `api/_fallback-candidates.ts` for the convention and the rationale).
 *
 * Re-exports only. The itinerary contract lives once in
 * `src/domain/itineraryContract.ts` and the fallback itineraries once in
 * `src/data/recommendationFallbackPlans.ts`, so the Vercel function, the mock
 * adapter, the Plan_First_Screen and the test suite share one definition.
 *
 * The shared modules must stay free of DOM, React, `import.meta` and
 * environment variables.
 */

export {
  ITINERARY_PLAN_COUNT,
  isItineraryPlan,
  isTourismRecommendations,
  itineraryPlanViolations,
} from "../src/domain/itineraryContract.js";

export type { ItineraryPlan } from "../src/domain/itineraryContract.js";

export { RECOMMENDATION_FALLBACK_PLANS } from "../src/data/recommendationFallbackPlans.js";
