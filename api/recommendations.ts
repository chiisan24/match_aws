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

interface PlanStop {
  time: string;
  title: string;
  description: string;
  searchQuery: string;
  place?: EnrichedPlace;
}

interface RecommendationPlan {
  id: string;
  mode: "tourism" | "pilgrimage";
  icon: string;
  title: string;
  summary: string;
  reason: string;
  duration: string;
  transport: string;
  intensity: string;
  imageUrl?: string;
  imageAttributions?: EnrichedPlace["photoAttributions"];
  stops: PlanStop[];
}

function text(value: unknown, field: string, max = 240): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Bedrock recommendation is missing ${field}.`);
  }
  return value.trim().slice(0, max);
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
  if (rawStops.length < 2 || rawStops.length > 4) {
    throw new Error("Each recommendation must contain two to four stops.");
  }
  return {
    id: slug(plan.id, index),
    mode: plan.mode === "pilgrimage" ? "pilgrimage" : "tourism",
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

function recommendationPrompt(lang: string): string {
  return [
    "あなたは愛媛県専門の旅行プランナーです。",
    `基準日は ${japanDate()}。季節を意識した多様な日帰り旅行を提案してください。`,
    `表示文言は言語コード ${lang} で簡潔に書いてください。不明な場合は日本語にしてください。`,
    "愛媛県内に実在する場所だけを使い、松山周辺に偏らせず地域とテーマを分散してください。",
    "5件のうち1件は初心者向けお遍路にし、modeをpilgrimageにしてください。残りはtourismです。",
    "各プランの立寄先は必ず3件にしてください。飲食も検索可能な実在店・施設名にしてください。",
    "summary・reason・各descriptionは要点だけを短く書いてください。",
    "searchQueryはGoogle Mapsで一意に検索できる正式な場所名にしてください。住所やURLは作らないでください。",
    "営業時間・料金・イベント開催を断定しないでください。",
    "出力は次のJSONだけにしてください。説明やコードフェンスは禁止です。",
    '{"plans":[{"id":"lowercase-slug","mode":"tourism","icon":"絵文字1つ","title":"...","summary":"...","reason":"...","duration":"...","transport":"...","intensity":"...","stops":[{"time":"09:00","title":"...","description":"...","searchQuery":"実在する施設名"}]}]}',
    "plansは必ずちょうど5件にしてください。",
  ].join("\n");
}

async function generateRecommendations(lang: string): Promise<RecommendationResult> {
  const output = await invokeClaude({
    system: recommendationPrompt(lang),
    messages: [{ role: "user", text: "今日の愛媛旅行おすすめを5件生成してください。" }],
    maxTokens: 2400,
  });
  const parsed = extractJson<{ plans?: unknown }>(output);
  if (!Array.isArray(parsed?.plans) || parsed.plans.length !== 5) {
    throw new Error("Bedrock did not return exactly five recommendations.");
  }

  const plans = parsed.plans.map(normalizePlan);
  if (new Set(plans.map((plan) => plan.id)).size !== plans.length) {
    plans.forEach((plan, index) => {
      plan.id = `${plan.id}-${index + 1}`;
    });
  }
  return { plans: await enrichPlans(plans, lang) };
}

function recommendationsFor(
  lang: string,
  bypassCache: boolean,
): Promise<RecommendationResult> {
  const now = Date.now();
  const key = `${japanDate()}:${lang}`;

  for (const [cachedKey, entry] of recommendationCache) {
    if (entry.expiresAt <= now) recommendationCache.delete(cachedKey);
  }

  if (!bypassCache) {
    const cached = recommendationCache.get(key);
    if (cached) return Promise.resolve(cached.result);
  }

  const pending = recommendationRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const result = await generateRecommendations(lang);
      recommendationCache.set(key, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result,
      });
      return result;
    } finally {
      recommendationRequests.delete(key);
    }
  })();
  recommendationRequests.set(key, request);
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
    const body = (req.body ?? {}) as { lang?: unknown; count?: unknown };
    const source = req.method === "GET" ? req.query : body;
    const rawLang = firstQueryValue(source.lang);
    const rawCount = firstQueryValue(source.count);
    const lang = typeof rawLang === "string" ? rawLang.slice(0, 16) : "ja";
    if (rawCount != null && Number(rawCount) !== 5) {
      res.status(400).json({ error: "Exactly five recommendations are required" });
      return;
    }

    const refresh = firstQueryValue(req.query.refresh) === "1";
    const bypassCache = req.method === "POST" || refresh;
    res.setHeader(
      "Cache-Control",
      bypassCache
        ? "private, no-store"
        : "public, s-maxage=900, stale-while-revalidate=86400",
    );
    res.status(200).json(await recommendationsFor(lang, bypassCache));
  } catch (error) {
    console.error("recommendations error", error);
    res.status(502).json({
      error: "AI recommendations backend error",
      detail: errorDetail(error),
    });
  }
}