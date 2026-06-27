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

import type { SwipePreferences } from "./types";

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
