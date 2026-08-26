import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorDetail } from "./_aws.js";
import { extractJson, invokeClaude } from "./_bedrock.js";
import { searchEhimePlace, type EnrichedPlace } from "./_google-places.js";

type CandidateKind = "sightseeing" | "food" | "cafe" | "custom";

interface RawCandidate {
  title?: unknown;
  description?: unknown;
  searchQuery?: unknown;
}

interface CandidateInput {
  lang?: unknown;
  kind?: unknown;
  theme?: { id?: unknown; title?: unknown; summary?: unknown; reason?: unknown };
  area?: unknown;
  route?: Array<{ title?: unknown; placeId?: unknown; location?: unknown }>;
  customRequest?: unknown;
  count?: unknown;
}

interface RouteCandidate {
  id: string;
  kind: CandidateKind;
  title: string;
  description: string;
  searchQuery: string;
  place: EnrichedPlace & { location: { lat: number; lng: number } };
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; candidates: RouteCandidate[] }>();
const pending = new Map<string, Promise<RouteCandidate[]>>();

function boundedText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Route candidate is missing ${field}.`);
  }
  return value.trim().slice(0, max);
}

interface CandidateArea {
  center: { lat: number; lng: number };
  radiusMeters: number;
}

function parseArea(value: unknown): CandidateArea {
  if (!value || typeof value !== "object") {
    throw new Error("A route candidate area is required.");
  }
  const area = value as { center?: { lat?: unknown; lng?: unknown }; radiusMeters?: unknown };
  const lat = Number(area.center?.lat);
  const lng = Number(area.center?.lng);
  const requestedRadius = Number(area.radiusMeters);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(requestedRadius)) {
    throw new Error("The route candidate area is invalid.");
  }
  return {
    center: { lat, lng },
    radiusMeters: Math.min(5_000, Math.max(1, requestedRadius)),
  };
}

function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const radians = (degrees: number): number => degrees * Math.PI / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function candidatePrompt(
  kind: CandidateKind,
  theme: { title: string; summary: string; reason: string },
  area: CandidateArea,
  route: Array<{ title?: unknown; location?: unknown }>,
  customRequest: string,
  count: number,
  lang: string,
): string {
  const routeSummary = route.length
    ? route.map((stop) => `${String(stop.title ?? "")}`).filter(Boolean).join(" → ")
    : "まだ立寄先なし";
  const kindInstruction: Record<CandidateKind, string> = {
    sightseeing: "食事・カフェを除く観光地、文化施設、自然景観、体験スポット",
    food: "現在ルートの周辺で昼食または夕食に立ち寄れる実在の飲食店",
    cafe: "現在ルートの周辺で休憩できる実在のカフェ、喫茶店、スイーツ店",
    custom: `現在ルート周辺で「${customRequest}」に合う実在スポット`,
  };
  return [
    "あなたは愛媛県専門の旅行プランナーです。",
    `旅行テーマ: ${theme.title} / ${theme.summary} / ${theme.reason}`,
    `対象エリア: 緯度${area.center.lat}、経度${area.center.lng}を中心とする半径${area.radiusMeters}m以内。全候補を必ずこの範囲内にしてください。`,
    `現在ルート: ${routeSummary}`,
    `候補種別: ${kindInstruction[kind]}`,
    `表示文言は言語コード ${lang} で簡潔に書いてください。`,
    `互いに異なる候補を${count}件、愛媛県内の実在する施設・場所だけから提案してください。`,
    "既に現在ルートに含まれる場所は提案しないでください。",
    "searchQueryはGoogle Mapsで一意に検索できる正式名称にしてください。住所やURLは作らないでください。",
    "出力はJSONだけにし、説明やコードフェンスは禁止です。",
    '{"candidates":[{"title":"正式名称","description":"短いおすすめ理由","searchQuery":"Google Maps検索用の正式名称"}]}',
  ].join("\n");
}

function isKind(value: unknown): value is CandidateKind {
  return value === "sightseeing" || value === "food" || value === "cafe" || value === "custom";
}

async function generateCandidates(
  input: CandidateInput,
  kind: CandidateKind,
  lang: string,
  count: number,
): Promise<RouteCandidate[]> {
  const theme = {
    title: boundedText(input.theme?.title, "theme.title", 120),
    summary: boundedText(input.theme?.summary, "theme.summary", 240),
    reason: boundedText(input.theme?.reason, "theme.reason", 320),
  };
  const route = Array.isArray(input.route) ? input.route.slice(0, 20) : [];
  const area = parseArea(input.area);
  const customRequest = typeof input.customRequest === "string"
    ? input.customRequest.trim().slice(0, 160)
    : "";
  if (kind === "custom" && !customRequest) {
    throw new Error("customRequest is required for custom candidates.");
  }

  const output = await invokeClaude({
    system: candidatePrompt(kind, theme, area, route, customRequest, count, lang),
    messages: [{ role: "user", text: "ルート候補を提案してください。" }],
    maxTokens: 1600,
  });
  const parsed = extractJson<{ candidates?: unknown }>(output);
  if (!Array.isArray(parsed?.candidates)) {
    throw new Error("Bedrock did not return route candidates.");
  }

  const rawCandidates = parsed.candidates.slice(0, count).map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid route candidate.");
    const raw = value as RawCandidate;
    return {
      title: boundedText(raw.title, "title", 120),
      description: boundedText(raw.description, "description", 280),
      searchQuery: boundedText(raw.searchQuery ?? raw.title, "searchQuery", 140),
    };
  });
  const usedIds = new Set(
    route.map((stop) => typeof stop.placeId === "string" ? stop.placeId : "").filter(Boolean),
  );
  const enriched = await Promise.all(rawCandidates.map(async (candidate) => {
    const place = await searchEhimePlace(candidate.searchQuery, lang, area).catch(() => null);
    if (
      !place?.location
      || usedIds.has(place.id)
      || distanceMeters(area.center, place.location) > area.radiusMeters
    ) return null;
    usedIds.add(place.id);
    return {
      id: `${kind}:${place.id}`,
      kind,
      ...candidate,
      place: { ...place, location: place.location },
    } satisfies RouteCandidate;
  }));
  return enriched.filter((candidate): candidate is RouteCandidate => candidate != null);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const input = (req.body ?? {}) as CandidateInput;
    if (!isKind(input.kind)) {
      res.status(400).json({ error: "A valid candidate kind is required" });
      return;
    }
    const lang = typeof input.lang === "string" ? input.lang.slice(0, 16) : "ja";
    const count = Math.min(8, Math.max(3, Number(input.count) || (input.kind === "cafe" ? 4 : 6)));
    const key = JSON.stringify({ lang, kind: input.kind, theme: input.theme, area: input.area, route: input.route, customRequest: input.customRequest, count });
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      res.status(200).json({ candidates: cached.candidates });
      return;
    }
    let request = pending.get(key);
    if (!request) {
      request = generateCandidates(input, input.kind, lang, count);
      pending.set(key, request);
    }
    try {
      const candidates = await request;
      if (candidates.length === 0) throw new Error("No Google-verified route candidates were found.");
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, candidates });
      res.status(200).json({ candidates });
    } finally {
      pending.delete(key);
    }
  } catch (error) {
    console.error("route-candidates error", error);
    res.status(502).json({ error: "Route candidates backend error", detail: errorDetail(error) });
  }
}
