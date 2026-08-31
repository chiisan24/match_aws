/**
 * Pure logic for the 発見 (discovery) collection game: what order cards come in,
 * which area a spot belongs to, and how far through the catalogue the user is.
 *
 * All three answers must be reproducible — the deck is rebuilt on every render
 * and after every reload, so anything random or clock-dependent here would
 * reshuffle cards under the user's finger. Every function below is therefore
 * pure, total and deterministic, and none of them mutate their inputs.
 */

import { haversineDistanceMeters } from "./geofence";
import type { GeoPoint, Spot } from "./types";

// ---------------------------------------------------------------------------
// Deck order
// ---------------------------------------------------------------------------

/**
 * 32-bit FNV-1a over the spot id.
 *
 * Used only to scatter the catalogue into a fixed pseudo-random order, so the
 * deck does not march through the dataset's generation order (which groups
 * museums together, then mountains, then onsen). Nothing here is security
 * relevant; the properties that matter are that it is a pure function of the id
 * and that it never changes between runs.
 */
function idRank(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    // 16777619 (the FNV prime) via shifts, kept inside 32 bits.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The presentation order: every catalogue spot exactly once, undecided first.
 *
 * The comparison is (undecided before decided) → (id hash) → (id). The final
 * `id` tiebreak is what makes the result a *total* order rather than one that
 * depends on the input array's order, so two catalogues holding the same spots
 * in different orders still produce the same deck. Hash collisions are
 * therefore harmless.
 *
 * `seen` is read, never written, and the input array is copied before sorting.
 */
export function deckOrder(
  catalogue: readonly Spot[],
  seen: ReadonlySet<string>,
): Spot[] {
  return [...catalogue].sort((left, right) => {
    const leftSeen = seen.has(left.id) ? 1 : 0;
    const rightSeen = seen.has(right.id) ? 1 : 0;
    if (leftSeen !== rightSeen) return leftSeen - rightSeen;
    const rankDelta = idRank(left.id) - idRank(right.id);
    if (rankDelta !== 0) return rankDelta;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Area classifier
// ---------------------------------------------------------------------------

/**
 * Ehime's three conventional regions, in east-to-west order.
 *
 * These are the divisions residents actually use (東予 / 中予 / 南予), so a badge
 * for one of them reads as a real achievement rather than an invented bucket.
 */
export const DISCOVERY_AREAS = ["touyo", "chuuyo", "nanyo"] as const;
export type DiscoveryArea = (typeof DISCOVERY_AREAS)[number];

/**
 * Representative centre of each region.
 *
 * The official boundaries are defined per municipality, which coordinates alone
 * cannot reproduce. Assigning each spot to the nearest of these three centres is
 * an approximation, chosen because it is **total** (every coordinate has a
 * nearest centre) and **stable** (no boundary polygon to drift). Spots near a
 * regional border may land on the neighbouring side; for a collection game that
 * is acceptable, and it never leaves a spot unclassified.
 */
const AREA_ANCHORS: Record<DiscoveryArea, GeoPoint> = {
  touyo: { lat: 34.066, lng: 132.998 },
  chuuyo: { lat: 33.839, lng: 132.765 },
  nanyo: { lat: 33.223, lng: 132.56 },
};

/**
 * The single area a spot belongs to (Req 4.5).
 *
 * Falls back to 中予 — the geographic middle — when the coordinates are not
 * finite. `Spot.location` is required by the type, but the catalogue is
 * generated from OpenStreetMap and persisted through JSON, so a malformed pair
 * is possible; classifying it rather than dropping it keeps the badge totals and
 * the achievement denominator consistent with the catalogue size.
 */
export function classifyArea(spot: Spot): DiscoveryArea {
  const { lat, lng } = spot.location ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "chuuyo";
  const location: GeoPoint = { lat: lat as number, lng: lng as number };
  let best: DiscoveryArea = DISCOVERY_AREAS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const area of DISCOVERY_AREAS) {
    const distance = haversineDistanceMeters(location, AREA_ANCHORS[area]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = area;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Progress & badges
// ---------------------------------------------------------------------------

/** What a badge group is keyed on: an Ehime region or a spot category. */
export type DiscoveryBadgeKind = "area" | "category";

/** One collection goal: a region or a category, and how far through it we are. */
export interface DiscoveryBadge {
  /** `area:touyo` / `category:food` — unique across both kinds. */
  key: string;
  kind: DiscoveryBadgeKind;
  /** The raw group id: a {@link DiscoveryArea} or a `Spot["category"]`. */
  id: string;
  /** Spots in this group. Always 1 or more — empty groups are omitted. */
  total: number;
  /** How many of them have been decided. */
  seen: number;
  /** True once every spot in the group is decided (Req 4.7). */
  earned: boolean;
}

/** The achievement view the discovery screen renders. */
export interface DiscoveryProgress {
  /** Catalogue size — the denominator of the achievement rate (Req 4.3). */
  total: number;
  /** Decided spots that exist in the catalogue (Req 4.4). */
  seen: number;
  /** 0-100, floored (Req 4.2). 0 when the catalogue is empty. */
  percent: number;
  /** True once every catalogue spot is decided (Req 5.1, 5.2). */
  complete: boolean;
  /** Region badges, in {@link DISCOVERY_AREAS} order. */
  areaBadges: DiscoveryBadge[];
  /** Category badges, in first-seen catalogue order. */
  categoryBadges: DiscoveryBadge[];
}

/** Tally one group's totals into the accumulator maps. */
function bump(
  totals: Map<string, number>,
  seenCounts: Map<string, number>,
  key: string,
  decided: boolean,
): void {
  totals.set(key, (totals.get(key) ?? 0) + 1);
  if (decided) seenCounts.set(key, (seenCounts.get(key) ?? 0) + 1);
}

/** Build the badge list for one kind, skipping groups with no spots (Req 4.8). */
function toBadges(
  kind: DiscoveryBadgeKind,
  order: readonly string[],
  totals: Map<string, number>,
  seenCounts: Map<string, number>,
): DiscoveryBadge[] {
  const badges: DiscoveryBadge[] = [];
  for (const id of order) {
    const total = totals.get(id) ?? 0;
    if (total === 0) continue;
    const seen = seenCounts.get(id) ?? 0;
    badges.push({
      key: `${kind}:${id}`,
      kind,
      id,
      total,
      seen,
      earned: seen >= total,
    });
  }
  return badges;
}

/**
 * The achievement rate and every badge, computed in one pass.
 *
 * The denominator is always the catalogue (Req 4.3), and ids in `seen` that are
 * not in the catalogue are ignored entirely (Req 4.4) — a spot removed from the
 * dataset must not let the rate exceed 100, and a stale record must not earn a
 * badge for a group it is no longer part of.
 *
 * Category order follows first appearance in the catalogue rather than a
 * hard-coded list, so a category added to `Spot["category"]` later shows up
 * without a change here.
 */
export function discoveryProgress(
  catalogue: readonly Spot[],
  seen: ReadonlySet<string>,
): DiscoveryProgress {
  const areaTotals = new Map<string, number>();
  const areaSeen = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  const categorySeen = new Map<string, number>();
  const categoryOrder: string[] = [];
  let seenInCatalogue = 0;

  for (const spot of catalogue) {
    const decided = seen.has(spot.id);
    if (decided) seenInCatalogue += 1;
    bump(areaTotals, areaSeen, classifyArea(spot), decided);
    if (!categoryTotals.has(spot.category)) categoryOrder.push(spot.category);
    bump(categoryTotals, categorySeen, spot.category, decided);
  }

  const total = catalogue.length;
  return {
    total,
    seen: seenInCatalogue,
    percent: total === 0 ? 0 : Math.floor((seenInCatalogue / total) * 100),
    complete: total > 0 && seenInCatalogue >= total,
    areaBadges: toBadges("area", DISCOVERY_AREAS, areaTotals, areaSeen),
    categoryBadges: toBadges("category", categoryOrder, categoryTotals, categorySeen),
  };
}
