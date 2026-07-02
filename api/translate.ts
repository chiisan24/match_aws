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
import type { TranslateClient } from "@aws-sdk/client-translate";
import { awsCredentials, awsRegion, errorDetail } from "./_aws";

const REGION = awsRegion();

// Lazy-load the AWS SDK inside the request path so a bundling/resolution failure
// surfaces as a catchable error (visible in the response) instead of an opaque
// FUNCTION_INVOCATION_FAILED at module load.
let sdkPromise: Promise<typeof import("@aws-sdk/client-translate")> | null =
  null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = import("@aws-sdk/client-translate");
  return sdkPromise;
}

let client: TranslateClient | null = null;
async function translateClient(): Promise<TranslateClient> {
  const { TranslateClient } = await loadSdk();
  if (!client)
    client = new TranslateClient({
      region: REGION,
      credentials: awsCredentials(),
    });
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

    const out = await (await translateClient()).send(
      new (await loadSdk()).TranslateTextCommand({
        Text: text,
        SourceLanguageCode: "auto",
        TargetLanguageCode: targetCode,
      }),
    );

    res.status(200).json({ text: out.TranslatedText ?? text });
  } catch (err) {
    console.error("translate error", err);
    res.status(502).json({ error: "Translate backend error", detail: errorDetail(err) });
  }
}
