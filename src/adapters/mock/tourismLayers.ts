/**
 * Mock map-layer features for the 通常観光モード 重ねるマップ.
 *
 * Mirrors the お遍路 `buildLayerFeatures` but for sightseeing:
 *  - スポット系レイヤー … 観光スポット / グルメ / 温泉 / おみやげ を、実データの
 *    {@link EHIME_SPOTS} の `category` からそのままレイヤー化。
 *  - 施設レイヤー … トイレ / 駐車場 / 休憩所（愛媛周辺のモック点）。
 *  - ★あなたのレイヤー … スワイプ結果（お気に入り / しおり）を、そのスポットの
 *    座標でピン化。`TourismContext` のコレクションを渡すだけで、スワイプ登録が
 *    そのまま地図に重なる。
 *
 * 座標はモック用の概算。ラベルはモックである旨を明記。純粋関数（副作用なし）。
 */

import type { MapFeature, Spot } from "../../ports";

/** A compact mock point expanded into a {@link MapFeature} below. */
interface MockPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

// ---- 公衆トイレ (restroom) — mock -----------------------------------------
const RESTROOM_POINTS: MockPoint[] = [
  { id: "t-wc-matsuyama-sta", lat: 33.839, lng: 132.765, label: "松山駅前 公衆トイレ（モック）" },
  { id: "t-wc-dogo", lat: 33.852, lng: 132.787, label: "道後温泉 公衆トイレ（モック）" },
  { id: "t-wc-imabari", lat: 34.0648, lng: 132.9978, label: "今治駅 公衆トイレ（モック）" },
  { id: "t-wc-castle", lat: 33.8459, lng: 132.7658, label: "松山城ロープウェイ前 トイレ（モック）" },
];

// ---- 駐車場 (parking) — mock ----------------------------------------------
const PARKING_POINTS: MockPoint[] = [
  { id: "t-p-dogo", lat: 33.8508, lng: 132.7861, label: "道後温泉 市営駐車場（モック）" },
  { id: "t-p-castle", lat: 33.8446, lng: 132.7669, label: "松山城 東雲口駐車場（モック）" },
  { id: "t-p-imabari", lat: 34.0662, lng: 132.9968, label: "今治駅前 駐車場（モック）" },
];

// ---- 休憩所 / 道の駅 (rest_area) — mock ------------------------------------
const REST_AREA_POINTS: MockPoint[] = [
  { id: "t-rest-mikame", lat: 33.36, lng: 132.51, label: "道の駅みかめ（モック）" },
  { id: "t-rest-yunoura", lat: 34.03, lng: 132.99, label: "道の駅 今治湯ノ浦温泉（モック）" },
  { id: "t-rest-iyonada", lat: 33.78, lng: 132.66, label: "伊予灘 休憩所（モック）" },
];

/** Map a {@link MockPoint} list onto features for a single layer. */
function pointsToFeatures(points: MockPoint[], layer: MapFeature["layer"]): MapFeature[] {
  return points.map((p) => ({
    id: p.id,
    layer,
    location: { lat: p.lat, lng: p.lng },
    label: p.label,
  }));
}

/** Swipe-driven collections handed in from the tourism store. */
export interface TourismCollections {
  /** お気に入り (右スワイプ). */
  favorites: Spot[];
  /** しおり (確定ルート). */
  shiori: Spot[];
}

/** Turn a spot collection into pins on a single user layer. */
function collectionToFeatures(
  spots: Spot[],
  layer: MapFeature["layer"],
  prefix: string,
): MapFeature[] {
  return spots.map((s) => ({
    id: `${prefix}-${s.id}`,
    layer,
    location: { ...s.location },
    label: s.name,
    spotId: s.id,
  }));
}

/**
 * Build the full set of {@link MapFeature}s for every 通常観光モード layer from
 * the spot catalogue plus the fixed mock facilities and the swipe-driven
 * collections. Pure: no I/O, never mutates its input, fresh array each call.
 *
 * The result is the single source of truth handed to the pure `filterByLayers`
 * helper, so what the map shows is always exactly the features whose layer is
 * active (Property 25 / Req 14.1–14.3).
 */
export function buildTourismLayerFeatures(
  spots: Spot[],
  collections: TourismCollections,
): MapFeature[] {
  const features: MapFeature[] = [];

  // スポット系: 1スポット = 1フィーチャ。レイヤーは category と一致。
  for (const spot of spots) {
    features.push({
      id: `spot-${spot.id}`,
      layer: spot.category,
      location: { ...spot.location },
      label: spot.name,
      spotId: spot.id,
    });
  }

  // 施設レイヤー（モック点）。
  features.push(...pointsToFeatures(RESTROOM_POINTS, "restroom"));
  features.push(...pointsToFeatures(PARKING_POINTS, "parking"));
  features.push(...pointsToFeatures(REST_AREA_POINTS, "rest_area"));

  // ★あなたのレイヤー（スワイプ連動）。
  features.push(...collectionToFeatures(collections.favorites, "favorite", "fav"));
  features.push(...collectionToFeatures(collections.shiori, "shiori", "shiori"));

  return features;
}
