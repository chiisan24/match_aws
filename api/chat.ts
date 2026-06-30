/**
 * Vercel Serverless Function: POST /api/chat
 *
 * AI 旅行相談チャットのバックエンド。AWS Bedrock (Converse API) を呼び出し、
 * 愛媛観光アドバイザーとしての応答テキストを返す。
 *
 * - AWS 認証情報はこのサーバー側関数のみが保持する（ブラウザには出さない）。
 * - 環境変数（Vercel のプロジェクト設定で指定）:
 *     BEDROCK_REGION          例: ap-northeast-1（既定）
 *     BEDROCK_MODEL_ID        例: anthropic.claude-3-haiku-20240307-v1:0（既定）
 *     BEDROCK_ACCESS_KEY_ID   IAM アクセスキー
 *     BEDROCK_SECRET_ACCESS_KEY IAM シークレットキー
 *     BEDROCK_SESSION_TOKEN   （任意）一時認証情報を使う場合
 *
 *   ※ Bedrock 側で対象モデルの「モデルアクセス」を有効化し、IAM に
 *      bedrock:InvokeModel 権限が必要。
 *
 * リクエスト body: { lang?: string, messages: { role: "user"|"assistant", text: string }[] }
 * レスポンス      : { message: string }
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

interface InboundMessage {
  role: "user" | "assistant";
  text: string;
}

const REGION = process.env.BEDROCK_REGION || "ap-northeast-1";
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

/** Build the Bedrock client, passing explicit credentials when provided. */
function buildClient(): BedrockRuntimeClient {
  const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY;
  const sessionToken = process.env.BEDROCK_SESSION_TOKEN;

  if (accessKeyId && secretAccessKey) {
    return new BedrockRuntimeClient({
      region: REGION,
      credentials: { accessKeyId, secretAccessKey, sessionToken },
    });
  }
  // Fall back to the default provider chain (useful for local AWS profiles).
  return new BedrockRuntimeClient({ region: REGION });
}

/**
 * Normalize an arbitrary transcript into a valid Converse message list:
 * non-empty turns, starting with a user turn, with consecutive same-role turns
 * merged so roles strictly alternate.
 */
function toConverseMessages(messages: InboundMessage[]) {
  const cleaned = messages
    .filter((m) => m && typeof m.text === "string" && m.text.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      text: m.text.trim(),
    }));

  // Drop any leading assistant turns — Converse must start with a user turn.
  while (cleaned.length > 0 && cleaned[0].role === "assistant") {
    cleaned.shift();
  }

  const merged: { role: "user" | "assistant"; text: string }[] = [];
  for (const turn of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.text = `${last.text}\n${turn.text}`;
    } else {
      merged.push({ role: turn.role as "user" | "assistant", text: turn.text });
    }
  }

  return merged.map((m) => ({ role: m.role, content: [{ text: m.text }] }));
}

function systemPrompt(lang: string): string {
  return [
    "あなたは愛媛県の旅行を案内する、親しみやすい観光アドバイザーです。",
    "道後温泉・松山城・しまなみ海道・みかんグルメなど、愛媛の観光やご当地グルメに詳しく、",
    "温かく、堅苦しくない口調で、簡潔に（2〜4文程度で）答えてください。",
    "ユーザーがおすすめの場所を尋ねたら、具体的なスポットを提案してください。",
    `必ず次の言語コードの言語で返答してください: ${lang || "ja"}。`,
  ].join("\n");
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => {
      json: (body: unknown) => void;
      end: () => void;
    };
  },
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
    const lang: string = typeof body.lang === "string" ? body.lang : "ja";
    const messages: InboundMessage[] = Array.isArray(body.messages)
      ? body.messages
      : [];

    const converseMessages = toConverseMessages(messages);
    if (converseMessages.length === 0) {
      res.status(400).json({ error: "no user message provided" });
      return;
    }

    const client = buildClient();
    const result = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt(lang) }],
        messages: converseMessages,
        inferenceConfig: { maxTokens: 512, temperature: 0.7 },
      }),
    );

    const text =
      result.output?.message?.content
        ?.map((c) => ("text" in c ? c.text : ""))
        .join("")
        .trim() ?? "";

    if (!text) {
      res.status(502).json({ error: "empty model response" });
      return;
    }

    res.status(200).json({ message: text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ error: message });
  }
}
