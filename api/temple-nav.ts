/**
 * POST /api/temple-nav — AI-estimated 次の札所ナビ figures (Amazon Bedrock / Claude).
 *
 * Body: {
 *   lang?, from: {lat,lng}|null,
 *   temple: { id, name, number, location:{lat,lng}, address?, highlights?[] },
 *   straightLineKm?: number|null
 * }
 * Returns: {
 *   distanceKm: number|null, carMinutes: number|null, walkMinutes: number|null,
 *   highlights: string[], note: string
 * }
 *
 * The figures are **rough estimates for reference only** — the client presents
 * them with a disclaimer. The straight-line distance (great-circle) is supplied
 * as a hint so the model returns a realistic road estimate rather than guessing
 * from raw coordinates. All text is returned in the requested language.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractJson, invokeClaude } from "./_bedrock.js";
import { errorDetail } from "./_aws.js";

interface GeoPoint {
  lat: number;
  lng: number;
}

interface TempleBody {
  id?: string;
  name?: string;
  number?: number;
  location?: GeoPoint;
  address?: string;
  highlights?: string[];
}

interface NavBody {
  lang?: string;
  from?: GeoPoint | null;
  temple?: TempleBody;
  straightLineKm?: number | null;
}

interface NavResult {
  distanceKm: number | null;
  carMinutes: number | null;
  walkMinutes: number | null;
  highlights: string[];
  note: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body ?? {}) as NavBody;
    const lang = body.lang || "ja";
    const temple = body.temple ?? {};
    const from = body.from ?? null;
    const straightLineKm =
      typeof body.straightLineKm === "number" ? body.straightLineKm : null;

    if (!temple.name || !temple.location) {
      res.status(400).json({ error: "temple.name and temple.location required" });
      return;
    }

    const system = [
      "あなたは四国八十八ヶ所巡礼（愛媛）の道案内の専門家です。",
      `テキスト(見どころ・注意書き)は必ず次の言語コードで記述: ${lang}（不明なら日本語）。`,
      "与えられた出発地座標と札所座標、及び直線距離のヒントをもとに、",
      "実際の道路を考慮した現実的な『道路距離(km)』『車での所要時間(分)』",
      "『徒歩での所要時間(分)』を見積もってください。",
      "山道やアクセスの悪さも考慮し、直線距離より長めの道路距離になるのが自然です。",
      "出発地が不明(null)の場合は距離・時間は null にしてください。",
      "highlights はその札所の代表的な見どころを2〜4個、簡潔に。",
      "note は現地アクセスや駐車・混雑などの短い注意・アドバイスを1〜2文で。",
      "",
      "重要: これらは AI による目安であり、正確な実測値ではないことを前提に、",
      "現実的で保守的な値にしてください。",
      "",
      "出力は必ず次の JSON のみ（説明文やコードフェンス無し）:",
      '{"distanceKm": 12.3, "carMinutes": 25, "walkMinutes": 160, "highlights": ["..."], "note": "..."}',
      "距離・時間が不明なときは該当フィールドを null に。",
    ].join("\n");

    const userMsg = [
      `札所: 第${temple.number}番 ${temple.name}`,
      temple.address ? `所在地: ${temple.address}` : "",
      `札所座標: ${JSON.stringify(temple.location)}`,
      `出発地座標: ${from ? JSON.stringify(from) : "不明(null)"}`,
      straightLineKm != null ? `直線距離ヒント: 約${straightLineKm}km` : "",
      temple.highlights && temple.highlights.length
        ? `参考の見どころ: ${temple.highlights.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const text = await invokeClaude({
      system,
      messages: [{ role: "user", text: userMsg }],
      maxTokens: 512,
    });

    const parsed = extractJson<Partial<NavResult>>(text);

    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    const result: NavResult = {
      distanceKm: num(parsed?.distanceKm) ?? straightLineKm,
      carMinutes: num(parsed?.carMinutes),
      walkMinutes: num(parsed?.walkMinutes),
      highlights: Array.isArray(parsed?.highlights)
        ? parsed!.highlights!.filter((h) => typeof h === "string").slice(0, 4)
        : temple.highlights ?? [],
      note: typeof parsed?.note === "string" ? parsed.note : "",
    };

    res.status(200).json(result);
  } catch (err) {
    console.error("temple-nav error", err);
    res
      .status(502)
      .json({ error: "AI temple-nav backend error", detail: errorDetail(err) });
  }
}
