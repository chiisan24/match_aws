/**
 * HttpChatAdapter — a real AI chat backend over the same-origin Vercel function
 * `POST /api/chat` (which calls AWS Bedrock server-side).
 *
 * It implements {@link ChatPort} so it slots into the existing gateway. To keep
 * the app robust:
 *  - The destination-discovery hand-off (Req 3.2) is computed client-side here,
 *    so a real AI text reply still surfaces swipe candidates exactly like the
 *    mock did.
 *  - On any failure (network error, non-2xx, non-JSON, missing API in local
 *    dev) it transparently delegates to a {@link ChatPort} fallback (the mock
 *    adapter), so the chat UI never breaks.
 *  - Pilgrimage plan generation is out of scope for the AI backend and is
 *    delegated to the fallback.
 */

import type {
  ChatPort,
  ChatReply,
  ChatSession,
  PilgrimagePlan,
  PlanInput,
  Spot,
} from "../../ports";
import { EHIME_SPOTS } from "../mock/spots";

/** Keywords that signal a "where should I go" moment → hand off candidates. */
const DISCOVERY_HINTS = [
  "おすすめ",
  "どこ",
  "行きたい",
  "観光",
  "スポット",
  "ごはん",
  "食べ",
  "巡り",
  "recommend",
  "where",
  "spot",
  "visit",
  "eat",
];

function looksLikeDiscovery(message: string): boolean {
  const lower = message.toLowerCase();
  return DISCOVERY_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

/** Sort liked spots to the front while keeping every candidate available. */
function orderCandidates(spots: Spot[], liked: string[]): Spot[] {
  if (liked.length === 0) return [...spots];
  const likedSet = new Set(liked);
  const preferred = spots.filter((s) => likedSet.has(s.id));
  const rest = spots.filter((s) => !likedSet.has(s.id));
  return [...preferred, ...rest];
}

export class HttpChatAdapter implements ChatPort {
  private readonly fallback: ChatPort;
  private readonly endpoint: string;

  /**
   * @param fallback ChatPort used when the API is unavailable (the mock adapter).
   * @param endpoint API path; defaults to the same-origin `/api/chat`.
   */
  constructor(fallback: ChatPort, endpoint = "/api/chat") {
    this.fallback = fallback;
    this.endpoint = endpoint;
  }

  async sendMessage(
    session: ChatSession,
    message: string,
  ): Promise<ChatReply> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang: session.lang,
          messages: session.messages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`chat api responded ${response.status}`);
      }

      const data: unknown = await response.json();
      const text =
        data && typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : "";
      if (!text) {
        throw new Error("chat api returned no message");
      }

      const reply: ChatReply = { message: text };

      // Surface swipe candidates at discovery moments (Req 3.2), reflecting
      // accumulated likes so suggestions feel personal (Req 3.3).
      if (looksLikeDiscovery(message)) {
        const liked = session.preferences?.liked ?? [];
        reply.spotCandidates = orderCandidates(EHIME_SPOTS, liked);
      }

      return reply;
    } catch {
      // API unavailable or errored — keep the UI working via the fallback.
      return this.fallback.sendMessage(session, message);
    }
  }

  async generatePilgrimagePlan(input: PlanInput): Promise<PilgrimagePlan> {
    // Plan generation is not part of the AI chat backend; delegate.
    return this.fallback.generatePilgrimagePlan(input);
  }
}
