/**
 * Domain layer — pure, side-effect-free logic verified by property-based tests.
 *
 * Houses: achievement-rate calculation, swipe classification, shiori reordering,
 * geofence checks, layer filtering, language fallback, visit aggregation.
 * Pure functions are populated in tasks 3 and 4.
 *
 * Shared data models (Temple, Spot, ProgressState, ...) live in `./types` and
 * are re-exported here as the domain's public surface (task 2.1).
 */
export type * from "./types";

// Pilgrimage progress: achievement-rate, visit application, area scoping,
// remaining/total accounting, today/this-month tallies (task 3.1, Req 9).
export * from "./progress";

// Swipe discovery domain logic (task 4.1).
export {
  classifySwipe,
  generateRecommendations,
  buildSuggestionPayload,
} from "./swipe";
export type {
  SwipeDir,
  SwipeClassification,
  SwipeRecord,
  Identifiable,
} from "./swipe";

// Task 4.5 — shiori reorder, temple filter, geofence, layer filter, label resolution.
export { reorder } from "./reorder";
export {
  filterTemples,
  satisfiesTempleCriteria,
  type TempleFilterCriteria,
  type TempleTravelTime,
} from "./filter";
export { isInsideGeofence, haversineDistanceMeters } from "./geofence";
export { filterByLayers } from "./layers";
export { resolveLabel } from "./i18n";

// Task 8.8 — plan-sharing encode/decode round-trip (Req 7.1–7.3, Property 13).
export {
  encodeSharePlan,
  decodeSharePlan,
  normalizeSharePlan,
  buildShareLink,
  parseShareToken,
  openSharedPlan,
} from "./share";
export type { SharePlan, SharePlanItem } from "./share";
