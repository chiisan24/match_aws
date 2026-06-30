/**
 * POST /api/plan — real AI same-day pilgrimage plan (Amazon Bedrock / Claude).
 *
 * Body: { input: PlanInput, temples: [{id,name,number,location}], lang? }
 * Returns: { stops: [{ time: "HH:MM", label, kind: "temple"|"spot"|"meal" }] }
 *
 * The model builds a realistic timeline that fits the available time, starting
 * around 09:00, using only the supplied temples for temple stops (Req 12).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractJson, invokeClaude } from "./_bedrock";

interface PlanInputBody {
  startPoint?: unknown;
  availableMinutes?: number;
  transport?: string;
  desiredTemples?: string[];
  fitnessLevel?: string;
  includeSightseeing?: boolean;
}

interface TempleBody {
  id: string;
  name: string;
  number: number;
}

interface PlanStop {
  time: string;
  label: string;
  kind: "temple" | "spot" | "meal";
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
    const body = (req.body ?? {}) as {
      input?: PlanInputBody;
      temples?: TempleBody[];
      lang?: string;
    };
    const input = body.input ?? {};
    const temples = body.temples ?? [];
    const lang = body.lang || "ja";

    const templeText = temples
      .map((t) => `- ${t.id} | 第${t.number}番 ${t.name}`)
      .join("\n");

    const system = [
      "あなたは四国八十八ヶ所巡礼（愛媛）の当日プランを組む専門家です。",
      `札所名やラベルは次の言語コードで記述: ${lang}（不明なら日本語）。`,
      "09:00 ごろ開始し、利用可能時間内に収まる時刻付きタイムラインを作成します。",
      "移動手段・体力レベル・希望札所・観光を含むかを考慮してください。",
      "札所の stop には、必ず以下のリストにある札所のみを使うこと（無い札所は作らない）。",
      "観光を含む場合は昼食(meal)や周辺観光(spot)も適宜入れてください。",
      "",
      "出力は必ず次の JSON のみ（説明文やコードフェンス無し）。time は昇順:",
      '{"stops":[{"time":"09:00","label":"...","kind":"temple"}]}',
      "kind は \"temple\" | \"spot\" | \"meal\" のいずれか。",
      "",
      "利用可能な札所:",
      templeText || "(なし)",
    ].join("\n");

    const userMsg = `条件(JSON): ${JSON.stringify(input)}`;

    const text = await invokeClaude({
      system,
      messages: [{ role: "user", text: userMsg }],
      maxTokens: 1024,
    });

    const parsed = extractJson<{ stops?: PlanStop[] }>(text);
    const stops = Array.isArray(parsed?.stops) ? parsed!.stops : [];
    const ordered = [...stops].sort((a, b) => a.time.localeCompare(b.time));

    res.status(200).json({ stops: ordered });
  } catch (err) {
    console.error("plan error", err);
    res.status(502).json({ error: "AI plan backend error" });
  }
}
