import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorDetail } from "./_aws.js";
import { extractJson, invokeClaude } from "./_bedrock.js";
import { searchEhimePlace, type EnrichedPlace } from "./_google-places.js";

interface RawStop {
  time?: unknown;
  kind?: unknown;
  title?: unknown;
  description?: unknown;
  searchQuery?: unknown;
}

type StopKind = "sightseeing" | "food" | "cafe" | "custom";

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
  kind: StopKind;
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

function slug(value: unknown, index: number): string {
  const normalized = typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
    : "";
  return normalized.replace(/^-|-$/g, "").slice(0, 48) || `ehime-trip-${index + 1}`;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const STOP_KINDS = new Set<StopKind>(["sightseeing", "food", "cafe", "custom"]);
const FALLBACK_TIMES = ["09:00", "11:00", "13:00", "15:00"] as const;

function normalizeKind(value: unknown): StopKind {
  if (typeof value !== "string" || !STOP_KINDS.has(value as StopKind)) {
    throw new Error("Bedrock recommendation is missing stop.kind.");
  }
  return value as StopKind;
}

function normalizeStop(value: unknown, index: number): PlanStop {
  if (!value || typeof value !== "object") {
    throw new Error("Bedrock returned an invalid recommendation stop.");
  }
  const stop = value as RawStop;
  const proposedTime = typeof stop.time === "string" ? stop.time.trim() : "";
  return {
    time: TIME_PATTERN.test(proposedTime)
      ? proposedTime
      : FALLBACK_TIMES[index] ?? FALLBACK_TIMES[FALLBACK_TIMES.length - 1],
    kind: normalizeKind(stop.kind),
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
    throw new Error("Each itinerary must contain between two and four stops.");
  }
  const stops = rawStops.map(normalizeStop);
  if (stops.some((stop, stopIndex) => stopIndex > 0 && stop.time <= stops[stopIndex - 1].time)) {
    stops.forEach((stop, stopIndex) => {
      stop.time = FALLBACK_TIMES[stopIndex];
    });
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
    stops,
  };
}

const MAX_PLACES_CONCURRENCY = 4;
const ITINERARY_RADIUS_METERS = 5_000;

type LocatedPlanStop = PlanStop & {
  place: EnrichedPlace & { location: { lat: number; lng: number } };
};

function isLocatedStop(stop: PlanStop): stop is LocatedPlanStop {
  return Number.isFinite(stop.place?.location?.lat)
    && Number.isFinite(stop.place?.location?.lng);
}

/**
 * Picks the anchor whose {@link ITINERARY_RADIUS_METERS} neighbourhood keeps the
 * most stops, preserving the model's visiting order. The prompt asks for one
 * compact area per itinerary, but a themed route ("Shimanto and Sadamisaki")
 * regularly spans the prefecture; anchoring on the first stop then discards
 * every other place. Taking the largest cluster instead salvages the usable
 * part of such an itinerary. Ties keep the earliest stop, so a well-behaved
 * itinerary still anchors on its first place.
 */
function largestNearbyCluster(stops: LocatedPlanStop[]): {
  anchor: { lat: number; lng: number };
  stops: LocatedPlanStop[];
} | null {
  let best: { anchor: { lat: number; lng: number }; stops: LocatedPlanStop[] } | null =
    null;
  for (const candidate of stops) {
    const anchor = candidate.place.location;
    const nearby = stops.filter(
      (stop) =>
        distanceMeters(anchor, stop.place.location) <= ITINERARY_RADIUS_METERS,
    );
    if (!best || nearby.length > best.stops.length) best = { anchor, stops: nearby };
  }
  return best;
}

function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRadians = (degrees: number): number => degrees * Math.PI / 180;
  const earthRadiusMeters = 6_371_000;
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toLat - fromLat;
  const deltaLng = toRadians(to.lng - from.lng);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function createTaskLimiter(maxConcurrency: number) {
  let active = 0;
  const pending: Array<() => void> = [];
  const startNext = (): void => {
    if (active >= maxConcurrency) return;
    const start = pending.shift();
    if (!start) return;
    active += 1;
    start();
  };
  return <T>(task: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    pending.push(() => {
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          startNext();
        });
    });
    startNext();
  });
}

async function enrichPlans(
  plans: RecommendationPlan[],
  lang: string,
): Promise<RecommendationPlan[]> {
  const limit = createTaskLimiter(MAX_PLACES_CONCURRENCY);
  const cache = new Map<string, Promise<EnrichedPlace | null>>();
  const findPlace = (query: string): Promise<EnrichedPlace | null> => {
    const key = query.toLowerCase();
    const existing = cache.get(key);
    if (existing) return existing;
    const request = limit(() => searchEhimePlace(query, lang)).catch((error) => {
      console.error("Google Places enrichment failed", { query, error });
      return null;
    });
    cache.set(key, request);
    return request;
  };

  return Promise.all(
    plans.map(async (plan) => {
      const enrichedStops = await Promise.all(
        plan.stops.map(async (stop) => {
          const place = await findPlace(stop.searchQuery);
          return place ? { ...stop, place } : stop;
        }),
      );
      const seenPlaceIds = new Set<string>();
      const verifiedStops = enrichedStops.filter((stop): stop is LocatedPlanStop => {
        if (!isLocatedStop(stop) || seenPlaceIds.has(stop.place.id)) return false;
        seenPlaceIds.add(stop.place.id);
        return true;
      });
      const cluster = largestNearbyCluster(verifiedStops);
      // A single verified place is still a usable itinerary: the route builder
      // centres its search on the area and lets the traveller add neighbouring
      // spots. Rejecting it here would fail all five recommendations at once,
      // because these plans are enriched with Promise.all.
      if (!cluster) {
        throw new Error(
          `Recommendation ${plan.id} has no verified stop to anchor an area on.`,
        );
      }
      const stops = cluster.stops.slice(0, 4);
      const heroPlace = stops.map((stop) => stop.place).find((place) => place.photoUrl);
      return {
        ...plan,
        stops,
        area: { center: cluster.anchor, radiusMeters: ITINERARY_RADIUS_METERS },
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

const RECOMMENDATION_SCHEMA = "itinerary-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;
const REFRESH_INTERVAL_MS = 60 * 1000;
const refreshAllowedAt = new Map<string, number>();
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
    "愛媛県内に実在する場所を題材に、松山周辺に偏らない5つの具体的な日帰り旅程を作ってください。",
    "5件すべてmodeをtourismにし、地域・景色・文化・体験などテーマを重複させないでください。",
    "各旅程のstopsは、実在する観光地・飲食店・カフェなどを2〜4件含め、無理のない訪問順にしてください。",
    "各旅程の立寄先は最初の場所から概ね5km以内にまとめ、次画面で周辺スポットを選び直せるようにしてください。",
    "各stopのtimeは到着予定時刻を24時間制HH:MMで設定し、上から厳密な昇順にしてください。",
    "各stopのkindは観光地ならsightseeing、飲食店ならfood、カフェならcafe、その他の希望場所ならcustomにしてください。",
    "summary・reason・各descriptionは要点だけを短く書いてください。",
    "searchQueryはGoogle Mapsで一意に検索できる正式な場所名にしてください。住所やURLは作らないでください。",
    "営業時間・料金・イベント開催を断定しないでください。",
    "出力は次のJSONだけにしてください。説明やコードフェンスは禁止です。",
    '{"plans":[{"id":"lowercase-slug","mode":"tourism","icon":"絵文字1つ","title":"...","summary":"...","reason":"...","duration":"...","transport":"...","intensity":"...","stops":[{"time":"09:00","kind":"sightseeing","title":"...","description":"...","searchQuery":"実在する施設名"},{"time":"11:00","kind":"food","title":"...","description":"...","searchQuery":"実在する施設名"}]}]}',
    "plansは必ずちょうど5件、各stopsは必ず2〜4件にしてください。",
  ].join("\n");
}

async function generateRecommendations(lang: string): Promise<RecommendationResult> {
  const output = await invokeClaude({
    system: recommendationPrompt(lang),
    messages: [{ role: "user", text: "今日の愛媛旅行プランを時刻付きで5件生成してください。" }],
    maxTokens: 3500,
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

/**
 * Bedrock rejections that a retry cannot fix (bad request, missing/denied
 * credentials, unknown model). Throttling (429) and 5xx are worth another try,
 * and so is a reply that failed the itinerary contract, since generation is
 * stochastic.
 */
const FATAL_BEDROCK_STATUSES = new Set(["400", "401", "403", "404"]);
const FATAL_BEDROCK_ERROR_NAMES = new Set([
  "AccessDeniedException",
  "CredentialsProviderError",
  "ResourceNotFoundException",
  "UnrecognizedClientException",
  "ValidationException",
]);

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const messageStatus = message.match(/^Bedrock HTTP (\d{3})/)?.[1];
  const metadataStatus = error && typeof error === "object"
    ? String((error as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode ?? "")
    : "";
  const name = error && typeof error === "object"
    ? String((error as { name?: unknown }).name ?? "")
    : "";
  const status = messageStatus || metadataStatus;
  return !FATAL_BEDROCK_ERROR_NAMES.has(name)
    && (status === "" || !FATAL_BEDROCK_STATUSES.has(status));
}

/**
 * A full generation takes ~35s, so only retry while enough of the function's
 * time budget is left for a second attempt to finish. In practice that retries
 * the fast failures (throttling) and lets slow ones surface immediately instead
 * of turning one timeout into two.
 */
const RETRY_BUDGET_MS = 20_000;

async function generateWithRetry(lang: string): Promise<RecommendationResult> {
  const startedAt = Date.now();
  try {
    return await generateRecommendations(lang);
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    if (!isRetryable(error) || elapsed > RETRY_BUDGET_MS) throw error;
    console.warn(
      `recommendations retrying after ${elapsed}ms: ${errorDetail(error)}`,
    );
    return generateRecommendations(lang);
  }
}

function recommendationsFor(
  lang: string,
  schema: string,
  bypassCache: boolean,
): Promise<RecommendationResult> {
  const now = Date.now();
  const key = `${schema}:${japanDate()}:${lang}`;

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
      const result = await generateWithRetry(lang);
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

function refreshClientKey(req: VercelRequest): string {
  const forwarded = firstQueryValue(req.headers["x-forwarded-for"]);
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = firstQueryValue(req.headers["x-real-ip"]);
  return typeof realIp === "string" && realIp.trim() ? realIp.trim() : "unknown";
}

function refreshRetryAfterSeconds(req: VercelRequest): number {
  const now = Date.now();
  for (const [key, allowedAt] of refreshAllowedAt) {
    if (allowedAt <= now) refreshAllowedAt.delete(key);
  }
  const key = refreshClientKey(req);
  const allowedAt = refreshAllowedAt.get(key) ?? 0;
  if (allowedAt > now) return Math.ceil((allowedAt - now) / 1000);
  refreshAllowedAt.set(key, now + REFRESH_INTERVAL_MS);
  return 0;
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
    const body = (req.body ?? {}) as { lang?: unknown; count?: unknown; schema?: unknown };
    const source = req.method === "GET" ? req.query : body;
    const rawLang = firstQueryValue(source.lang);
    const rawCount = firstQueryValue(source.count);
    const rawSchema = firstQueryValue(source.schema);
    const querySchema = firstQueryValue(req.query.schema);
    const lang = typeof rawLang === "string" ? rawLang.slice(0, 16) : "ja";
    if (rawSchema !== RECOMMENDATION_SCHEMA) {
      res.status(400).json({ error: `schema must be ${RECOMMENDATION_SCHEMA}` });
      return;
    }
    if (req.method === "POST" && querySchema != null && querySchema !== rawSchema) {
      res.status(400).json({ error: "Query and body schemas must match" });
      return;
    }
    if (rawCount != null && Number(rawCount) !== 5) {
      res.status(400).json({ error: "Exactly five recommendations are required" });
      return;
    }

    const refresh = firstQueryValue(req.query.refresh) === "1";
    const bypassCache = req.method === "POST" || refresh;
    if (bypassCache) {
      const retryAfter = refreshRetryAfterSeconds(req);
      if (retryAfter > 0) {
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("Retry-After", String(retryAfter));
        res.status(429).json({ error: "Please wait before refreshing recommendations" });
        return;
      }
    }
    res.setHeader(
      "Cache-Control",
      bypassCache
        ? "private, no-store"
        : "public, s-maxage=900, stale-while-revalidate=86400",
    );
    res.status(200).json(await recommendationsFor(lang, RECOMMENDATION_SCHEMA, bypassCache));
  } catch (error) {
    console.error("recommendations error", error);
    res.status(502).json({
      error: "AI recommendations backend error",
      detail: errorDetail(error),
    });
  }
}