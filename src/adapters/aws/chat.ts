/**
 * AWS ChatPort adapter — real AI travel advisor & plan generation.
 *
 * The browser must never hold AWS credentials, so this adapter calls the app's
 * serverless API (Vercel Functions), which in turn invokes **Amazon Bedrock**
 * (an Anthropic Claude model) server-side:
 *
 *   - `sendMessage`            → POST `{apiEndpoint}/chat`
 *   - `generatePilgrimagePlan` → POST `{apiEndpoint}/plan`
 *
 * For destination-discovery moments the chat backend may return a list of
 * `recommendedSpotIds`; we map those back onto the curated {@link EHIME_SPOTS}
 * catalogue so the swipe deck receives full {@link Spot} objects (Req 3.2). The
 * temple/spot catalogues are sent along with the request so the model can pick
 * from real data rather than inventing places.
 *
 * On any failure the methods throw, which the UI surfaces as an error + retry
 * (Req 3.4).
 */

import type {
  ChatPort,
  ChatReply,
  ChatSession,
  NextTempleNavEstimate,
  NextTempleNavInput,
  PilgrimagePlan,
  PlanInput,
  PlanStop,
  RecommendedPlan,
  RecommendedPlansInput,
  RouteCandidate,
  RouteCandidatesInput,
  Spot,
  TourismRoutePlan,
  TourismRoutePlanInput,
} from "../../ports";
import type { AwsEnv } from "../../config/env";
import { estimateLocalTempleNav, cleanTempleAddress } from "../../domain/templeNav";
import { EHIME_SPOTS } from "../mock/spots";
import { EHIME_TEMPLES } from "../mock/temples";
import { AWS_NOT_CONFIGURED } from "./not-configured";

interface ChatApiResponse {
  reply?: string;
  message?: string;
  recommendedSpotIds?: string[];
}

interface ApiErrorResponse {
  error?: string;
  detail?: string;
}

function chatErrorMessage(status: number, detail = ""): string {
  if (/AccessDenied|Unauthorized|UnrecognizedClient|InvalidSignature|credential/i.test(detail)) {
    return "Bedrockの認証に失敗しました。APIキーと適用環境を確認してください。";
  }
  if (/ValidationException|ResourceNotFound|model|inference profile/i.test(detail)) {
    return "Bedrockモデルを利用できません。モデルIDとリージョンを確認してください。";
  }
  if (/Throttl|TooManyRequests|ServiceUnavailable|timeout/i.test(detail)) {
    return "Bedrockが混雑中です。少し待ってから再試行してください。";
  }
  return `AIバックエンドでエラーが発生しました（HTTP ${status}）。`;
}

interface PlanApiResponse {
  stops?: PlanStop[];
}

interface RecommendationsApiResponse {
  plans?: RecommendedPlan[];
}

interface NavApiResponse {
  distanceKm?: number | null;
  carMinutes?: number | null;
  walkMinutes?: number | null;
  address?: string;
  highlights?: string[];
  note?: string;
}

function validateTourismRoutePlan(
  input: TourismRoutePlanInput,
  value: unknown,
): TourismRoutePlan {
  const rawStops = (value as { stops?: unknown } | null)?.stops;
  if (!Array.isArray(rawStops) || rawStops.length !== input.selectedStops.length) {
    throw new Error("AIルートの立寄先数が一致しません。");
  }
  const expectedIds = new Set(input.selectedStops.map((stop) => stop.candidateId));
  const seen = new Set<string>();
  let previousTime = "";
  const stops = rawStops.map((value) => {
    if (!value || typeof value !== "object") throw new Error("AIルートの形式が不正です。");
    const raw = value as { candidateId?: unknown; time?: unknown };
    if (
      typeof raw.candidateId !== "string"
      || !expectedIds.has(raw.candidateId)
      || seen.has(raw.candidateId)
      || typeof raw.time !== "string"
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw.time)
      || (previousTime && raw.time <= previousTime)
    ) {
      throw new Error("AIルートに未知の立寄先、重複、または不正な時刻があります。");
    }
    seen.add(raw.candidateId);
    previousTime = raw.time;
    return { candidateId: raw.candidateId, time: raw.time };
  });
  if (seen.size !== expectedIds.size) throw new Error("AIルートに未配置の立寄先があります。");
  return { stops };
}

/**
 * Resolves the serverless API base URL for a given operation. Kept as a
 * module-level helper (not a class method) so it does not appear on the
 * adapter's prototype — the runtime gateway contract check compares prototype
 * method names against the mock, and an extra method would fail verification.
 */
function apiBase(env: AwsEnv, operation: string): string {
  const endpoint = env.apiEndpoint;
  if (!endpoint) throw new Error(AWS_NOT_CONFIGURED(operation));
  return endpoint.replace(/\/+$/, "");
}

export class AwsChatAdapter implements ChatPort {
  constructor(private readonly env: AwsEnv) {}

  async sendMessage(
    session: ChatSession,
    message: string,
  ): Promise<ChatReply> {
    const base = apiBase(this.env, "ChatPort.sendMessage");

    // Full turn history + the new user message, plus a compact catalogue the
    // model can recommend from.
    const messages = [
      ...session.messages.map((m) => ({ role: m.role, text: m.text })),
      { role: "user" as const, text: message },
    ];
    const catalog = EHIME_SPOTS.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.localizedDescriptions.ja ?? "",
    }));

    const res = await fetch(`${base}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: session.lang,
        messages,
        preferences: session.preferences ?? null,
        catalog,
      }),
    });
    if (!res.ok) {
      let apiError: ApiErrorResponse = {};
      try {
        apiError = (await res.json()) as ApiErrorResponse;
      } catch {
        // Some platform-level failures return HTML rather than JSON.
      }
      console.error("Chat backend failed", {
        status: res.status,
        error: apiError.error,
        detail: apiError.detail,
      });
      throw new Error(chatErrorMessage(res.status, apiError.detail));
    }

    const data = (await res.json()) as ChatApiResponse;
    const replyText = data.reply ?? data.message;
    if (!replyText) {
      throw new Error("Chat backend returned no message.");
    }

    const reply: ChatReply = { message: replyText };
    const ids = data.recommendedSpotIds;
    if (ids && ids.length > 0) {
      const byId = new Map(EHIME_SPOTS.map((s) => [s.id, s] as const));
      const candidates = ids
        .map((id) => byId.get(id))
        .filter((s): s is Spot => s != null);
      if (candidates.length > 0) reply.spotCandidates = candidates;
    }
    return reply;
  }

  async generateRecommendedPlans(
    input: RecommendedPlansInput,
  ): Promise<RecommendedPlan[]> {
    const base = apiBase(this.env, "ChatPort.generateRecommendedPlans");
    const count = input.count ?? 5;
    const date = input.date
      ?? new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const query = new URLSearchParams({
      lang: input.lang,
      count: String(count),
      date,
    });
    const res = await fetch(`${base}/recommendations?${query.toString()}`, input.refresh
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang: input.lang,
            count,
            date,
            exclude: input.exclude ?? [],
          }),
          cache: "no-store",
        }
      : { method: "GET" });
    if (!res.ok) {
      let apiError: ApiErrorResponse = {};
      try {
        apiError = (await res.json()) as ApiErrorResponse;
      } catch {
        // Platform-level failures may return non-JSON bodies.
      }
      throw new Error(chatErrorMessage(res.status, apiError.detail));
    }

    const data = (await res.json()) as RecommendationsApiResponse;
    if (!Array.isArray(data.plans) || data.plans.length !== 5) {
      throw new Error("おすすめプランを5件取得できませんでした。");
    }
    return data.plans;
  }

  async generateRouteCandidates(
    input: RouteCandidatesInput,
  ): Promise<RouteCandidate[]> {
    const base = apiBase(this.env, "ChatPort.generateRouteCandidates");
    const res = await fetch(`${base}/route-candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      let apiError: ApiErrorResponse = {};
      try {
        apiError = (await res.json()) as ApiErrorResponse;
      } catch {
        // Platform-level failures may return non-JSON bodies.
      }
      throw new Error(chatErrorMessage(res.status, apiError.detail));
    }

    const data = (await res.json()) as { candidates?: RouteCandidate[] };
    if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
      throw new Error("ルート候補を取得できませんでした。");
    }
    return data.candidates;
  }

  async generateTourismRoutePlan(
    input: TourismRoutePlanInput,
  ): Promise<TourismRoutePlan> {
    const base = apiBase(this.env, "ChatPort.generateTourismRoutePlan");
    const res = await fetch(`${base}/tourism-route-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      let apiError: ApiErrorResponse = {};
      try {
        apiError = (await res.json()) as ApiErrorResponse;
      } catch {
        // Platform-level failures may return non-JSON bodies.
      }
      throw new Error(chatErrorMessage(res.status, apiError.detail));
    }
    return validateTourismRoutePlan(input, await res.json());
  }

  async generatePilgrimagePlan(input: PlanInput): Promise<PilgrimagePlan> {
    const base = apiBase(this.env, "ChatPort.generatePilgrimagePlan");

    const temples = EHIME_TEMPLES.map((t) => ({
      id: t.id,
      name: t.name,
      number: t.number,
      location: t.location,
    }));

    const res = await fetch(`${base}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, temples, lang: input.lang ?? "ja" }),
    });
    if (!res.ok) {
      throw new Error(`Plan backend failed (${res.status} ${res.statusText}).`);
    }

    const data = (await res.json()) as PlanApiResponse;
    const stops = Array.isArray(data.stops) ? data.stops : [];
    // Guarantee ascending time order regardless of model output (Property 22).
    const ordered = [...stops].sort((a, b) => a.time.localeCompare(b.time));
    return { stops: ordered };
  }

  async estimateNextTempleNav(
    input: NextTempleNavInput,
  ): Promise<NextTempleNavEstimate> {
    // The great-circle distance grounds the model (and is the fallback figure).
    const local = estimateLocalTempleNav(input.from, input.temple.location);
    try {
      const base = apiBase(this.env, "ChatPort.estimateNextTempleNav");
      const res = await fetch(`${base}/temple-nav`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang: input.lang ?? "ja",
          from: input.from,
          temple: {
            id: input.temple.id,
            name: input.temple.name,
            number: input.temple.number,
            location: input.temple.location,
            address: input.temple.address ?? "",
            highlights: input.temple.highlights ?? [],
          },
          // A straight-line hint (km) so the model returns a realistic road
          // estimate rather than inventing coordinates-based figures.
          straightLineKm: local.distanceKm,
        }),
      });
      if (!res.ok) {
        throw new Error(
          `Temple-nav backend failed (${res.status} ${res.statusText}).`,
        );
      }
      const data = (await res.json()) as NavApiResponse;
      const fallbackAddress = cleanTempleAddress(input.temple.address);
      return {
        distanceKm:
          typeof data.distanceKm === "number"
            ? data.distanceKm
            : local.distanceKm,
        carMinutes:
          typeof data.carMinutes === "number"
            ? data.carMinutes
            : local.carMinutes,
        walkMinutes:
          typeof data.walkMinutes === "number"
            ? data.walkMinutes
            : local.walkMinutes,
        address:
          typeof data.address === "string" && data.address.trim() !== ""
            ? data.address.trim()
            : fallbackAddress,
        highlights: Array.isArray(data.highlights)
          ? data.highlights.filter((h) => typeof h === "string")
          : input.temple.highlights ?? [],
        note: typeof data.note === "string" ? data.note : "",
        aiGenerated: true,
      };
    } catch {
      // Backend unavailable/failed — never throw; return the local estimate so
      // the 次の札所ナビ card always has figures (still shown as a 目安).
      return {
        ...local,
        address: cleanTempleAddress(input.temple.address),
        highlights: input.temple.highlights ?? [],
        note: "",
        aiGenerated: false,
      };
    }
  }
}
