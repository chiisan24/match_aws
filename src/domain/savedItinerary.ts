/**
 * Pure projection of a confirmed plan into the しおり's saved itinerary, plus the
 * derived values the しおり screen shows "at a glance".
 *
 * The route builder produces a {@link RecommendedPlan}: a themed trip whose
 * stops each carry a scheduled time and, when Google verified them, a full
 * place record. The しおり only needs to answer three questions quickly — when
 * does it start, where do I go in what order, and how long is it — so this
 * module trims the plan down to {@link SavedItinerary} and computes the summary
 * numbers rather than making the view derive them.
 *
 * Everything here is pure and total: no I/O, no clock, no i18n state. `savedAt`
 * is passed in so callers (and tests) control the timestamp.
 */

import type {
  GeoPoint,
  RecommendedPlan,
  SavedItinerary,
  SavedItineraryStop,
} from "./types";

/** `HH:MM` in 24-hour form. Anything else is treated as "no time". */
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** True for a finite coordinate pair that can be placed on a map. */
function hasFiniteLocation(location: GeoPoint | undefined): location is GeoPoint {
  return (
    location != null
    && Number.isFinite(location.lat)
    && Number.isFinite(location.lng)
  );
}

/**
 * Project a plan onto the shape the しおり persists and renders.
 *
 * Stops keep the plan's order — that order *is* the itinerary, so it is never
 * re-sorted here. `location` is copied rather than shared so a later edit to the
 * plan cannot reach into the saved copy, and it is omitted entirely when the
 * source stop had no usable coordinates (such a stop still shows on the
 * timeline; it just cannot be pinned).
 */
export function savedItineraryFromPlan(
  plan: RecommendedPlan,
  savedAt: string,
): SavedItinerary {
  const stops: SavedItineraryStop[] = plan.stops.map((stop) => {
    const location = stop.place?.location;
    return {
      time: stop.time,
      kind: stop.kind,
      title: stop.title,
      ...(hasFiniteLocation(location)
        ? { location: { lat: location.lat, lng: location.lng } }
        : {}),
    };
  });
  return {
    id: plan.id,
    title: plan.title,
    savedAt,
    duration: plan.duration,
    transport: plan.transport,
    ...(plan.area ? { area: plan.area } : {}),
    stops,
  };
}

/** A map-ready pin. Matches `GoogleTourismMapItem` structurally. */
export interface ItineraryMapItem {
  id: string;
  label: string;
  location: GeoPoint;
  /** 1-based position in the itinerary, drawn as the marker's number. */
  order: number;
}

/**
 * Pins for the itinerary map, in visiting order.
 *
 * Stops without coordinates are dropped — the map cannot place them — but the
 * `order` numbers come from the **itinerary** position, not from the filtered
 * index, so pin 3 is the third stop even when the second one had no location.
 * Ids are position-scoped because the same place may legitimately appear twice.
 */
export function itineraryMapItems(itinerary: SavedItinerary): ItineraryMapItem[] {
  const items: ItineraryMapItem[] = [];
  itinerary.stops.forEach((stop, index) => {
    if (!hasFiniteLocation(stop.location)) return;
    items.push({
      id: `${itinerary.id}:${index}`,
      label: stop.title,
      location: stop.location,
      order: index + 1,
    });
  });
  return items;
}

/** The at-a-glance summary numbers shown above the timeline. */
export interface ItinerarySummary {
  /** Number of stops in the itinerary. */
  stopCount: number;
  /** First valid `HH:MM`, or `null` when no stop carries one. */
  startTime: string | null;
  /** Last valid `HH:MM`, or `null` when no stop carries one. */
  endTime: string | null;
}

/**
 * Summarize the itinerary for the header line.
 *
 * Start and end are taken from the **first and last stops that carry a valid
 * time**, scanning in itinerary order rather than sorting: the plan's own order
 * is authoritative, and re-sorting would invent a schedule the AI did not
 * produce. A single timed stop makes start and end the same value.
 */
export function itinerarySummary(itinerary: SavedItinerary): ItinerarySummary {
  const times = itinerary.stops
    .map((stop) => stop.time)
    .filter((time) => typeof time === "string" && TIME_PATTERN.test(time));
  return {
    stopCount: itinerary.stops.length,
    startTime: times[0] ?? null,
    endTime: times.length > 0 ? times[times.length - 1]! : null,
  };
}

/**
 * True for a value loaded from storage that is usable as a {@link SavedItinerary}.
 *
 * Storage is untrusted: the value may be from an older build, hand-edited, or
 * truncated. Only the fields the screen actually reads are checked, and a stop
 * is required to have a string `title` and `time` because those two carry the
 * timeline. Anything else makes the whole value unusable, and the caller starts
 * from "no saved itinerary" rather than rendering a broken card.
 */
export function isSavedItinerary(value: unknown): value is SavedItinerary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedItinerary>;
  if (typeof candidate.id !== "string" || typeof candidate.title !== "string") {
    return false;
  }
  if (typeof candidate.savedAt !== "string") return false;
  if (!Array.isArray(candidate.stops)) return false;
  return candidate.stops.every(
    (stop) =>
      stop != null
      && typeof stop === "object"
      && typeof (stop as SavedItineraryStop).title === "string"
      && typeof (stop as SavedItineraryStop).time === "string",
  );
}
