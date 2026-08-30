/**
 * Fallback_Plan_Pool: 収録済み愛媛旅程プラン。
 *
 * Recommendation_API の縮退応答（`api/_recommendation-fallback.ts` 経由）と
 * MockChatAdapter の両方がこの 1 定義を使う。EHIME_SPOTS の実座標だけを使い、
 * ここで組み立てた時点で Itinerary_Contract を満たすことを構築時に検査する。
 *
 * DOM / React / import.meta / 環境変数は参照しない（`api/` から読まれるため）。
 */
import type { RouteCandidateKind } from "../domain/types";
import { type ItineraryPlan, itineraryPlanViolations } from "../domain/itineraryContract";
import { haversineDistanceMeters } from "../domain/geofence";
import { EHIME_SPOTS } from "../adapters/mock/spots";

/**
 * 1 件の収録済み旅程を EHIME_SPOTS の実データから組み立てる。
 *
 * 契約違反はモジュール読み込み時に `throw` させる。未知の spot id、プラン内で
 * 重複した spot、stops が 2〜4 件でない、先頭 stop から 5km を超える立寄先、
 * そして {@link itineraryPlanViolations} が挙げる違反のいずれもデプロイ前に
 * 落ちるので、Fallback_Plan_Pool が契約を満たさない状態で出荷されることはない
 * （Requirement 2.3 の構築時保証）。
 */
function fallbackPlan(
  id: string,
  icon: string,
  title: string,
  summary: string,
  imageUrl: string,
  stopSpecs: Array<{ spotId: string; kind: RouteCandidateKind }>,
): ItineraryPlan {
  const times = ["09:00", "11:30", "14:00", "16:00"];
  const seen = new Set<string>();
  const stops = stopSpecs.map(({ spotId, kind }, index) => {
    const spot = EHIME_SPOTS.find((candidate) => candidate.id === spotId);
    if (!spot || seen.has(spot.id)) {
      throw new Error(`Invalid fallback plan spot: ${spotId}`);
    }
    seen.add(spot.id);
    return {
      time: times[index],
      kind,
      title: spot.name,
      description: spot.localizedDescriptions.ja ?? `${spot.name}をゆっくり楽しみます。`,
      searchQuery: `${spot.name} 愛媛県`,
      place: {
        id: spot.id,
        name: spot.name,
        formattedAddress: "愛媛県",
        location: spot.location,
        ...(spot.website ? { websiteUri: spot.website } : {}),
        ...(spot.imageUrls[0] ? { photoUrl: spot.imageUrls[0] } : {}),
      },
    };
  });
  const center = stops[0]?.place.location;
  if (
    !center
    || stops.length < 2
    || stops.length > 4
    || stops.some((stop) => haversineDistanceMeters(center, stop.place.location) > 5_000)
  ) {
    throw new Error(`Fallback plan ${id} must contain two to four stops within 5km.`);
  }
  const plan: ItineraryPlan = {
    id,
    mode: "tourism",
    icon,
    title,
    summary,
    reason: "愛媛らしい景色と文化を無理のない流れで楽しめる組み合わせです。",
    duration: "約4時間",
    transport: "車＋徒歩",
    intensity: "ふつう",
    imageUrl,
    area: { center, radiusMeters: 5_000 },
    stops,
  };
  const violations = itineraryPlanViolations(plan);
  if (violations.length > 0) {
    throw new Error(
      `Fallback plan ${id} violates the itinerary contract: ${violations.join(", ")}`,
    );
  }
  return plan;
}

/**
 * 収録済みフォールバック旅程。上から順に採用される。
 *
 * Plan_Count（5）より多い 8 件を持つのは、AI 生成 slug の偶然の衝突や
 * Exclusion_List が Fallback プランを指した場合でも 5 件に届かず 502 に落ちる
 * ことを避けるため。id / 正規化タイトル / 先頭 stop の place.id は 8 件間で
 * 重複しない。
 */
export const RECOMMENDATION_FALLBACK_PLANS: ItineraryPlan[] = [
  fallbackPlan("matsuyama", "🏯", "松山の王道と郷土料理", "松山城と愛媛の味を巡る定番コース。", "/images/ehime/matsuyama-castle.jpg", [
    { spotId: "osm-node-611661255", kind: "sightseeing" },
    { spotId: "curated-food-gansui-matsuyama", kind: "food" },
  ]),
  fallbackPlan("dogo", "♨️", "道後でほどける温泉旅", "温泉街をのんびり楽しみます。", "/images/ehime/onsen-bath.jpg", [
    { spotId: "osm-way-235751036", kind: "sightseeing" },
    { spotId: "osm-node-5697638322", kind: "sightseeing" },
  ]),
  fallbackPlan("uwajima", "🏯", "宇和島の城下町と味", "宇和島の歴史と郷土料理に触れる旅。", "/images/ehime/uwajima-castle.jpg", [
    { spotId: "osm-node-3698448508", kind: "sightseeing" },
    { spotId: "osm-node-1423733742", kind: "sightseeing" },
    { spotId: "curated-food-hozumitei-uwajima", kind: "food" },
  ]),
  fallbackPlan("imabari", "🍳", "今治のご当地グルメ旅", "今治名物を食べ比べる気軽な旅。", "/images/ehime/imabari-castle.jpg", [
    { spotId: "curated-food-hakurakuten-imabari", kind: "food" },
    { spotId: "curated-food-shigematsu-imabari", kind: "food" },
  ]),
  fallbackPlan("mitsuhama", "🌊", "三津浜のまち歩きと味", "港町で名物の三津浜焼きを楽しみます。", "/images/ehime/seaside-rails.jpg", [
    { spotId: "curated-food-hinode-mitsuhama", kind: "food" },
    { spotId: "curated-food-konaya-mitsuhama", kind: "food" },
  ]),
  fallbackPlan("okaido", "🍊", "大街道の食べ歩きと柑橘スイーツ", "商店街で郷土料理と柑橘スイーツをはしごします。", "/images/ehime/garden-zashiki.jpg", [
    { spotId: "curated-food-kadoya-okaido", kind: "food" },
    { spotId: "curated-food-tenfactory-matsuyama", kind: "cafe" },
  ]),
  fallbackPlan("nabeyaki", "🍲", "松山の鍋焼きうどんとおやつ", "老舗の鍋焼きうどんを食べ比べ、労研饅頭で一息つきます。", "/images/ehime/michi-no-eki.jpg", [
    { spotId: "curated-food-kotori-matsuyama", kind: "food" },
    { spotId: "curated-food-asahi-matsuyama", kind: "food" },
    { spotId: "curated-food-takeuchi-matsuyama", kind: "cafe" },
  ]),
  fallbackPlan("uwajima-jakoten", "🐟", "宇和島のじゃこ天と練り物", "宇和島の練り物と鯛めしを味わう食べ歩き。", "/images/ehime/sotodomari-village.jpg", [
    { spotId: "curated-food-yasuoka-kamaboko-uwajima", kind: "food" },
    { spotId: "curated-food-hozumitei-uwajima", kind: "food" },
  ]),
];
