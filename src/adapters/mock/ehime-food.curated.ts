/**
 * Curated Ehime 郷土料理 / 名物 のお店（グルメレイヤー用）。
 *
 * OpenStreetMap には愛媛の郷土料理店がほとんどタグ付けされていないため、
 * 鯛めし・三津浜焼き・今治焼豚玉子飯・みかん(柑橘)・鍋焼きうどん・じゃこ天 等の
 * よく知られた実在店を手動でキュレーションしたもの。
 *
 * 注意: 座標は市街地・エリア単位の**目安**です（番地単位の正確さは保証しません）。
 * 本番運用では公式情報・地図で位置と営業情報の確認・差し替えを推奨します。
 */

import type { Spot } from "../../ports";

/** エリアの目安座標。 */
const AREA = {
  matsuyamaCity: { lat: 33.8416, lng: 132.7657 },
  okaido: { lat: 33.8456, lng: 132.769 },
  dogo: { lat: 33.8515, lng: 132.7861 },
  mitsuhama: { lat: 33.8745, lng: 132.7118 },
  matsuyamaAirport: { lat: 33.8272, lng: 132.6997 },
  imabari: { lat: 34.0658, lng: 132.9975 },
  uwajima: { lat: 33.2233, lng: 132.5606 },
  yawatahama: { lat: 33.4636, lng: 132.4231 },
} as const;

interface Seed {
  id: string;
  name: string;
  area: keyof typeof AREA;
  specialty: string;
  /** 公式サイト（到達確認済みのもののみ設定。未確認は undefined）。 */
  website?: string;
}

const SEEDS: Seed[] = [
  { id: "gansui-matsuyama", name: "宇和島鯛めし 丸水 松山店", area: "okaido", specialty: "宇和島鯛めし", website: "https://gansui.jp/" },
  { id: "kadoya-okaido", name: "かどや 大街道店", area: "okaido", specialty: "鯛めし・郷土料理" },
  { id: "goshiki-matsuyama", name: "郷土料理 五志喜", area: "matsuyamaCity", specialty: "五色そうめん・鯛めし" },
  { id: "hozumitei-uwajima", name: "ほづみ亭", area: "uwajima", specialty: "宇和島鯛めし" },
  { id: "hinode-mitsuhama", name: "日の出", area: "mitsuhama", specialty: "三津浜焼き" },
  { id: "konaya-mitsuhama", name: "こなや", area: "mitsuhama", specialty: "三津浜焼き" },
  { id: "hakurakuten-imabari", name: "白楽天 今治本店", area: "imabari", specialty: "今治焼豚玉子飯", website: "https://hakurakuten.net/" },
  { id: "shigematsu-imabari", name: "重松飯店", area: "imabari", specialty: "焼豚玉子飯（発祥の店）" },
  { id: "kotori-matsuyama", name: "ことり", area: "matsuyamaCity", specialty: "松山の鍋焼きうどん" },
  { id: "asahi-matsuyama", name: "アサヒ", area: "matsuyamaCity", specialty: "松山の鍋焼きうどん" },
  { id: "tenfactory-matsuyama", name: "10 FACTORY 松山本店", area: "okaido", specialty: "みかんジュース・柑橘スイーツ", website: "https://10-factory.com/" },
  { id: "mikan-tap-airport", name: "みかんジュース蛇口（松山空港）", area: "matsuyamaAirport", specialty: "蛇口からみかんジュース" },
  { id: "yasuoka-kamaboko-uwajima", name: "安岡蒲鉾（じゃこ天）", area: "uwajima", specialty: "じゃこ天・練り物" },
  { id: "takeuchi-matsuyama", name: "たけうち", area: "matsuyamaCity", specialty: "労研饅頭" },
  { id: "champon-yawatahama", name: "八幡浜ちゃんぽんの店", area: "yawatahama", specialty: "八幡浜ちゃんぽん" },
];

export const EHIME_FOOD_CURATED: Spot[] = SEEDS.map((s) => ({
  id: `curated-food-${s.id}`,
  name: s.name,
  category: "food",
  location: { ...AREA[s.area] },
  localizedDescriptions: {
    ja: `${s.specialty}の店（愛媛の郷土料理・名物）※位置は目安`,
    en: `Local Ehime specialty: ${s.specialty} (approx. location)`,
  },
  reviews: [],
  imageUrls: [],
  ...(s.website ? { website: s.website } : {}),
}));
