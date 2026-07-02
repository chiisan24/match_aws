/**
 * Map-layer features for the 重ねるマップ (Layered_Map / Req 14).
 *
 * The basic MVP layers (お遍路 / トイレ / 休憩所) are derived from the real
 * Ehime temple dataset wherever possible so they stay correct as the data
 * evolves:
 *  - `ohenro`   → one feature per temple (札所),
 *  - `restroom` → temples whose `restrooms` flag is set, plus real public
 *    restrooms (from `src/data/mapPoints.ts`),
 *  - `rest_area`→ real 道の駅 / 休憩所 across Ehime.
 *
 * These extra layers use accurate coordinates geocoded from open data
 * (OpenStreetMap / GSI — see `src/data/mapPoints.ts`):
 *  - `cycling`  → しまなみ海道周辺のサイクリング拠点,
 *  - `gourmet`  → 案A「エリア×名物」（特定店舗ではなく地域の名物）.
 *
 * The 防災・ハザード (`disaster`) layer remains placeholder/mock for now; it is
 * slated to be replaced with authoritative open hazard data (国交省 重ねる
 * ハザードマップ / 国土数値情報) in a later step.
 */

import type { MapFeature, Temple } from "../../ports";
import {
  REST_AREA_POINTS,
  RESTROOM_POINTS,
  CYCLING_POINTS,
  GOURMET_POINTS,
  type MapPoint,
} from "../../data/mapPoints";

// ---- 防災 / ハザード (disaster) — 後で検討 / mock zones ---------------------
const DISASTER_POINTS: MapPoint[] = [
  { id: "hazard-matsuyama-coast", lat: 33.86, lng: 132.71, label: "松山沿岸 津波ハザード区域（モック）" },
  { id: "hazard-shigenobu", lat: 33.8, lng: 132.78, label: "重信川 浸水想定区域（モック）" },
  { id: "hazard-uwajima-port", lat: 33.22, lng: 132.56, label: "宇和島港 高潮ハザード区域（モック）" },
];

/** Map a {@link MapPoint} list onto features for a single layer. */
function pointsToFeatures(
  points: MapPoint[],
  layer: MapFeature["layer"],
): MapFeature[] {
  return points.map((p) => ({
    id: p.id,
    layer,
    location: { lat: p.lat, lng: p.lng },
    label: p.label,
  }));
}

/**
 * Build the full set of {@link MapFeature}s for every information layer from the
 * loaded temples plus the fixed mock points. Pure: no I/O, never mutates its
 * input, and returns a fresh array on every call.
 *
 * The result is the single source of truth the screen hands to the pure
 * `filterByLayers` domain helper, so what the map shows is always exactly the
 * features whose layer is active (Property 25 / Req 14.1–14.3).
 */
export function buildLayerFeatures(temples: Temple[]): MapFeature[] {
  const features: MapFeature[] = [];

  // お遍路: one feature per temple (basic MVP layer).
  for (const temple of temples) {
    features.push({
      id: `ohenro-${temple.id}`,
      layer: "ohenro",
      location: { ...temple.location },
      label: `${temple.number} ${temple.name}`,
    });
  }

  // トイレ: temples flagged with restrooms (basic MVP layer) + mock public WCs.
  for (const temple of temples) {
    if (temple.restrooms) {
      features.push({
        id: `restroom-${temple.id}`,
        layer: "restroom",
        location: { ...temple.location },
        label: `${temple.name} トイレ`,
      });
    }
  }
  features.push(...pointsToFeatures(RESTROOM_POINTS, "restroom"));

  // 休憩所: mock 道の駅 / 休憩所 (basic MVP layer).
  features.push(...pointsToFeatures(REST_AREA_POINTS, "rest_area"));

  // 後続フェーズ (post-MVP) layers — functional with mock data.
  features.push(...pointsToFeatures(CYCLING_POINTS, "cycling"));
  features.push(...pointsToFeatures(GOURMET_POINTS, "gourmet"));
  features.push(...pointsToFeatures(DISASTER_POINTS, "disaster"));

  return features;
}
