/**
 * Pure conversion from interactive route-builder candidates to catalogue spots.
 *
 * `spotFromRouteCandidate` is the single rule that decides how a Google-verified
 * {@link RouteCandidate} becomes a {@link Spot} (Req 1). It takes the display
 * language as an argument so the description lands under the language the user
 * is actually looking at (Req 1.6) — the function itself stays free of i18n
 * state.
 *
 * `appendUniqueById` is the shared merge used when route results flow into the
 * favorites / shiori collections: it preserves the existing prefix and order and
 * skips ids already present (Req 4.2-4.4), returning the input reference when
 * nothing is added so callers can skip a state update.
 */

import type { LangCode, RouteCandidate, RouteCandidateKind, Spot } from "./types";

/** Separator used when folding `regularOpeningHours` into one string. */
const OPENING_HOURS_SEPARATOR = " / ";

/**
 * Candidate kind -> spot category (Req 1.5). `cafe` is a place to eat, so it
 * shares the `food` category; a free-text `custom` request is treated as
 * sightseeing. `souvenir` / `onsen` are never produced — no candidate kind maps
 * to them.
 */
const CATEGORY_BY_KIND: Record<RouteCandidateKind, Spot["category"]> = {
  sightseeing: "sightseeing",
  food: "food",
  cafe: "food",
  custom: "sightseeing",
};

/**
 * Fold Google's `regularOpeningHours` lines into the single string {@link Spot}
 * holds (Req 1.10). Blank lines are dropped; a set with nothing usable yields
 * `undefined` so the UI falls back to its "no info" copy rather than an empty
 * field.
 */
function joinOpeningHours(lines: readonly string[] | undefined): string | undefined {
  if (!lines) return undefined;
  const kept = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  return kept.length > 0 ? kept.join(OPENING_HOURS_SEPARATOR) : undefined;
}

/**
 * Convert one candidate into one spot (Req 1.1-1.12). Pure and total: the input
 * is never mutated, `location` is copied rather than shared, and the same
 * candidate always yields a structurally equal spot (Req 1.13).
 */
export function spotFromRouteCandidate(
  candidate: RouteCandidate,
  lang: LangCode,
): Spot {
  const { place } = candidate;
  const openingHours = joinOpeningHours(place.regularOpeningHours);
  return {
    id: place.id,
    name: candidate.title,
    category: CATEGORY_BY_KIND[candidate.kind],
    location: { lat: place.location.lat, lng: place.location.lng },
    localizedDescriptions: { [lang]: candidate.description },
    reviews: [],
    imageUrls: place.photoUrl ? [place.photoUrl] : [],
    // Conditional spreads keep `openingHours` / `website` absent rather than
    // explicitly `undefined`, and `popularityRank` never appears (Req 1.12).
    ...(openingHours ? { openingHours } : {}),
    ...(place.websiteUri ? { website: place.websiteUri } : {}),
  };
}

/** Convert a confirmed route, preserving its order (Req 4.2). */
export function spotsFromRouteCandidates(
  candidates: readonly RouteCandidate[],
  lang: LangCode,
): Spot[] {
  return candidates.map((candidate) => spotFromRouteCandidate(candidate, lang));
}

/**
 * Append `additions` to `collection`, skipping any id already present
 * (Req 2.3, 4.3) and keeping both the existing prefix and the addition order
 * (Req 4.2, 4.4). Returns `collection` itself when nothing new is added, so an
 * empty route is a no-op (Req 4.9) and React can skip a re-render.
 *
 * `collection` is typed as mutable `Spot[]` rather than `readonly Spot[]` so the
 * "returns the input reference" contract holds without a cast; it is only read
 * here, never mutated.
 */
export function appendUniqueById(
  collection: Spot[],
  additions: readonly Spot[],
): Spot[] {
  const seen = new Set(collection.map((spot) => spot.id));
  const fresh: Spot[] = [];
  for (const spot of additions) {
    if (seen.has(spot.id)) continue;
    seen.add(spot.id);
    fresh.push(spot);
  }
  return fresh.length === 0 ? collection : [...collection, ...fresh];
}
