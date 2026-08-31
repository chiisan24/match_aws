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

// Route-builder candidate -> spot conversion and collection merge (Req 1, 4).
export {
  spotFromRouteCandidate,
  spotsFromRouteCandidates,
  appendUniqueById,
} from "./routeCandidate";

// 発見 (discovery): the persisted LRU of Google Places photo lookups.
export {
  photoCacheGet,
  photoCacheHas,
  photoCachePut,
  normalizePhotoCache,
  PHOTO_CACHE_LIMIT,
} from "./photoCache";
export type { PhotoCache, PhotoCacheEntry } from "./photoCache";

// 発見 (discovery) collection game: deck order, area classification and the
// achievement rate / badges.
export {
  deckOrder,
  classifyArea,
  discoveryProgress,
  DISCOVERY_AREAS,
} from "./discovery";
export type {
  DiscoveryArea,
  DiscoveryBadge,
  DiscoveryBadgeKind,
  DiscoveryProgress,
} from "./discovery";

// Confirmed plan -> しおり saved itinerary, plus the map pins, the at-a-glance
// summary the しおり header shows, and the list operations behind the しおり
// library (many saved itineraries, newest first).
export {
  savedItineraryFromPlan,
  itineraryMapItems,
  itinerarySummary,
  isSavedItinerary,
  normalizeSavedItineraries,
  addSavedItinerary,
  renameSavedItinerary,
  removeSavedItinerary,
  activeSavedItinerary,
  itineraryStartStop,
  newSavedItineraryId,
  MAX_SAVED_ITINERARIES,
} from "./savedItinerary";
export type { ItineraryMapItem, ItinerarySummary } from "./savedItinerary";

// Task 4.5 — shiori reorder, temple filter, geofence, layer filter, label resolution.
export { reorder } from "./reorder";
export {
  filterTemples,
  satisfiesTempleCriteria,
  type TempleFilterCriteria,
  type TempleTravelTime,
} from "./filter";
export { isInsideGeofence, haversineDistanceMeters } from "./geofence";
export {
  estimateLocalTempleNav,
  cleanTempleAddress,
} from "./templeNav";
export type { LocalNavNumbers } from "./templeNav";

// Per-transport-mode distance / duration estimates — one speed table for every
// screen that answers 「現在地からどのくらい？」.
export {
  TRAVEL_MODES,
  straightLineMeters,
  estimateTravel,
  estimateTravelFromDistance,
  estimateTravelAllModes,
  formatDistanceMeters,
  splitDurationMinutes,
} from "./travelEstimate";
export type {
  TravelMode,
  TravelEstimate,
  DurationParts,
} from "./travelEstimate";

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
