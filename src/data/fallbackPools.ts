/**
 * Static Fallback pools for the swipe candidate finalisation logic.
 *
 * Two local datasets are normalised into the shared {@link FallbackPoint}
 * shape so `finalizeCandidates` can top up Google Places-derived candidates
 * without knowing anything about their origin:
 *
 * - Temple_Dataset: `TEMPLE_GEO` (accurate coordinates + official address) is
 *   joined with `TEMPLE_DETAILS` (curated ja/en descriptions).
 * - Spot_Dataset: `EHIME_SPOTS` (real OpenStreetMap data plus the curated food
 *   entries).
 *
 * The pools are built once at module load. There is no I/O here — both sources
 * are plain static modules — so importing this file is safe from the API
 * handler, the mock adapter and the browser alike.
 */
import type { FallbackPoint, FallbackPools } from "../domain/candidateFallback";
import { EHIME_SPOTS } from "../adapters/mock/spots";
import { TEMPLE_DETAILS } from "./templeDetails";
import { TEMPLE_GEO } from "./templeGeo";

/** `true` only for real, finite coordinates. Anything else is dropped. */
function hasFiniteLocation(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

/**
 * Pulls the temple name out of a curated Japanese description.
 *
 * `TEMPLE_DETAILS` has no dedicated name field; every `descriptionJa` opens
 * with the full formal name followed by `は第{n}番札所` (e.g.
 * 「石鈇山福智院横峰寺は第60番札所で、…」). When the pattern does not match we
 * return `undefined` and the caller falls back to the bare 札所 number.
 */
function templeNameFromDescription(
  descriptionJa: string | undefined,
  templeNumber: number,
): string | undefined {
  if (!descriptionJa) return undefined;
  const match = new RegExp(`^(.+?)は第${templeNumber}番札所`).exec(descriptionJa);
  const name = match?.[1]?.trim();
  return name && name.length > 0 ? name : undefined;
}

function buildTemplePoints(): FallbackPoint[] {
  const points: FallbackPoint[] = [];
  for (const [key, geo] of Object.entries(TEMPLE_GEO)) {
    const templeNumber = Number(key);
    if (!Number.isFinite(templeNumber)) continue;
    if (!hasFiniteLocation(geo.lat, geo.lng)) continue;

    const detail = TEMPLE_DETAILS[templeNumber];
    const templeName = templeNameFromDescription(detail?.descriptionJa, templeNumber);
    const name = templeName
      ? `第${templeNumber}番札所 ${templeName}`
      : `第${templeNumber}番札所`;

    const descriptions: FallbackPoint["descriptions"] = {};
    if (detail?.descriptionJa) descriptions.ja = detail.descriptionJa;
    if (detail?.descriptionEn) descriptions.en = detail.descriptionEn;

    points.push({
      id: `temple-${templeNumber}`,
      source: "temple",
      name,
      location: { lat: geo.lat, lng: geo.lng },
      formattedAddress: geo.address,
      descriptions,
    });
  }
  return points;
}

function buildSpotPoints(): FallbackPoint[] {
  const points: FallbackPoint[] = [];
  for (const spot of EHIME_SPOTS) {
    if (!spot.location || !hasFiniteLocation(spot.location.lat, spot.location.lng)) {
      continue;
    }

    const point: FallbackPoint = {
      id: spot.id,
      source: "spot",
      name: spot.name,
      location: { lat: spot.location.lat, lng: spot.location.lng },
      // EHIME_SPOTS carries no street address, so keep the prefecture as the
      // coarse but always-true location label.
      formattedAddress: "愛媛県",
      descriptions: { ...spot.localizedDescriptions },
      category: spot.category,
    };
    const photoUrl = spot.imageUrls?.[0];
    if (photoUrl) point.photoUrl = photoUrl;
    if (spot.website) point.websiteUri = spot.website;

    points.push(point);
  }
  return points;
}

/** 札所 40–65 normalised as Fallback points, ordered by temple number. */
export const TEMPLE_FALLBACK_POINTS: FallbackPoint[] = buildTemplePoints();

/** The Ehime spot catalogue normalised as Fallback points. */
export const SPOT_FALLBACK_POINTS: FallbackPoint[] = buildSpotPoints();

/** The default Fallback inventory used by every Candidate_Provider. */
export const DEFAULT_FALLBACK_POOLS: FallbackPools = {
  temples: TEMPLE_FALLBACK_POINTS,
  spots: SPOT_FALLBACK_POINTS,
};
