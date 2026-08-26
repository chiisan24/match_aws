import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorDetail } from "./_aws.js";
import { extractJson, invokeClaude } from "./_bedrock.js";

type CandidateKind = "sightseeing" | "food" | "cafe" | "custom";

interface SelectedStop {
  candidateId: string;
  kind: CandidateKind;
  title: string;
  location: { lat: number; lng: number };
}

interface TourismRoutePlanInput {
  lang?: unknown;
  theme?: {
    id?: unknown;
    title?: unknown;
    summary?: unknown;
    reason?: unknown;
    transport?: unknown;
  };
  selectedStops?: unknown;
  startTime?: unknown;
}

interface PlannedStop {
  candidateId: string;
  time: string;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const KINDS = new Set<CandidateKind>(["sightseeing", "food", "cafe", "custom"]);

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim().slice(0, maxLength);
}

function parseStops(value: unknown): SelectedStop[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error("selectedStops must contain between 1 and 20 stops.");
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`selectedStops[${index}] is invalid.`);
    const raw = item as {
      candidateId?: unknown;
      kind?: unknown;
      title?: unknown;
      location?: { lat?: unknown; lng?: unknown };
    };
    const candidateId = text(raw.candidateId, `selectedStops[${index}].candidateId`, 180);
    if (ids.has(candidateId)) throw new Error("selectedStops contains duplicate IDs.");
    ids.add(candidateId);
    if (typeof raw.kind !== "string" || !KINDS.has(raw.kind as CandidateKind)) {
      throw new Error(`selectedStops[${index}].kind is invalid.`);
    }
    const lat = Number(raw.location?.lat);
    const lng = Number(raw.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`selectedStops[${index}].location is invalid.`);
    }
    return {
      candidateId,
      kind: raw.kind as CandidateKind,
      title: text(raw.title, `selectedStops[${index}].title`, 120),
      location: { lat, lng },
    };
  });
}

function validatePlan(value: unknown, selectedStops: SelectedStop[]): PlannedStop[] {
  const rawStops = (value as { stops?: unknown } | null)?.stops;
  if (!Array.isArray(rawStops) || rawStops.length !== selectedStops.length) {
    throw new Error("Bedrock returned a route with a mismatched stop count.");
  }
  const expected = new Set(selectedStops.map((stop) => stop.candidateId));
  const seen = new Set<string>();
  let previousTime = "";
  const planned = rawStops.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`stops[${index}] is invalid.`);
    const raw = item as { candidateId?: unknown; time?: unknown };
    const candidateId = text(raw.candidateId, `stops[${index}].candidateId`, 180);
    const time = text(raw.time, `stops[${index}].time`, 5);
    if (!expected.has(candidateId) || seen.has(candidateId)) {
      throw new Error("Bedrock returned an unknown or duplicate candidate ID.");
    }
    if (!TIME_PATTERN.test(time) || (previousTime && time <= previousTime)) {
      throw new Error("Bedrock returned invalid or non-ascending times.");
    }
    seen.add(candidateId);
    previousTime = time;
    return { candidateId, time };
  });
  if (seen.size !== expected.size) throw new Error("Bedrock omitted a selected stop.");
  return planned;
}

function routePrompt(
  input: TourismRoutePlanInput,
  stops: SelectedStop[],
  lang: string,
  startTime: string,
): string {
  const theme = {
    title: text(input.theme?.title, "theme.title", 120),
    summary: text(input.theme?.summary, "theme.summary", 240),
    reason: text(input.theme?.reason, "theme.reason", 320),
    transport: text(input.theme?.transport, "theme.transport", 80),
  };
  return [
    "あなたは愛媛県専門の旅行プランナーです。",
    `旅行テーマ: ${theme.title} / ${theme.summary}`,
    `選定理由: ${theme.reason}`,
    `主な移動手段: ${theme.transport}`,
    `最初の到着希望時刻: ${startTime}`,
    `表示言語: ${lang}`,
    "ユーザーが選んだ次の立寄先だけを使い、移動距離、各施設での標準的な滞在時間、食事・カフェに適した時間帯を考慮して、無理のない訪問順と各地点の到着予定時刻を決めてください。",
    "地点を追加・削除・重複してはいけません。candidateIdは一字も変更せず、全件をちょうど1回ずつ返してください。",
    "時刻は24時間制HH:MMで、上から厳密な昇順にしてください。foodは可能なら11:30〜13:30または17:30〜19:30、cafeは観光の合間に配置してください。",
    `選択済み立寄先: ${JSON.stringify(stops)}`,
    "JSONだけを返し、説明やコードフェンスは禁止です。",
    '{"stops":[{"candidateId":"入力のID","time":"09:00"}]}',
  ].join("\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const input = (req.body ?? {}) as TourismRoutePlanInput;
    const selectedStops = parseStops(input.selectedStops);
    const lang = typeof input.lang === "string" ? input.lang.slice(0, 16) : "ja";
    const startTime = typeof input.startTime === "string" && TIME_PATTERN.test(input.startTime)
      ? input.startTime
      : "09:00";
    const output = await invokeClaude({
      system: routePrompt(input, selectedStops, lang, startTime),
      messages: [{ role: "user", text: "選択済みの立寄先から最適な1日プランを作成してください。" }],
      maxTokens: 1800,
    });
    const parsed = extractJson<unknown>(output);
    res.status(200).json({ stops: validatePlan(parsed, selectedStops) });
  } catch (error) {
    console.error("tourism-route-plan error", error);
    res.status(502).json({ error: "Tourism route plan backend error", detail: errorDetail(error) });
  }
}
