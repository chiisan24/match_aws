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
  PilgrimagePlan,
  PlanInput,
  PlanStop,
  Spot,
} from "../../ports";
import type { AwsEnv } from "../../config/env";
import { EHIME_SPOTS } from "../mock/spots";
import { EHIME_TEMPLES } from "../mock/temples";
import { AWS_NOT_CONFIGURED } from "./not-configured";

interface ChatApiResponse {
  reply?: string;
  message?: string;
  recommendedSpotIds?: string[];
}

interface PlanApiResponse {
  stops?: PlanStop[];
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
      throw new Error(`Chat backend failed (${res.status} ${res.statusText}).`);
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
      body: JSON.stringify({ input, temples }),
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
}
