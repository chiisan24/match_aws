/**
 * POST /api/chat — real AI travel advisor (Amazon Bedrock / Claude).
 *
 * Body: { lang, messages: [{role,text}], preferences, catalog: [{id,name,category,description}] }
 * Returns: { reply: string, recommendedSpotIds?: string[] }
 *
 * The model replies warmly in the requested language and, when the user is
 * looking for places to go, selects relevant spot ids from the supplied
 * catalogue (it must not invent ids). Runs server-side with AWS credentials.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  extractJson,
  invokeClaude,
  normalizeMessages,
  type ClaudeMessage,
} from "./_bedrock";

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface ChatBody {
  lang?: string;
  messages?: ClaudeMessage[];
  preferences?: { liked?: string[]; disliked?: string[] } | null;
  catalog?: CatalogItem[];
}

interface ChatResult {
  reply: string;
  recommendedSpotIds?: string[];
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
    const body = (req.body ?? {}) as ChatBody;
    const lang = body.lang || "ja";
    const messages = normalizeMessages(body.messages ?? []);
    const catalog = body.catalog ?? [];

    if (messages.length === 0) {
      res.status(400).json({ error: "messages required" });
      return;
    }

    const liked = body.preferences?.liked ?? [];
    const disliked = body.preferences?.disliked ?? [];

    const catalogText = catalog
      .map((c) => `- ${c.id} | ${c.name} (${c.category}) — ${c.description}`)
      .join("\n");

    const system = [
      "あなたは愛媛県の観光案内をする、親しみやすく温かい旅行アドバイザーです。",
      `必ず次の言語コードで返答してください: ${lang}（不明な場合は日本語）。`,
      "ロボットのような硬い口調は避け、自然で会話的に答えてください。",
      "",
      "ユーザーが行き先・おすすめ・スポット探しを求めているときは、以下のカタログから",
      "関連するスポットの id を選んでください。カタログに無い id は絶対に作らないこと。",
      "雑談や条件確認の段階では recommendedSpotIds は空でかまいません。",
      "",
      "出力は必ず次の JSON のみ（前後に説明文やコードフェンスを付けない）:",
      '{"reply": "<ユーザーへの返答文>", "recommendedSpotIds": ["spot-id", ...]}',
      "",
      "利用可能なスポットカタログ:",
      catalogText || "(なし)",
      liked.length ? `\nユーザーが好んだ id: ${liked.join(", ")}` : "",
      disliked.length ? `ユーザーが興味なしとした id: ${disliked.join(", ")}` : "",
    ].join("\n");

    const text = await invokeClaude({ system, messages, maxTokens: 1024 });
    const parsed = extractJson<ChatResult>(text);

    if (parsed?.reply) {
      const ids = Array.isArray(parsed.recommendedSpotIds)
        ? parsed.recommendedSpotIds.filter((x) => typeof x === "string")
        : undefined;
      res.status(200).json({ reply: parsed.reply, recommendedSpotIds: ids });
      return;
    }

    // Model didn't return clean JSON — fall back to the raw text as the reply.
    res.status(200).json({ reply: text });
  } catch (err) {
    console.error("chat error", err);
    res.status(502).json({ error: "AI chat backend error" });
  }
}
