/**
 * Mock ChatPort adapter.
 *
 * Produces a mock same-day pilgrimage plan whose timeline stops are in
 * ascending time order (Req 12.2 / Property 22), plus mock route candidates and
 * route orderings. Pure stub — no network (Req 3.6 / 16.2).
 */

import type {
  ChatPort,
  LangCode,
  NextTempleNavEstimate,
  NextTempleNavInput,
  PilgrimagePlan,
  PlanInput,
  PlanStop,
  RecommendedPlansInput,
  RecommendedPlansResult,
  RouteCandidate,
  RouteCandidatesInput,
  RouteCandidatesResult,
  TourismRoutePlan,
  TourismRoutePlanInput,
} from "../../ports";
import {
  CANDIDATE_BASE_RADIUS_METERS,
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_MINIMUM_COUNT,
  clampCandidateCount,
  finalizeCandidates,
} from "../../domain/candidateFallback";
import { DEFAULT_FALLBACK_POOLS } from "../../data/fallbackPools";
import { RECOMMENDATION_FALLBACK_PLANS } from "../../data/recommendationFallbackPlans";
import { ITINERARY_PLAN_COUNT } from "../../domain/itineraryContract";
import { haversineDistanceMeters } from "../../domain/geofence";
import { estimateLocalTempleNav, cleanTempleAddress } from "../../domain/templeNav";
import { EHIME_SPOTS } from "./spots";

/** Resolve a per-language value with English then Japanese fallback. */
function forLang<T>(map: Partial<Record<LangCode, T>>, lang: LangCode): T {
  return (map[lang] ?? map.en ?? map.ja) as T;
}

/**
 * Mock swipe candidates settled through the shared finalisation logic, so the
 * mock adapter obeys the same count clamping, radius expansion and Fallback
 * rules as `api/route-candidates.ts` (Req 6.1-6.4 / Property 13).
 */
function mockRouteCandidates(input: RouteCandidatesInput): RouteCandidatesResult {
  const usedPlaceIds = input.route.map((stop) => stop.placeId);
  const used = new Set(usedPlaceIds);
  let pool = EHIME_SPOTS.filter(
    (spot) => !used.has(spot.id)
      && haversineDistanceMeters(input.area.center, spot.location) <= input.area.radiusMeters,
  );
  if (input.kind === "food" || input.kind === "cafe") {
    pool = pool.filter((spot) => spot.category === "food");
    if (input.kind === "cafe") {
      const cafes = pool.filter((spot) => /カフェ|珈琲|コーヒー|茶|菓子|スイーツ/i.test(spot.name));
      if (cafes.length >= 3) pool = cafes;
    }
  } else if (input.kind === "sightseeing") {
    pool = pool.filter((spot) => spot.category !== "food");
  }

  const count = clampCandidateCount(
    input.count,
    input.kind === "cafe" ? 4 : 6,
    input.kind === "sightseeing" ? CANDIDATE_MINIMUM_COUNT : 3,
  );
  const primary: RouteCandidate[] = pool.slice(0, count).map((spot) => ({
    id: `${input.kind}:${spot.id}`,
    kind: input.kind,
    title: spot.name,
    description:
      spot.localizedDescriptions[input.lang] ??
      spot.localizedDescriptions.ja ??
      `${spot.name}を楽しめるスポットです。`,
    searchQuery: spot.name,
    place: {
      id: spot.id,
      name: spot.name,
      formattedAddress: "愛媛県",
      location: spot.location,
      ...(spot.website ? { websiteUri: spot.website } : {}),
      ...(spot.imageUrls[0] ? { photoUrl: spot.imageUrls[0] } : {}),
    },
  }));

  return finalizeCandidates(
    primary,
    {
      kind: input.kind,
      lang: input.lang,
      center: input.area.center,
      baseRadiusMeters: Math.min(CANDIDATE_BASE_RADIUS_METERS, input.area.radiusMeters),
      usedPlaceIds,
      maximumCount: CANDIDATE_MAXIMUM_COUNT,
    },
    DEFAULT_FALLBACK_POOLS,
  );
}

function mockTourismRoutePlan(input: TourismRoutePlanInput): TourismRoutePlan {
  if (input.selectedStops.length === 0) return { stops: [] };

  const routeFrom = (startIndex: number): TourismRoutePlanInput["selectedStops"] => {
    const remaining = [...input.selectedStops];
    const ordered = [remaining.splice(startIndex, 1)[0]];
    while (remaining.length > 0) {
      const previous = ordered[ordered.length - 1];
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      remaining.forEach((candidate, index) => {
        const distance = haversineDistanceMeters(previous.location, candidate.location);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      ordered.push(remaining.splice(nearestIndex, 1)[0]);
    }
    return ordered;
  };
  const routeDistance = (stops: TourismRoutePlanInput["selectedStops"]): number => stops
    .slice(1)
    .reduce((total, stop, index) => total + haversineDistanceMeters(stops[index].location, stop.location), 0);

  let ordered = input.selectedStops
    .map((_, index) => routeFrom(index))
    .reduce((best, candidate) => routeDistance(candidate) < routeDistance(best) ? candidate : best);

  const mealIndex = ordered.findIndex((stop) => stop.kind === "food");
  if (mealIndex >= 0 && ordered.length >= 3) {
    const [meal] = ordered.splice(mealIndex, 1);
    const lunchIndex = Math.min(ordered.length, Math.max(1, Math.round(ordered.length * 0.35)));
    ordered.splice(lunchIndex, 0, meal);
  }

  const [startHours = "09", startMinutes = "00"] = (input.startTime ?? "09:00").split(":");
  let cursor = Number(startHours) * 60 + Number(startMinutes);
  const dwellMinutes = Math.max(35, Math.min(65, Math.floor(540 / ordered.length)));
  return {
    stops: ordered.map((stop, index) => {
      const result = { candidateId: stop.candidateId, time: formatTime(cursor) };
      const next = ordered[index + 1];
      if (next) {
        const travelMinutes = Math.max(10, Math.round(haversineDistanceMeters(stop.location, next.location) / 500));
        cursor += dwellMinutes + travelMinutes;
      }
      return result;
    }),
  };
}

export class MockChatAdapter implements ChatPort {
  /**
   * The mock stands in for AI generation, so it never reports a degraded
   * response and hands back the first {@link ITINERARY_PLAN_COUNT} plans of the
   * shared Fallback_Plan_Pool (Req 1.5). Plans and stops are shallow-copied so
   * callers cannot mutate the pool.
   */
  async generateRecommendedPlans(
    _input: RecommendedPlansInput,
  ): Promise<RecommendedPlansResult> {
    return {
      plans: RECOMMENDATION_FALLBACK_PLANS.map((plan) => ({
        ...plan,
        stops: plan.stops.map((stop) => ({ ...stop })),
      })).slice(0, ITINERARY_PLAN_COUNT),
      degraded: false,
    };
  }

  async generateRouteCandidates(
    input: RouteCandidatesInput,
  ): Promise<RouteCandidatesResult> {
    return mockRouteCandidates(input);
  }

  async generateTourismRoutePlan(
    input: TourismRoutePlanInput,
  ): Promise<TourismRoutePlan> {
    return mockTourismRoutePlan(input);
  }

  async generatePilgrimagePlan(input: PlanInput): Promise<PilgrimagePlan> {
    return { stops: buildPlanStops(input) };
  }

  async estimateNextTempleNav(
    input: NextTempleNavInput,
  ): Promise<NextTempleNavEstimate> {
    return localNavEstimate(input);
  }
}

/** Localized generic access note for the local (non-AI) nav estimate. */
const NAV_NOTE: Partial<Record<LangCode, string>> = {
  ja: "山門近くに駐車場がある札所が多いですが、時間帯により混雑します。時間には余裕をもって向かいましょう。",
  iyo: "山門の近くに駐車場がある札所が多いけんど、時間帯によっては混むけん、余裕もって行きよ。",
  en: "Many temples have parking near the main gate, but it can get busy at peak times — allow extra time to get there.",
  "zh-Hans": "多数札所在山门附近设有停车场，但高峰时段较拥挤，请预留充裕时间前往。",
  "zh-Hant": "多數札所在山門附近設有停車場，但尖峰時段較擁擠，請預留充裕時間前往。",
  ko: "많은 사찰이 산문 근처에 주차장을 갖추고 있지만 혼잡할 수 있으니 여유 있게 출발하세요.",
  th: "วัดหลายแห่งมีที่จอดรถใกล้ประตูหลัก แต่ช่วงเวลาเร่งด่วนอาจแออัด ควรเผื่อเวลาเดินทาง",
  fr: "De nombreux temples disposent d'un parking près de la porte principale, mais il peut être bondé aux heures de pointe — prévoyez du temps.",
  de: "Viele Tempel haben Parkplätze nahe dem Haupttor, die zu Stoßzeiten voll sein können — plane etwas Zeit ein.",
  es: "Muchos templos tienen aparcamiento cerca de la puerta principal, pero puede llenarse en horas punta; deja tiempo de sobra.",
  pt: "Muitos templos têm estacionamento perto do portão principal, mas pode lotar nos horários de pico — reserve tempo extra.",
  vi: "Nhiều chùa có bãi đỗ xe gần cổng chính, nhưng có thể đông vào giờ cao điểm — hãy dự trù thêm thời gian.",
  id: "Banyak kuil memiliki parkir dekat gerbang utama, tetapi bisa ramai saat jam sibuk — sediakan waktu lebih.",
  ar: "توجد مواقف سيارات قرب البوابة الرئيسية في كثير من المعابد، لكنها قد تزدحم في أوقات الذروة — خصّص وقتًا إضافيًا.",
  ru: "У многих храмов есть парковка у главных ворот, но в час пик бывает многолюдно — заложите время с запасом.",
  hi: "कई मंदिरों में मुख्य द्वार के पास पार्किंग है, पर व्यस्त समय में भीड़ हो सकती है — पहुँचने के लिए अतिरिक्त समय रखें।",
};

/**
 * Local heuristic next-temple estimate used by the mock adapter and as the
 * fallback. Numbers come from the pure {@link estimateLocalTempleNav}; the
 * highlights are echoed from the input and the note is a localized generic tip.
 * Marked `aiGenerated: false` so the UI can label it honestly (still a 目安).
 */
function localNavEstimate(input: NextTempleNavInput): NextTempleNavEstimate {
  const numbers = estimateLocalTempleNav(input.from, input.temple.location);
  return {
    ...numbers,
    address: cleanTempleAddress(input.temple.address),
    highlights: input.temple.highlights ?? [],
    note: forLang(NAV_NOTE, input.lang ?? "ja"),
    aiGenerated: false,
  };
}

/** Localized labels for the mock plan timeline stops (Req 1.x / 19.x). */
const PLAN_LABELS: Partial<
  Record<LangCode, { temple: (id: string) => string; meal: string; spot: string }>
> = {
  ja: { temple: (id) => `札所参拝: ${id}`, meal: "お昼ごはん", spot: "周辺観光スポット" },
  iyo: { temple: (id) => `札所参り: ${id}`, meal: "お昼ごはん", spot: "近くの観光スポット" },
  en: { temple: (id) => `Temple visit: ${id}`, meal: "Lunch", spot: "Nearby sightseeing spot" },
  "zh-Hans": { temple: (id) => `参拜札所：${id}`, meal: "午餐", spot: "周边观光景点" },
  "zh-Hant": { temple: (id) => `參拜札所：${id}`, meal: "午餐", spot: "周邊觀光景點" },
  ko: { temple: (id) => `사찰 참배: ${id}`, meal: "점심 식사", spot: "주변 관광 스팟" },
  th: { temple: (id) => `เยี่ยมชมวัด: ${id}`, meal: "มื้อกลางวัน", spot: "จุดท่องเที่ยวใกล้เคียง" },
  fr: { temple: (id) => `Visite du temple : ${id}`, meal: "Déjeuner", spot: "Site touristique à proximité" },
  de: { temple: (id) => `Tempelbesuch: ${id}`, meal: "Mittagessen", spot: "Sehenswürdigkeit in der Nähe" },
  es: { temple: (id) => `Visita al templo: ${id}`, meal: "Almuerzo", spot: "Punto turístico cercano" },
  pt: { temple: (id) => `Visita ao templo: ${id}`, meal: "Almoço", spot: "Ponto turístico próximo" },
  vi: { temple: (id) => `Viếng chùa: ${id}`, meal: "Bữa trưa", spot: "Điểm tham quan lân cận" },
  id: { temple: (id) => `Kunjungan kuil: ${id}`, meal: "Makan siang", spot: "Tempat wisata terdekat" },
  ar: { temple: (id) => `زيارة المعبد: ${id}`, meal: "الغداء", spot: "موقع سياحي قريب" },
  ru: { temple: (id) => `Посещение храма: ${id}`, meal: "Обед", spot: "Достопримечательность рядом" },
  hi: { temple: (id) => `मंदिर दर्शन: ${id}`, meal: "दोपहर का भोजन", spot: "पास का पर्यटन स्थल" },
};

/**
 * Builds a timeline guaranteed to be in ascending time order. Starts at 09:00
 * and advances a per-transport step between stops; inserts a lunch stop and an
 * optional sightseeing stop when there is room in the schedule.
 */
function buildPlanStops(input: PlanInput): PlanStop[] {
  const stepMinutes =
    input.transport === "walk" ? 90 : input.transport === "bike" ? 60 : 40;

  const labels = forLang(PLAN_LABELS, input.lang ?? "ja");

  let cursor = 9 * 60; // minutes from midnight, i.e. 09:00
  const end = 9 * 60 + Math.max(0, input.availableMinutes);
  const stops: PlanStop[] = [];

  const push = (label: string, kind: PlanStop["kind"]) => {
    if (cursor > end) return;
    stops.push({ time: formatTime(cursor), label, kind });
    cursor += stepMinutes;
  };

  const temples =
    input.desiredTemples.length > 0
      ? input.desiredTemples
      : ["ehime-51", "ehime-50"];

  temples.forEach((templeId, index) => {
    push(labels.temple(templeId), "temple");
    // Drop a lunch break roughly midway through the temple visits.
    if (input.includeSightseeing && index === Math.floor(temples.length / 2)) {
      push(labels.meal, "meal");
    }
  });

  if (input.includeSightseeing) {
    push(labels.spot, "spot");
  }

  return stops;
}

/** Formats minutes-from-midnight as a zero-padded "HH:MM" 24h string. */
function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}
