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
 * The second half of the module manages the **library**: the しおり keeps many
 * saved itineraries, so adding, renaming, removing, resolving which one is open
 * and reading an untrusted stored value all live here as list operations. They
 * return the same list reference for a no-op, which is how the store avoids a
 * re-render and a storage write for an edit that changed nothing.
 *
 * Everything here is pure and total: no I/O, no clock, no i18n state. `savedAt`
 * and entry ids are passed in so callers (and tests) control the timestamp and
 * the identity.
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
 *
 * `id` defaults to the plan's id, which is what a single-itinerary caller wants.
 * Callers keeping a **library** of itineraries pass their own unique id (see
 * {@link addSavedItinerary}): the plan id repeats when the same plan is built
 * twice, and two entries sharing an id could not be renamed or deleted apart.
 * The plan id is kept either way as `planId`.
 */
export function savedItineraryFromPlan(
  plan: RecommendedPlan,
  savedAt: string,
  id: string = plan.id,
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
    id,
    planId: plan.id,
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

// ---------------------------------------------------------------------------
// The しおり library — many itineraries, kept newest-first
// ---------------------------------------------------------------------------

/**
 * How many itineraries the library keeps.
 *
 * A cap exists because the whole library is one `localStorage` value: browsers
 * give the origin a few megabytes total, and an unbounded list of trips would
 * eventually take the お気に入り and 発見 records down with it when a write
 * fails. Twenty is far more than a trip's worth of planning and still a small
 * value, and the oldest entry is the one dropped — the newest is the trip being
 * planned right now.
 */
export const MAX_SAVED_ITINERARIES = 20;

/**
 * Best-effort unique id for a newly saved itinerary (browser + Node), mirroring
 * `newSpotId`.
 *
 * Not derived from the plan id: the same plan can be saved twice, and the two
 * copies must be renameable and deletable apart. Not derived from the timestamp
 * alone either — two saves inside the same millisecond would collide, and a
 * collision here silently merges two trips.
 */
export function newSavedItineraryId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `itin-${c.randomUUID()}`;
  return `itin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Read a persisted value as a list of itineraries, newest first.
 *
 * Handles all three shapes storage can hold, because the key outlives builds:
 *  - a list (current format) — unusable entries are dropped individually rather
 *    than failing the whole load, so one corrupt trip does not erase the rest;
 *  - a single object (the superseded `"savedItinerary"` key) — promoted to a
 *    one-entry list so an upgrading user keeps the schedule they saved;
 *  - anything else — an empty list.
 *
 * Entries are **not** re-sorted: the stored order is the display order, and
 * sorting by `savedAt` would reshuffle the library whenever a clock or time zone
 * disagreed with the write order. Ids are de-duplicated (first occurrence wins)
 * so a hand-edited file cannot produce two entries that rename together.
 */
export function normalizeSavedItineraries(value: unknown): SavedItinerary[] {
  const raw: unknown[] = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const list: SavedItinerary[] = [];
  for (const entry of raw) {
    if (!isSavedItinerary(entry)) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    list.push(entry);
  }
  return list.slice(0, MAX_SAVED_ITINERARIES);
}

/**
 * Add an itinerary to the front of the library, capped at
 * {@link MAX_SAVED_ITINERARIES}.
 *
 * Newest-first because that is the order the list is read in — the trip just
 * saved is the one being looked at. An entry with the same id replaces the old
 * one in place rather than appending, which keeps the operation idempotent if a
 * save is retried.
 */
export function addSavedItinerary(
  list: SavedItinerary[],
  itinerary: SavedItinerary,
): SavedItinerary[] {
  const withoutDuplicate = list.filter((entry) => entry.id !== itinerary.id);
  return [itinerary, ...withoutDuplicate].slice(0, MAX_SAVED_ITINERARIES);
}

/**
 * Rename one itinerary, returning a new list. The title is trimmed.
 *
 * Returns the **same list reference** when nothing changes — the id is unknown,
 * the trimmed title is empty, or it already matches. That lets the caller skip a
 * state update (and therefore a re-render and a storage write) for a no-op edit,
 * which matters because the rename field fires on every blur.
 */
export function renameSavedItinerary(
  list: SavedItinerary[],
  id: string,
  title: string,
): SavedItinerary[] {
  const trimmed = title.trim();
  if (trimmed.length === 0) return list;
  const target = list.find((entry) => entry.id === id);
  if (!target || target.title === trimmed) return list;
  return list.map((entry) =>
    entry.id === id ? { ...entry, title: trimmed } : entry,
  );
}

/**
 * Remove one itinerary by id, returning a new list — or the same reference when
 * the id is absent, so a double-tapped delete is a cheap no-op.
 */
export function removeSavedItinerary(
  list: SavedItinerary[],
  id: string,
): SavedItinerary[] {
  if (!list.some((entry) => entry.id === id)) return list;
  return list.filter((entry) => entry.id !== id);
}

/**
 * Resolve which itinerary is open: the one matching `id`, falling back to the
 * newest entry, and `null` only when the library is empty.
 *
 * The fallback is what keeps the screen from going blank after a delete or a
 * reload — the selected id is UI state and does not have to survive either, but
 * "the library is not empty yet the card is gone" would read as data loss.
 */
export function activeSavedItinerary(
  list: SavedItinerary[],
  id: string | null,
): SavedItinerary | null {
  if (list.length === 0) return null;
  if (id != null) {
    const match = list.find((entry) => entry.id === id);
    if (match) return match;
  }
  return list[0] ?? null;
}

/**
 * The first stop that can be located, with its 1-based itinerary position.
 *
 * This is the itinerary's *starting point* for the purpose of 「現在地からどのくらい？」:
 * the distance question the user is asking on the しおり screen is how far it is
 * to where the day begins, not to the nearest stop or to the middle of the
 * route. Stops before it carry no coordinates, so they cannot answer it; the
 * returned `order` is the real position so the UI can say which stop it means.
 */
export function itineraryStartStop(
  itinerary: SavedItinerary,
): { stop: SavedItineraryStop; location: GeoPoint; order: number } | null {
  for (let index = 0; index < itinerary.stops.length; index += 1) {
    const stop = itinerary.stops[index];
    if (stop && hasFiniteLocation(stop.location)) {
      return { stop, location: stop.location, order: index + 1 };
    }
  }
  return null;
}
