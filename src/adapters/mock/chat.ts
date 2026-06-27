/**
 * Mock ChatPort adapter.
 *
 * Produces friendly, non-robotic chat replies (Req 3.5 / 18.3) and a mock
 * same-day pilgrimage plan whose timeline stops are in ascending time order
 * (Req 12.2 / Property 22). At destination-discovery moments it hands back
 * swipe candidates (Req 3.2). Pure stub — no network (Req 3.6 / 16.2).
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
import { EHIME_SPOTS } from "./spots";

/** Warm, varied opener lines so replies never feel templated. */
const FRIENDLY_OPENERS = [
  "いいですね、",
  "なるほど〜。",
  "わかります！",
  "うんうん、",
  "そうこなくっちゃ。",
];

/**
 * Keywords that signal the conversation has reached a "where should I go"
 * moment, at which point we hand swipe candidates to Swipe_Discovery (Req 3.2).
 */
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

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function looksLikeDiscovery(message: string): boolean {
  const lower = message.toLowerCase();
  return DISCOVERY_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

export class MockChatAdapter implements ChatPort {
  async sendMessage(
    session: ChatSession,
    message: string,
  ): Promise<ChatReply> {
    const opener = pick(FRIENDLY_OPENERS, session.messages.length);
    const trimmed = message.trim();

    if (looksLikeDiscovery(trimmed)) {
      // Reflect accumulated likes so suggestions feel personal (Req 3.3),
      // then surface candidates for the swipe deck (Req 3.2).
      const liked = session.preferences?.liked ?? [];
      const candidates = orderCandidates(EHIME_SPOTS, liked);
      return {
        message: `${opener}愛媛でおすすめのスポットをいくつか選んでみました。気になるものを右にスワイプしてみてくださいね。`,
        spotCandidates: candidates,
      };
    }

    return {
      message: `${opener}「${
        trimmed || "そのお話"
      }」、もっと聞かせてください。どんな雰囲気の旅にしたいですか？`,
    };
  }

  async generatePilgrimagePlan(input: PlanInput): Promise<PilgrimagePlan> {
    return { stops: buildPlanStops(input) };
  }
}

/** Sorts liked spots to the front while keeping every candidate available. */
function orderCandidates(spots: Spot[], liked: string[]): Spot[] {
  if (liked.length === 0) return [...spots];
  const likedSet = new Set(liked);
  const preferred = spots.filter((s) => likedSet.has(s.id));
  const rest = spots.filter((s) => !likedSet.has(s.id));
  return [...preferred, ...rest];
}

/**
 * Builds a timeline guaranteed to be in ascending time order. Starts at 09:00
 * and advances a per-transport step between stops; inserts a lunch stop and an
 * optional sightseeing stop when there is room in the schedule.
 */
function buildPlanStops(input: PlanInput): PlanStop[] {
  const stepMinutes =
    input.transport === "walk" ? 90 : input.transport === "bike" ? 60 : 40;

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
    push(`札所参拝: ${templeId}`, "temple");
    // Drop a lunch break roughly midway through the temple visits.
    if (input.includeSightseeing && index === Math.floor(temples.length / 2)) {
      push("お昼ごはん", "meal");
    }
  });

  if (input.includeSightseeing) {
    push("周辺観光スポット", "spot");
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
