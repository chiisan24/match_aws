/**
 * Swipe discovery domain logic — pure, side-effect-free functions.
 *
 * Covers:
 *  - {@link classifySwipe}: maps a 4-direction swipe to its evaluation bucket
 *    (Req 4.2-4.5, Property 5).
 *  - {@link generateRecommendations}: derives the "あなたへのおすすめ" set from
 *    swipe history, excluding 興味なし (left) and already-evaluated items
 *    (Req 4.6, Property 6).
 *  - {@link buildSuggestionPayload}: turns accumulated swipe history into the
 *    preference payload fed to AI suggestion requests (Req 3.3, Property 4).
 *
 * No I/O, no mutation of inputs — every function returns fresh values.
 */

import { haversineDistanceMeters } from "./geofence";
import type { GeoPoint, SwipePreferences } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A swipe direction. (design.md: ドメイン層の主な純粋関数) */
export type SwipeDir = "right" | "left" | "up" | "down";

/** The evaluation bucket a swipe maps to. */
export type SwipeClassification = "favorite" | "skip" | "shiori" | "later";

/** A single recorded swipe: which item was swiped and in which direction. */
export interface SwipeRecord {
  itemId: string;
  dir: SwipeDir;
}

// ---------------------------------------------------------------------------
// Swipe classification (Req 4.2-4.5, Property 5)
// ---------------------------------------------------------------------------

/**
 * Classify a swipe direction into its evaluation bucket.
 *
 * Mapping (Req 4.2-4.5):
 *  - right → "favorite" (行きたい / お気に入りに追加)
 *  - left  → "skip"     (興味なし / 次のカードへ)
 *  - up    → "shiori"   (しおりに追加)
 *  - down  → "later"    (後で見るリストに追加)
 */
export function classifySwipe(dir: SwipeDir): SwipeClassification {
  switch (dir) {
    case "right":
      return "favorite";
    case "left":
      return "skip";
    case "up":
      return "shiori";
    case "down":
      return "later";
  }
}

// ---------------------------------------------------------------------------
// Recommendation generation (Req 4.6, Property 6)
// ---------------------------------------------------------------------------

/** The minimal shape a candidate item needs to be recommendable. */
export interface Identifiable {
  id: string;
}

/**
 * The set of item ids that have already been evaluated by the user — i.e.
 * appear anywhere in the swipe history regardless of direction.
 */
function evaluatedIds(history: readonly SwipeRecord[]): Set<string> {
  return new Set(history.map((record) => record.itemId));
}

/**
 * Generate the "あなたへのおすすめ" list from a candidate pool and the user's
 * swipe history (Req 4.6).
 *
 * The result is the subset of `candidates` whose ids have NOT been evaluated.
 * Because every swiped item — including every left swipe (興味なし) — is in the
 * history, the result can never contain a disliked or already-evaluated item
 * (Property 6). Candidate order is preserved and the input arrays are not
 * mutated.
 */
export function generateRecommendations<T extends Identifiable>(
  candidates: readonly T[],
  history: readonly SwipeRecord[],
): T[] {
  const evaluated = evaluatedIds(history);
  return candidates.filter((candidate) => !evaluated.has(candidate.id));
}

/** A candidate rich enough to rank by genre + geographic similarity. */
export interface RankableSpot extends Identifiable {
  /** Genre bucket used as an "atmosphere" proxy (観光/食事/…). */
  category: string;
  /** Coordinates used for proximity scoring. */
  location: GeoPoint;
}

/** Distance scale (km) at which the proximity score halves. */
const PROXIMITY_SCALE_KM = 5;
/** Proximity dominates the score (distance-first ranking). */
const PROXIMITY_WEIGHT = 2;
/** Genre match is a lighter refinement on top of proximity. */
const GENRE_WEIGHT = 0.75;
/** Default number of recommendations surfaced (a short, focused list). */
const DEFAULT_RECOMMENDATION_LIMIT = 6;

/**
 * "あなたへのおすすめ" with content-based ranking (Req 4.6, extended).
 *
 * Keeps the same exclusion guarantee as {@link generateRecommendations} — the
 * result never contains an already-evaluated item (so 興味なし stays out,
 * Property 6) — but orders the remaining spots by how similar they are to what
 * the user liked (right/up swipes):
 *
 *  - genre affinity: candidates whose category matches the user's liked
 *    categories score higher (weighted by how many liked spots share it);
 *  - proximity: candidates physically near a liked spot score higher.
 *
 * Genre is weighted above proximity so a same-genre spot generally outranks a
 * merely-nearby one. With no positive signal yet the original order is kept, so
 * behaviour matches the plain recommendation list until the user likes
 * something. Pure and total: inputs are never mutated and it never throws.
 *
 * Ranking is distance-first: a nearby spot generally outranks a same-genre but
 * far one, with genre acting as a tiebreaker. The result is capped to a short
 * list (`limit`) so it stays focused rather than a long roll of every spot.
 *
 * @param allSpots the full spot pool (must include the liked spots so their
 *                 attributes can be read; evaluated ones are filtered out here)
 * @param history  the accumulated swipe history
 * @param limit    max number of recommendations to return (default 6)
 */
export function recommendSimilarSpots<T extends RankableSpot>(
  allSpots: readonly T[],
  history: readonly SwipeRecord[],
  limit: number = DEFAULT_RECOMMENDATION_LIMIT,
): T[] {
  const cap = Math.max(0, Math.floor(limit));
  const evaluated = evaluatedIds(history);
  const candidates = allSpots.filter((spot) => !evaluated.has(spot.id));

  const likedIds = new Set(buildSuggestionPayload(history).liked);
  const likedSpots = allSpots.filter((spot) => likedIds.has(spot.id));

  // No positive signal yet → preserve the plain unevaluated order (Req 4.6).
  if (likedSpots.length === 0) return candidates.slice(0, cap);

  // How strongly the user liked each genre (count of liked spots per category).
  const genreCount = new Map<string, number>();
  for (const spot of likedSpots) {
    genreCount.set(spot.category, (genreCount.get(spot.category) ?? 0) + 1);
  }

  const scoreOf = (spot: T): number => {
    const genre = (genreCount.get(spot.category) ?? 0) / likedSpots.length; // 0..1
    let nearestKm = Number.POSITIVE_INFINITY;
    for (const liked of likedSpots) {
      const km = haversineDistanceMeters(spot.location, liked.location) / 1000;
      if (km < nearestKm) nearestKm = km;
    }
    const proximity = Number.isFinite(nearestKm)
      ? 1 / (1 + nearestKm / PROXIMITY_SCALE_KM) // 0..1, closer ⇒ higher
      : 0;
    // Distance-first: proximity dominates, genre is a lighter refinement.
    return proximity * PROXIMITY_WEIGHT + genre * GENRE_WEIGHT;
  };

  // Descending score; ties keep the original order (stable). Capped to `limit`.
  return candidates
    .map((spot, order) => ({ spot, order, score: scoreOf(spot) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, cap)
    .map((entry) => entry.spot);
}

// ---------------------------------------------------------------------------
// Suggestion input payload (Req 3.3, Property 4)
// ---------------------------------------------------------------------------

/**
 * Build the preference payload handed to AI suggestion requests from the
 * accumulated swipe history (Req 3.3).
 *
 * - `liked`: items swiped right (お気に入り) or up (しおり) — positive signal.
 * - `disliked`: items swiped left (興味なし) — negative signal.
 *
 * Items swiped down ("later") carry no preference signal and appear in neither
 * list. Ids are de-duplicated while preserving first-seen order; if the same
 * item was swiped in conflicting directions the most recent swipe wins, so a
 * given id appears in at most one list. The input array is not mutated.
 */
export function buildSuggestionPayload(
  history: readonly SwipeRecord[],
): SwipePreferences {
  // Resolve the latest classification per item so re-swipes override.
  const latest = new Map<string, SwipeClassification>();
  for (const record of history) {
    latest.set(record.itemId, classifySwipe(record.dir));
  }

  const liked: string[] = [];
  const disliked: string[] = [];
  for (const [itemId, classification] of latest) {
    if (classification === "favorite" || classification === "shiori") {
      liked.push(itemId);
    } else if (classification === "skip") {
      disliked.push(itemId);
    }
    // "later" contributes no preference signal.
  }

  return { liked, disliked };
}
