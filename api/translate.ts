/**
 * POST /api/translate — real machine translation (Amazon Translate).
 *
 * Body: { text: string, target: LangCode }
 * Returns: { text: string }
 *
 * Maps the app's LangCode to Amazon Translate language codes. The 伊予弁 (`iyo`)
 * dialect is not a real translatable language, so it is returned unchanged.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  TranslateClient,
  TranslateTextCommand,
} from "@aws-sdk/client-translate";

const REGION = process.env.AWS_REGION || "us-east-1";

let client: TranslateClient | null = null;
function translateClient(): TranslateClient {
  if (!client) client = new TranslateClient({ region: REGION });
  return client;
}

/** App LangCode → Amazon Translate code. `null` = no translation (pass through). */
const LANG_MAP: Record<string, string | null> = {
  ja: "ja",
  en: "en",
  "zh-Hans": "zh",
  "zh-Hant": "zh-TW",
  ko: "ko",
  th: "th",
  fr: "fr",
  de: "de",
  es: "es",
  pt: "pt",
  vi: "vi",
  id: "id",
  ar: "ar",
  ru: "ru",
  hi: "hi",
  iyo: null, // 伊予弁: not supported — return source text unchanged
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body ?? {}) as { text?: string; target?: string };
    const text = body.text ?? "";
    const target = body.target ?? "ja";

    if (text.trim() === "") {
      res.status(200).json({ text });
      return;
    }

    const targetCode = LANG_MAP[target];
    if (!targetCode) {
      // Unsupported target (e.g. iyo) — return the original text.
      res.status(200).json({ text });
      return;
    }

    const out = await translateClient().send(
      new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: "auto",
        TargetLanguageCode: targetCode,
      }),
    );

    res.status(200).json({ text: out.TranslatedText ?? text });
  } catch (err) {
    console.error("translate error", err);
    res.status(502).json({ error: "Translate backend error" });
  }
}
