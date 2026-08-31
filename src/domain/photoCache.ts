/**
 * Pure LRU store for Google Places photo lookups, keyed by spot id.
 *
 * Photo lookups are billed per call, so the discovery screen must never ask
 * twice for the same spot — the cache is what makes that true, and it is
 * persisted so the guarantee survives a reload. It is capped because the
 * catalogue is ~400 spots today but the key space is unbounded (users can add
 * spots), and `localStorage` is a few megabytes at best.
 *
 * Modelled as an **immutable array of entries** rather than a `Map` for two
 * reasons: the insertion order it carries is exactly what the eviction rule
 * needs, and an array serialises to JSON directly, so what is held in memory and
 * what is written to storage are the same shape.
 */

import type { PlacePhotoAttribution } from "./types";

/** Upper bound on retained entries (Req 7.7). */
export const PHOTO_CACHE_LIMIT = 500;

/** One cached lookup result. */
export interface PhotoCacheEntry {
  /** Spot id this photo belongs to. */
  id: string;
  /**
   * Relative path to the photo proxy (`/api/places/photo?name=...`), stored
   * verbatim. Google's own media URLs are short-lived and signed; the proxy path
   * is stable, which is the only reason caching across sessions is sound.
   */
  photoUrl: string;
  /** Google's required photographer credits, shown on the same card. */
  attributions: PlacePhotoAttribution[];
  /**
   * Google Place ID for this spot, when the lookup that filled this entry
   * reported one.
   *
   * Stored so a Google マップ link can be built with **no further API call** —
   * `https://www.google.com/maps/place/?q=place_id:...` needs nothing but this
   * string. That matters because the app no longer requests ratings, opening
   * hours or phone numbers (they are Enterprise-tier fields), so the link is how
   * users reach that detail.
   *
   * Optional for two reasons: a place may resolve without an id, and entries
   * written by earlier builds do not have one. Those older entries are left
   * alone rather than re-resolved — a re-lookup would be billed, and the link
   * falls back to a free name search instead.
   */
  placeId?: string;
}

/**
 * The cache: oldest first, newest last.
 *
 * Position encodes insertion age, so eviction is "drop the head" and there is no
 * separate timestamp to keep in sync.
 */
export type PhotoCache = readonly PhotoCacheEntry[];

/** The cached entry for `id`, or `undefined`. */
export function photoCacheGet(
  cache: PhotoCache,
  id: string,
): PhotoCacheEntry | undefined {
  return cache.find((entry) => entry.id === id);
}

/** True when `id` has been looked up before — the "skip the API call" test. */
export function photoCacheHas(cache: PhotoCache, id: string): boolean {
  return cache.some((entry) => entry.id === id);
}

/**
 * Insert or refresh one entry, evicting the oldest while over the limit.
 *
 * Re-inserting an existing id **replaces it in place** rather than moving it to
 * the tail. Entries are only ever written once per spot (a cache hit skips the
 * lookup entirely), so there is no access pattern for a move-to-tail rule to
 * optimise, and keeping the original position makes eviction strictly
 * insertion-ordered — which is the rule Req 7.8 states.
 */
export function photoCachePut(
  cache: PhotoCache,
  entry: PhotoCacheEntry,
): PhotoCache {
  const existing = cache.findIndex((item) => item.id === entry.id);
  if (existing !== -1) {
    const next = [...cache];
    next[existing] = entry;
    return next;
  }
  const appended = [...cache, entry];
  return appended.length <= PHOTO_CACHE_LIMIT
    ? appended
    : appended.slice(appended.length - PHOTO_CACHE_LIMIT);
}

/**
 * Sanitize a value loaded from storage into a usable cache.
 *
 * Storage is untrusted: it may hold an older shape, a hand-edited value or a
 * truncated write. Unusable entries are dropped one by one rather than failing
 * the whole load, so one bad record cannot cost the user every cached photo — and
 * a value that is not an array at all yields an empty cache (Req 7.9). The
 * result is also truncated to the limit in case a previous build wrote more.
 */
export function normalizePhotoCache(value: unknown): PhotoCache {
  if (!Array.isArray(value)) return [];
  const entries: PhotoCacheEntry[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<PhotoCacheEntry>;
    if (typeof candidate.id !== "string" || candidate.id.length === 0) continue;
    if (typeof candidate.photoUrl !== "string" || candidate.photoUrl.length === 0) {
      continue;
    }
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const attributions = Array.isArray(candidate.attributions)
      ? candidate.attributions.filter(
        (attribution): attribution is PlacePhotoAttribution =>
          attribution != null
          && typeof attribution === "object"
          && typeof (attribution as PlacePhotoAttribution).displayName === "string",
      )
      : [];
    // A missing `placeId` is normal (older entries, or a place that resolved
    // without one) and must not disqualify the photo, so it is dropped rather
    // than treated as corruption. Only the shape is checked: Place IDs are
    // opaque strings and Google is free to change their format, so a
    // stricter guess here would reject valid ids later.
    const placeId = typeof candidate.placeId === "string" && candidate.placeId !== ""
      ? candidate.placeId
      : undefined;
    entries.push({
      id: candidate.id,
      photoUrl: candidate.photoUrl,
      attributions,
      ...(placeId ? { placeId } : {}),
    });
  }
  return entries.length <= PHOTO_CACHE_LIMIT
    ? entries
    : entries.slice(entries.length - PHOTO_CACHE_LIMIT);
}
