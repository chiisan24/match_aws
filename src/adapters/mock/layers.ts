/**
 * Mock map-layer features for the 重ねるマップ (Layered_Map / Req 14).
 *
 * The basic MVP layers (お遍路 / トイレ / 休憩所) are derived from the real
 * Ehime temple dataset wherever possible so they stay correct as the data
 * evolves:
 *  - `ohenro`   → one feature per temple (札所),
 *  - `restroom` → temples whose `restrooms` flag is set, plus a few mock public
 *    restrooms,
 *  - `rest_area`→ mock 道の駅 / 休憩所 points around Ehime.
 *
 * The 後続フェーズ (post-MVP) layers are clearly-mock points:
 *  - `cycling`  → しまなみ海道 周辺のサイクリング拠点,
 *  - `gourmet`  → 愛媛グルメのスポット,
 *  - `disaster` → ハザード/避難の区域（地図上では区域として描画）.
 *
 * Coordinates are approximate Ehime locations intended for mock rendering only;
 * labels are explicitly marked as mock data. No scraped/third-party content.
 */

import type { MapFeature, Temple } from "../../ports";

/** A compact mock point expanded into a {@link MapFeature} below. */
interface MockPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

// ---- 休憩所 / 道の駅 (rest_area) — mock ------------------------------------
const REST_AREA_POINTS: MockPoint[] = [
  { id: "rest-mikame", lat: 33.36, lng: 132.51, label: "道の駅みかめ（モック）" },
  { id: "rest-oda", lat: 33.55, lng: 132.83, label: "道の駅 小田の郷せせらぎ（モック）" },
  { id: "rest-yunoura", lat: 34.03, lng: 132.99, label: "道の駅 今治湯ノ浦温泉（モック）" },
  { id: "rest-iyonada", lat: 33.78, lng: 132.66, label: "伊予灘 休憩所（モック）" },
];

// ---- 公衆トイレ (restroom) — mock public points ----------------------------
const RESTROOM_POINTS: MockPoint[] = [
  { id: "wc-matsuyama-sta", lat: 33.839, lng: 132.765, label: "松山駅前 公衆トイレ（モック）" },
  { id: "wc-dogo", lat: 33.852, lng: 132.787, label: "道後温泉 公衆トイレ（モック）" },
];

// ---- サイクリング (cycling) — 後続フェーズ / mock ---------------------------
const CYCLING_POINTS: MockPoint[] = [
  { id: "cyc-sunrise-itoyama", lat: 34.1133, lng: 132.9925, label: "サンライズ糸山 サイクリング拠点（モック）" },
  { id: "cyc-imabari-sta", lat: 34.0648, lng: 132.9978, label: "今治駅 レンタサイクル（モック）" },
  { id: "cyc-kurushima", lat: 34.1086, lng: 133.0027, label: "来島海峡大橋 ビュースポット（モック）" },
  { id: "cyc-hakata-rest", lat: 34.1394, lng: 133.0689, label: "伯方S・Cパーク サイクリング休憩（モック）" },
];

// ---- グルメ (gourmet) — 後続フェーズ / mock ---------------------------------
const GOURMET_POINTS: MockPoint[] = [
  { id: "gourmet-taimeshi", lat: 33.223, lng: 132.566, label: "宇和島鯛めしの店（モック）" },
  { id: "gourmet-mikan-juice", lat: 33.839, lng: 132.765, label: "蛇口からみかんジュース（モック）" },
  { id: "gourmet-dogo", lat: 33.851, lng: 132.786, label: "道後の郷土料理店（モック）" },
  { id: "gourmet-yakibuta", lat: 34.066, lng: 132.998, label: "今治 焼豚玉子飯の店（モック）" },
];

// ---- 防災 / ハザード (disaster) — 後続フェーズ / mock zones -----------------
const DISASTER_POINTS: MockPoint[] = [
  { id: "hazard-matsuyama-coast", lat: 33.86, lng: 132.71, label: "松山沿岸 津波ハザード区域（モック）" },
  { id: "hazard-shigenobu", lat: 33.8, lng: 132.78, label: "重信川 浸水想定区域（モック）" },
  { id: "hazard-uwajima-port", lat: 33.22, lng: 132.56, label: "宇和島港 高潮ハザード区域（モック）" },
];

/** Map a {@link MockPoint} list onto features for a single layer. */
function pointsToFeatures(
  points: MockPoint[],
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
