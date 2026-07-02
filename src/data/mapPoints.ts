/**
 * Real, geocoded points for the 重ねるマップ non-temple layers
 * (道の駅・休憩所 / サイクリング拠点 / 公衆トイレ / グルメ).
 *
 * Coordinates were resolved from open geodata (OpenStreetMap POIs, with the
 * 国土地理院 address geocoder as fallback) — see `scripts/geocode-mappoints.mjs`,
 * which can be re-run to refresh them. These replace the previous placeholder
 * mock points so pins sit on the real locations.
 *
 * グルメ follows 案A — area × local specialty. Each gourmet point marks a
 * well-known area/landmark and its famous local food, NOT a specific private
 * restaurant, so the data stays accurate and low-maintenance.
 */

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

/** 道の駅・休憩所 — real 道の駅 across Ehime. */
export const REST_AREA_POINTS: MapPoint[] = [
  { id: "michi-mikame", lat: 33.371712, lng: 132.432587, label: "道の駅 みかめ" },
  { id: "michi-kisaiya", lat: 33.222143, lng: 132.558288, label: "道の駅 きさいや広場（宇和島）" },
  { id: "michi-mima", lat: 33.286182, lng: 132.595914, label: "道の駅 みま" },
  { id: "michi-karari", lat: 33.554924, lng: 132.65834, label: "道の駅 内子フレッシュパークからり" },
  { id: "michi-sansan", lat: 33.661439, lng: 132.898328, label: "道の駅 天空の郷さんさん（久万高原）" },
  { id: "michi-oda", lat: 33.568498, lng: 132.800794, label: "道の駅 小田の郷せせらぎ" },
  { id: "michi-kazahaya", lat: 33.96838, lng: 132.777847, label: "道の駅 風早の郷風和里（松山・北条）" },
  { id: "michi-yunoura", lat: 33.992958, lng: 133.048407, label: "道の駅 今治湯ノ浦温泉" },
  { id: "michi-yoshiumi", lat: 34.128021, lng: 133.03952, label: "道の駅 よしうみいきいき館（大島）" },
  { id: "michi-tatara", lat: 34.253829, lng: 133.053102, label: "道の駅 多々羅しまなみ公園（大三島）" },
  { id: "michi-komatsu", lat: 33.88261, lng: 133.075226, label: "道の駅 小松オアシス（西条）" },
  { id: "michi-kirinomori", lat: 33.923906, lng: 133.641106, label: "道の駅 霧の森（四国中央）" },
];

/** サイクリング拠点 — しまなみ海道周辺のサイクリングスポット. */
export const CYCLING_POINTS: MapPoint[] = [
  { id: "cyc-sunrise-itoyama", lat: 34.110332, lng: 132.97736, label: "サンライズ糸山（サイクリング拠点）" },
  { id: "cyc-imabari-sta", lat: 34.064185, lng: 132.993672, label: "今治駅 レンタサイクル" },
  { id: "cyc-kurushima", lat: 34.125111, lng: 132.978455, label: "来島海峡大橋 ビュースポット" },
  { id: "cyc-kirosan", lat: 34.120124, lng: 133.03411, label: "亀老山展望公園（大島）" },
  { id: "cyc-yoshiumi", lat: 34.128021, lng: 133.03952, label: "よしうみいきいき館（サイクルオアシス）" },
  { id: "cyc-hakata", lat: 34.202771, lng: 133.075488, label: "伯方S・Cパーク" },
  { id: "cyc-tatara", lat: 34.254378, lng: 133.054117, label: "多々羅しまなみ公園" },
];

/** 公衆トイレ — 主要駅・観光地周辺（札所由来のトイレとは別の公共拠点）. */
export const RESTROOM_POINTS: MapPoint[] = [
  { id: "wc-matsuyama-sta", lat: 33.839782, lng: 132.750762, label: "松山駅周辺 公衆トイレ" },
  { id: "wc-dogo", lat: 33.850426, lng: 132.785082, label: "道後温泉周辺 公衆トイレ" },
  { id: "wc-imabari-sta", lat: 34.064185, lng: 132.993672, label: "今治駅周辺 公衆トイレ" },
];

/** グルメ（案A: エリア×名物）— 特定店舗ではなく地域の名物を紹介. */
export const GOURMET_POINTS: MapPoint[] = [
  { id: "gourmet-uwajima", lat: 33.225812, lng: 132.567512, label: "宇和島鯛めし・じゃこ天（宇和島エリア）" },
  { id: "gourmet-yawatahama", lat: 33.458458, lng: 132.414735, label: "八幡浜ちゃんぽん（八幡浜エリア）" },
  { id: "gourmet-ozu", lat: 33.506291, lng: 132.544656, label: "大洲いもたき（大洲エリア）" },
  { id: "gourmet-dogo", lat: 33.852062, lng: 132.786404, label: "鍋焼きうどん・みかん・坊っちゃん団子（道後エリア）" },
  { id: "gourmet-matsuyama", lat: 33.839276, lng: 132.765302, label: "鯛そうめん・松山鮓（松山エリア）" },
  { id: "gourmet-imabari", lat: 34.063377, lng: 133.006851, label: "焼豚玉子飯・せんざんき（今治エリア）" },
  { id: "gourmet-niihama", lat: 33.96031, lng: 133.283392, label: "ざんき・いもたき（新居浜エリア）" },
  { id: "gourmet-saijo", lat: 33.919563, lng: 133.181227, label: "うちぬきの水と地魚（西条エリア）" },
];
