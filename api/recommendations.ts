import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorDetail } from "./_aws.js";
import { extractJson, invokeClaude } from "./_bedrock.js";
import { searchEhimePlace, type EnrichedPlace } from "./_google-places.js";

interface RawStop {
  time?: unknown;
  title?: unknown;
  description?: unknown;
  searchQuery?: unknown;
}

interface RawPlan {
  id?: unknown;
  mode?: unknown;
  icon?: unknown;
  title?: unknown;
  summary?: unknown;
  reason?: unknown;
  duration?: unknown;
  transport?: unknown;
  intensity?: unknown;
  stops?: unknown;
}

interface RecommendationExclusion {
  id: string;
  title: string;
  place: string;
  placeId?: string;
}

class InvalidRequestError extends Error {}

interface PlanStop {
  time: string;
  title: string;
  description: string;
  searchQuery: string;
  place?: EnrichedPlace;
}

interface RecommendationPlan {
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
  imageAttributions?: EnrichedPlace["photoAttributions"];
  area?: { center: { lat: number; lng: number }; radiusMeters: number };
  stops: PlanStop[];
}

function text(value: unknown, field: string, max = 240): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Bedrock recommendation is missing ${field}.`);
  }
  return value.trim().slice(0, max);
}

function requiredField(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidRequestError(`exclude[].${field} must be a non-empty string`);
  }
  return value.trim().slice(0, max);
}

function optionalField(value: unknown, field: string, max: number): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidRequestError(`exclude[].${field} must be a non-empty string when present`);
  }
  return value.trim().slice(0, max);
}

/**
 * Strictly validates the caller-provided exclusion list. A malformed `exclude`
 * is rejected instead of silently dropped so callers cannot believe a refresh
 * excluded past themes when it did not.
 */
function parseExclusions(value: unknown): RecommendationExclusion[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new InvalidRequestError("exclude must be an array");
  }
  if (value.length > 10) {
    throw new InvalidRequestError("exclude must contain at most 10 entries");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new InvalidRequestError("exclude[] entries must be objects");
    }
    const raw = item as {
      id?: unknown;
      title?: unknown;
      place?: unknown;
      placeId?: unknown;
    };
    const placeId = optionalField(raw.placeId, "placeId", 200);
    return {
      id: requiredField(raw.id, "id", 80),
      title: requiredField(raw.title, "title", 120),
      place: requiredField(raw.place, "place", 120),
      ...(placeId ? { placeId } : {}),
    };
  });
}

function comparisonKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function duplicateReasons(
  plans: RecommendationPlan[],
  exclusions: RecommendationExclusion[],
): string[] {
  const excludedIds = new Set(exclusions.map((item) => comparisonKey(item.id)).filter(Boolean));
  const excludedTitles = new Set(exclusions.map((item) => comparisonKey(item.title)).filter(Boolean));
  const excludedPlaces = new Set(exclusions.map((item) => comparisonKey(item.place)).filter(Boolean));
  const excludedPlaceIds = new Set(
    exclusions.map((item) => item.placeId ?? "").filter(Boolean),
  );
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const seenPlaces = new Set<string>();
  const seenPlaceIds = new Set<string>();
  const reasons: string[] = [];

  plans.forEach((plan) => {
    const id = comparisonKey(plan.id);
    const title = comparisonKey(plan.title);
    const searchQuery = plan.stops[0]?.searchQuery ?? "";
    const place = comparisonKey(searchQuery);
    // Google's canonical name and id are the only表記揺れ-proof signals, so they
    // are compared once enrichment has resolved the representative place.
    const placeName = comparisonKey(plan.stops[0]?.place?.name ?? "");
    const placeId = plan.stops[0]?.place?.id ?? "";
    if (excludedIds.has(id) || seenIds.has(id)) reasons.push(`id:${plan.id}`);
    if (excludedTitles.has(title) || seenTitles.has(title)) reasons.push(`title:${plan.title}`);
    if (excludedPlaces.has(place) || seenPlaces.has(place)) reasons.push(`place:${searchQuery}`);
    if (placeName && (excludedPlaces.has(placeName) || seenPlaces.has(placeName))) {
      reasons.push(`placeName:${plan.stops[0]?.place?.name ?? ""}`);
    }
    if (placeId && (excludedPlaceIds.has(placeId) || seenPlaceIds.has(placeId))) {
      reasons.push(`placeId:${placeId}`);
    }
    if (id) seenIds.add(id);
    if (title) seenTitles.add(title);
    if (place) seenPlaces.add(place);
    if (placeName) seenPlaces.add(placeName);
    if (placeId) seenPlaceIds.add(placeId);
  });
  return reasons;
}

function slug(value: unknown, index: number): string {
  const normalized = typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
    : "";
  return normalized.replace(/^-|-$/g, "").slice(0, 48) || `ehime-trip-${index + 1}`;
}

function normalizeStop(value: unknown, index: number): PlanStop {
  if (!value || typeof value !== "object") {
    throw new Error("Bedrock returned an invalid recommendation stop.");
  }
  const stop = value as RawStop;
  const proposedTime = typeof stop.time === "string" ? stop.time.trim() : "";
  return {
    time: /^\d{2}:\d{2}$/.test(proposedTime)
      ? proposedTime
      : `${String(9 + index * 2).padStart(2, "0")}:00`,
    title: text(stop.title, "stop.title", 100),
    description: text(stop.description, "stop.description", 240),
    searchQuery: text(stop.searchQuery ?? stop.title, "stop.searchQuery", 120),
  };
}

function normalizePlan(value: unknown, index: number): RecommendationPlan {
  if (!value || typeof value !== "object") {
    throw new Error("Bedrock returned an invalid recommendation plan.");
  }
  const plan = value as RawPlan;
  const rawStops = Array.isArray(plan.stops) ? plan.stops : [];
  if (rawStops.length !== 1) {
    throw new Error("Each theme must contain exactly one representative place.");
  }
  return {
    id: slug(plan.id, index),
    mode: "tourism",
    icon: text(plan.icon, "icon", 8),
    title: text(plan.title, "title", 120),
    summary: text(plan.summary, "summary", 240),
    reason: text(plan.reason, "reason", 320),
    duration: text(plan.duration, "duration", 40),
    transport: text(plan.transport, "transport", 40),
    intensity: text(plan.intensity, "intensity", 40),
    stops: rawStops.map(normalizeStop),
  };
}

async function enrichPlans(
  plans: RecommendationPlan[],
  lang: string,
): Promise<RecommendationPlan[]> {
  const cache = new Map<string, Promise<EnrichedPlace | null>>();
  const findPlace = (query: string): Promise<EnrichedPlace | null> => {
    const key = query.toLowerCase();
    const existing = cache.get(key);
    if (existing) return existing;
    const request = searchEhimePlace(query, lang).catch((error) => {
      console.error("Google Places enrichment failed", { query, error });
      return null;
    });
    cache.set(key, request);
    return request;
  };

  return Promise.all(
    plans.map(async (plan) => {
      const stops = await Promise.all(
        plan.stops.map(async (stop) => {
          const place = await findPlace(stop.searchQuery);
          return place ? { ...stop, place } : stop;
        }),
      );
      const heroPlace = stops.map((stop) => stop.place).find((place) => place?.photoUrl);
      return {
        ...plan,
        stops,
        ...(heroPlace?.location
          ? { area: { center: heroPlace.location, radiusMeters: 5_000 } }
          : {}),
        ...(heroPlace?.photoUrl ? { imageUrl: heroPlace.photoUrl } : {}),
        ...(heroPlace?.photoAttributions?.length
          ? { imageAttributions: heroPlace.photoAttributions }
          : {}),
      };
    }),
  );
}

interface RecommendationResult {
  plans: RecommendationPlan[];
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const recommendationCache = new Map<
  string,
  { expiresAt: number; result: RecommendationResult }
>();
const recommendationRequests = new Map<string, Promise<RecommendationResult>>();

function japanDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function recommendationPrompt(
  lang: string,
  exclusions: RecommendationExclusion[],
  retrying: boolean,
): string {
  return [
    "あなたは愛媛県専門の旅行プランナーです。",
    `基準日は ${japanDate()}。季節を意識した多様な日帰り旅行を提案してください。`,
    `表示文言は言語コード ${lang} で簡潔に書いてください。不明な場合は日本語にしてください。`,
    "愛媛県内に実在する場所を題材に、松山周辺に偏らない5つの大まかな旅行テーマを作ってください。",
    "5件すべてmodeをtourismにし、地域・景色・文化・体験などテーマを重複させないでください。",
    "各テーマのstopsは、テーマを象徴する代表的な実在スポットを必ず1件だけ含めてください。飲食店やカフェは含めないでください。",
    ...(exclusions.length > 0 ? [
      "次の過去候補と同じID・旅行テーマ・代表スポットは提案しないでください。表現を変えただけの実質同一テーマも避けてください。",
      `除外する過去候補: ${JSON.stringify(exclusions)}`,
    ] : []),
    ...(retrying ? ["前回は除外候補または生成結果内で重複がありました。必ず異なる地域・テーマ・代表スポットで作り直してください。"] : []),
    "summary・reason・各descriptionは要点だけを短く書いてください。",
    "searchQueryはGoogle Mapsで一意に検索できる正式な場所名にしてください。住所やURLは作らないでください。",
    "営業時間・料金・イベント開催を断定しないでください。",
    "出力は次のJSONだけにしてください。説明やコードフェンスは禁止です。",
    '{"plans":[{"id":"lowercase-slug","mode":"tourism","icon":"絵文字1つ","title":"...","summary":"...","reason":"...","duration":"...","transport":"...","intensity":"...","stops":[{"time":"09:00","title":"...","description":"...","searchQuery":"実在する施設名"}]}]}',
    "plansは必ずちょうど5件にしてください。",
  ].join("\n");
}

async function generateRecommendations(
  lang: string,
  exclusions: RecommendationExclusion[],
): Promise<RecommendationResult> {
  let lastDuplicates: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = await invokeClaude({
      system: recommendationPrompt(lang, exclusions, attempt > 0),
      messages: [{ role: "user", text: "今日の愛媛旅行テーマを5件生成してください。" }],
      maxTokens: 1800,
    });
    const parsed = extractJson<{ plans?: unknown }>(output);
    if (!Array.isArray(parsed?.plans) || parsed.plans.length !== 5) {
      throw new Error("Bedrock did not return exactly five recommendations.");
    }

    const normalized = parsed.plans.map(normalizePlan);
    if (new Set(normalized.map((plan) => plan.id)).size !== normalized.length) {
      normalized.forEach((plan, index) => {
        plan.id = `${plan.id}-${index + 1}`;
      });
    }
    const plans = await enrichPlans(normalized, lang);
    lastDuplicates = duplicateReasons(plans, exclusions);
    if (lastDuplicates.length === 0) return { plans };
  }
  throw new Error(`Bedrock repeated excluded recommendations: ${lastDuplicates.join(", ")}`);
}

function recommendationsFor(
  date: string,
  lang: string,
  bypassCache: boolean,
  exclusions: RecommendationExclusion[],
): Promise<RecommendationResult> {
  const now = Date.now();
  const cacheKey = `${date}:${lang}`;

  for (const [cachedKey, entry] of recommendationCache) {
    if (entry.expiresAt <= now) recommendationCache.delete(cachedKey);
  }

  if (!bypassCache) {
    const cached = recommendationCache.get(cacheKey);
    if (cached) return Promise.resolve(cached.result);
  }

  const requestKey = bypassCache
    ? `${cacheKey}:refresh:${JSON.stringify(exclusions)}`
    : cacheKey;
  const pending = recommendationRequests.get(requestKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const result = await generateRecommendations(lang, exclusions);
      // Refresh responses are tailored to one caller's exclusions, so they must
      // not become the shared default for later plain GETs on this instance.
      if (!bypassCache) {
        recommendationCache.set(cacheKey, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          result,
        });
      }
      return result;
    } finally {
      recommendationRequests.delete(requestKey);
    }
  })();
  recommendationRequests.set(requestKey, request);
  return request;
}

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body ?? {}) as {
      lang?: unknown;
      count?: unknown;
      date?: unknown;
      exclude?: unknown;
    };
    const source = req.method === "GET" ? req.query : body;
    const rawLang = firstQueryValue(source.lang);
    const rawCount = firstQueryValue(source.count);
    const rawDate = firstQueryValue(source.date);
    const lang = typeof rawLang === "string" ? rawLang.slice(0, 16) : "ja";
    if (rawCount != null && Number(rawCount) !== 5) {
      res.status(400).json({ error: "Exactly five recommendations are required" });
      return;
    }

    const currentDate = japanDate();
    const hasDate = typeof rawDate === "string" && rawDate !== "";
    const date = hasDate ? (rawDate as string) : currentDate;
    if (date !== currentDate) {
      res.status(400).json({ error: "The recommendation date must be today's JST date" });
      return;
    }

    const refresh = firstQueryValue(req.query.refresh) === "1";
    const bypassCache = req.method === "POST" || refresh;
    const exclusions = bypassCache ? parseExclusions(body.exclude) : [];
    // Shared caching requires the JST date in the URL; without it a CDN entry
    // would keep serving yesterday's picks under the same key.
    res.setHeader(
      "Cache-Control",
      bypassCache || !hasDate
        ? "private, no-store"
        : "public, s-maxage=900, stale-while-revalidate=86400",
    );
    res.status(200).json(await recommendationsFor(date, lang, bypassCache, exclusions));
  } catch (error) {
    if (error instanceof InvalidRequestError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("recommendations error", error);
    res.status(502).json({
      error: "AI recommendations backend error",
      detail: errorDetail(error),
    });
  }
}