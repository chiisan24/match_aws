/**
 * Itinerary_Contract and Fallback_Plan_Pool, resolved for the Vercel function.
 *
 * This module used to re-export `src/domain/itineraryContract.ts` and
 * `src/data/recommendationFallbackPlans.ts` (the `api/_fallback-candidates.ts`
 * bridge convention). That works locally, where the vite dev plugin bundles the
 * handler and its whole import graph together, but not on Vercel: the function
 * build compiles `api/*.ts` to `.js` and never emits anything for `src/`, so the
 * `../src/**.js` specifiers failed to resolve at load time. The module error
 * happened before the handler body ran, so the 502 degradation path could not
 * catch it and every `/api/recommendations` call answered 500.
 *
 * So the contract and the pool live here as well, with no import that leaves
 * `api/`. The `src/` copies stay in place for the client and the mock adapter;
 * `api/_recommendation-fallback.test.ts` fails the build if the two drift apart,
 * and also fails if a `../src/` import reappears in this file.
 */

/** Provenance of a plan in a recommendations response. */
type ItineraryPlanOrigin = "ai" | "cache" | "fallback";

/**
 * A place attached to an itinerary stop.
 *
 * Structurally the same shape as `EnrichedPlace` in `api/_google-places.ts` and
 * `RecommendedPlace` in `src/domain/types.ts`, declared here so this module has
 * no import at all.
 */
interface ItineraryPlace {
  id: string;
  name: string;
  formattedAddress: string;
  location?: { lat: number; lng: number };
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: string[];
  photoUrl?: string;
  photoAttributions?: Array<{ displayName: string; uri?: string }>;
}

/** One stop on an itinerary. Mirrors `PlanStop` in `api/recommendations.ts`. */
interface ItineraryStop {
  time: string;
  kind: "sightseeing" | "food" | "cafe" | "custom";
  title: string;
  description: string;
  searchQuery: string;
  place?: ItineraryPlace;
}

/**
 * A tourism itinerary as the recommendations response carries it.
 *
 * Assignable to `RecommendationPlan` in `api/recommendations.ts` without a cast,
 * which is what lets `FALLBACK_PLANS` take {@link RECOMMENDATION_FALLBACK_PLANS}
 * directly.
 */
export interface ItineraryPlan {
  id: string;
  mode: "tourism";
  icon: string;
  title: string;
  summary: string;
  reason: string;
  duration: string;
  transport: string;
  intensity: string;
  imageUrl?: string;
  imageAttributions?: Array<{ displayName: string; uri?: string }>;
  area?: { center: { lat: number; lng: number }; radiusMeters: number };
  stops: ItineraryStop[];
  /** Omitted until synthesis assigns one. */
  origin?: ItineraryPlanOrigin;
}

/** Required number of recommendations (Plan_Count). */
export const ITINERARY_PLAN_COUNT = 5;
/** 24-hour `HH:MM`. */
export const ITINERARY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
/** Stop kinds the contract accepts, mirroring `RouteCandidateKind`. */
export const ITINERARY_KINDS = new Set(["sightseeing", "food", "cafe", "custom"]);

/** A plan before validation: the fields the contract reads are still unknown. */
interface UnvalidatedPlan {
  mode?: unknown;
  stops?: unknown;
}

/** A stop before validation: the fields the contract reads are still unknown. */
interface UnvalidatedStop {
  time?: unknown;
  kind?: unknown;
  title?: unknown;
  place?: { location?: { lat?: unknown; lng?: unknown } };
}

/**
 * Reads any value as a plan-shaped record.
 *
 * A non-object becomes an empty record so the checks below still run and report
 * `mode` / `stopCount` instead of needing a violation of their own.
 */
function asPlan(value: unknown): UnvalidatedPlan {
  return typeof value === "object" && value !== null ? (value as UnvalidatedPlan) : {};
}

/** Reads any value as a stop-shaped record. See {@link asPlan}. */
function asStop(value: unknown): UnvalidatedStop {
  return typeof value === "object" && value !== null ? (value as UnvalidatedStop) : {};
}

/**
 * Contract violations of a single plan. Empty means the plan conforms.
 *
 * The conditions are the ones the Plan_First_Screen used to carry inline, so a
 * plan conforms iff this returns an empty array. Unlike a predicate the scan
 * does not stop at the first failure: one call reports every violated rule for
 * the server log, which means a stop with a malformed `time` may additionally
 * be reported as out of order.
 */
export function itineraryPlanViolations(value: unknown): string[] {
  const plan = asPlan(value);
  const violations: string[] = [];

  if (plan.mode !== "tourism") {
    violations.push("mode");
  }

  const stops = Array.isArray(plan.stops) ? (plan.stops as unknown[]) : [];
  if (!Array.isArray(plan.stops) || stops.length < 2 || stops.length > 4) {
    violations.push("stopCount");
  }

  let previousTime = "";
  stops.forEach((entry, index) => {
    const stop = asStop(entry);
    const time = String(stop.time ?? "");
    const location = stop.place?.location;

    if (!ITINERARY_TIME_PATTERN.test(time)) {
      violations.push(`stop[${index}].time`);
    }
    // The first stop has no predecessor, so an empty `previousTime` passes.
    if (previousTime && time <= previousTime) {
      violations.push(`stop[${index}].order`);
    }
    if (typeof stop.kind !== "string" || !ITINERARY_KINDS.has(stop.kind)) {
      violations.push(`stop[${index}].kind`);
    }
    if (typeof stop.title !== "string" || stop.title.trim() === "") {
      violations.push(`stop[${index}].title`);
    }
    if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
      violations.push(`stop[${index}].location`);
    }

    previousTime = time;
  });

  return violations;
}

/** Type guard form of {@link itineraryPlanViolations}. */
export function isItineraryPlan(value: unknown): value is ItineraryPlan {
  return itineraryPlanViolations(value).length === 0;
}

/** Exactly {@link ITINERARY_PLAN_COUNT} conforming tourism itineraries. */
export function isTourismRecommendations(value: unknown): value is ItineraryPlan[] {
  return Array.isArray(value)
    && value.length === ITINERARY_PLAN_COUNT
    && value.every((plan) => isItineraryPlan(plan));
}

/** Shared by every fallback itinerary. */
const FALLBACK_REASON = "愛媛らしい景色と文化を無理のない流れで楽しめる組み合わせです。";
const FALLBACK_DURATION = "約4時間";
const FALLBACK_TRANSPORT = "車＋徒歩";
const FALLBACK_INTENSITY = "ふつう";
const FALLBACK_ADDRESS = "愛媛県";
const FALLBACK_RADIUS_METERS = 5_000;

/**
 * Fallback_Plan_Pool: the canned Ehime itineraries a degraded response draws on.
 *
 * The `src/` original assembles these from `EHIME_SPOTS` at module load; here
 * they are the resolved values, dumped from that module rather than retyped, so
 * `api/` needs neither the spot dataset nor the geofence helper. The pool holds
 * 8 plans rather than Plan_Count (5) so that an accidental slug collision or an
 * Exclusion_List pointing at fallback plans still leaves 5 to serve. `id`, the
 * normalized title and the first stop's `place.id` are unique across the 8.
 */
export const RECOMMENDATION_FALLBACK_PLANS: ItineraryPlan[] = [
  {
    id: "matsuyama",
    mode: "tourism",
    icon: "🏯",
    title: "松山の王道と郷土料理",
    summary: "松山城と愛媛の味を巡る定番コース。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/matsuyama-castle.jpg",
    area: {
      center: { lat: 33.845651, lng: 132.765746 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "sightseeing",
        title: "松山城",
        description: "松山城（観光スポット）",
        searchQuery: "松山城 愛媛県",
        place: {
          id: "osm-node-611661255",
          name: "松山城",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.845651, lng: 132.765746 },
          websiteUri: "https://www.matsuyamajo.jp/",
        },
      },
      {
        time: "11:30",
        kind: "food",
        title: "宇和島鯛めし 丸水 松山店",
        description: "宇和島鯛めしの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "宇和島鯛めし 丸水 松山店 愛媛県",
        place: {
          id: "curated-food-gansui-matsuyama",
          name: "宇和島鯛めし 丸水 松山店",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8456, lng: 132.769 },
          websiteUri: "https://gansui.jp/",
        },
      },
    ],
  },
  {
    id: "dogo",
    mode: "tourism",
    icon: "♨️",
    title: "道後でほどける温泉旅",
    summary: "温泉街をのんびり楽しみます。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/onsen-bath.jpg",
    area: {
      center: { lat: 33.852067, lng: 132.786405 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "sightseeing",
        title: "道後温泉本館",
        description: "道後温泉本館（温泉・入浴）",
        searchQuery: "道後温泉本館 愛媛県",
        place: {
          id: "osm-way-235751036",
          name: "道後温泉本館",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.852067, lng: 132.786405 },
          websiteUri: "https://dogo.jp/onsen/honkan",
        },
      },
      {
        time: "11:30",
        kind: "sightseeing",
        title: "振鷺閣",
        description:
          "振鷺閣は、松山市の道後温泉本館の屋上にある小さな楼閣と太鼓楼です。白鷺像と伝統的な太鼓が特徴で、温泉の伝説的な起源と地域の伝統を象徴しています。",
        searchQuery: "振鷺閣 愛媛県",
        place: {
          id: "osm-node-5697638322",
          name: "振鷺閣",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.852104, lng: 132.786432 },
        },
      },
    ],
  },
  {
    id: "uwajima",
    mode: "tourism",
    icon: "🏯",
    title: "宇和島の城下町と味",
    summary: "宇和島の歴史と郷土料理に触れる旅。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/uwajima-castle.jpg",
    area: {
      center: { lat: 33.219731, lng: 132.564662 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "sightseeing",
        title: "宇和島城",
        description: "宇和島城（観光スポット）",
        searchQuery: "宇和島城 愛媛県",
        place: {
          id: "osm-node-3698448508",
          name: "宇和島城",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.219731, lng: 132.564662 },
        },
      },
      {
        time: "11:30",
        kind: "sightseeing",
        title: "宇和島市立歴史資料館",
        description: "宇和島市立歴史資料館（観光スポット）",
        searchQuery: "宇和島市立歴史資料館 愛媛県",
        place: {
          id: "osm-node-1423733742",
          name: "宇和島市立歴史資料館",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.226452, lng: 132.554664 },
        },
      },
      {
        time: "14:00",
        kind: "food",
        title: "ほづみ亭",
        description: "宇和島鯛めしの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "ほづみ亭 愛媛県",
        place: {
          id: "curated-food-hozumitei-uwajima",
          name: "ほづみ亭",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.2233, lng: 132.5606 },
        },
      },
    ],
  },
  {
    id: "imabari",
    mode: "tourism",
    icon: "🍳",
    title: "今治のご当地グルメ旅",
    summary: "今治名物を食べ比べる気軽な旅。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/imabari-castle.jpg",
    area: {
      center: { lat: 34.0658, lng: 132.9975 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "food",
        title: "白楽天 今治本店",
        description: "今治焼豚玉子飯の店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "白楽天 今治本店 愛媛県",
        place: {
          id: "curated-food-hakurakuten-imabari",
          name: "白楽天 今治本店",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 34.0658, lng: 132.9975 },
          websiteUri: "https://hakurakuten.net/",
        },
      },
      {
        time: "11:30",
        kind: "food",
        title: "重松飯店",
        description: "焼豚玉子飯（発祥の店）の店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "重松飯店 愛媛県",
        place: {
          id: "curated-food-shigematsu-imabari",
          name: "重松飯店",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 34.0658, lng: 132.9975 },
        },
      },
    ],
  },
  {
    id: "mitsuhama",
    mode: "tourism",
    icon: "🌊",
    title: "三津浜のまち歩きと味",
    summary: "港町で名物の三津浜焼きを楽しみます。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/seaside-rails.jpg",
    area: {
      center: { lat: 33.8745, lng: 132.7118 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "food",
        title: "日の出",
        description: "三津浜焼きの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "日の出 愛媛県",
        place: {
          id: "curated-food-hinode-mitsuhama",
          name: "日の出",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8745, lng: 132.7118 },
        },
      },
      {
        time: "11:30",
        kind: "food",
        title: "こなや",
        description: "三津浜焼きの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "こなや 愛媛県",
        place: {
          id: "curated-food-konaya-mitsuhama",
          name: "こなや",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8745, lng: 132.7118 },
        },
      },
    ],
  },
  {
    id: "okaido",
    mode: "tourism",
    icon: "🍊",
    title: "大街道の食べ歩きと柑橘スイーツ",
    summary: "商店街で郷土料理と柑橘スイーツをはしごします。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/garden-zashiki.jpg",
    area: {
      center: { lat: 33.8456, lng: 132.769 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "food",
        title: "かどや 大街道店",
        description: "鯛めし・郷土料理の店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "かどや 大街道店 愛媛県",
        place: {
          id: "curated-food-kadoya-okaido",
          name: "かどや 大街道店",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8456, lng: 132.769 },
        },
      },
      {
        time: "11:30",
        kind: "cafe",
        title: "10 FACTORY 松山本店",
        description: "みかんジュース・柑橘スイーツの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "10 FACTORY 松山本店 愛媛県",
        place: {
          id: "curated-food-tenfactory-matsuyama",
          name: "10 FACTORY 松山本店",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8456, lng: 132.769 },
          websiteUri: "https://10-factory.com/",
        },
      },
    ],
  },
  {
    id: "nabeyaki",
    mode: "tourism",
    icon: "🍲",
    title: "松山の鍋焼きうどんとおやつ",
    summary: "老舗の鍋焼きうどんを食べ比べ、労研饅頭で一息つきます。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/michi-no-eki.jpg",
    area: {
      center: { lat: 33.8416, lng: 132.7657 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "food",
        title: "ことり",
        description: "松山の鍋焼きうどんの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "ことり 愛媛県",
        place: {
          id: "curated-food-kotori-matsuyama",
          name: "ことり",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8416, lng: 132.7657 },
        },
      },
      {
        time: "11:30",
        kind: "food",
        title: "アサヒ",
        description: "松山の鍋焼きうどんの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "アサヒ 愛媛県",
        place: {
          id: "curated-food-asahi-matsuyama",
          name: "アサヒ",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8416, lng: 132.7657 },
        },
      },
      {
        time: "14:00",
        kind: "cafe",
        title: "たけうち",
        description: "労研饅頭の店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "たけうち 愛媛県",
        place: {
          id: "curated-food-takeuchi-matsuyama",
          name: "たけうち",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.8416, lng: 132.7657 },
        },
      },
    ],
  },
  {
    id: "uwajima-jakoten",
    mode: "tourism",
    icon: "🐟",
    title: "宇和島のじゃこ天と練り物",
    summary: "宇和島の練り物と鯛めしを味わう食べ歩き。",
    reason: FALLBACK_REASON,
    duration: FALLBACK_DURATION,
    transport: FALLBACK_TRANSPORT,
    intensity: FALLBACK_INTENSITY,
    imageUrl: "/images/ehime/sotodomari-village.jpg",
    area: {
      center: { lat: 33.2233, lng: 132.5606 },
      radiusMeters: FALLBACK_RADIUS_METERS,
    },
    stops: [
      {
        time: "09:00",
        kind: "food",
        title: "安岡蒲鉾（じゃこ天）",
        description: "じゃこ天・練り物の店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "安岡蒲鉾（じゃこ天） 愛媛県",
        place: {
          id: "curated-food-yasuoka-kamaboko-uwajima",
          name: "安岡蒲鉾（じゃこ天）",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.2233, lng: 132.5606 },
        },
      },
      {
        time: "11:30",
        kind: "food",
        title: "ほづみ亭",
        description: "宇和島鯛めしの店（愛媛の郷土料理・名物）※位置は目安",
        searchQuery: "ほづみ亭 愛媛県",
        place: {
          id: "curated-food-hozumitei-uwajima",
          name: "ほづみ亭",
          formattedAddress: FALLBACK_ADDRESS,
          location: { lat: 33.2233, lng: 132.5606 },
        },
      },
    ],
  },
];
