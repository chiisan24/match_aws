/**
 * AWS TranslatePort adapter — real machine translation.
 *
 * Calls the app's serverless API (`{apiEndpoint}/translate`), which invokes
 * **Amazon Translate** server-side (Req 19). The browser never holds AWS
 * credentials. On failure it throws, and the i18n layer falls back to the
 * original text (Req 19.3), so a translation outage never breaks the UI.
 */

import type { LangCode, TranslatePort } from "../../ports";
import type { AwsEnv } from "../../config/env";
import { AWS_NOT_CONFIGURED } from "./not-configured";

interface TranslateApiResponse {
  text?: string;
}

export class AwsTranslateAdapter implements TranslatePort {
  constructor(private readonly env: AwsEnv) {}

  async translate(text: string, target: LangCode): Promise<string> {
    if (text.trim() === "") return text;

    const endpoint = this.env.apiEndpoint;
    if (!endpoint) throw new Error(AWS_NOT_CONFIGURED("TranslatePort.translate"));
    const base = endpoint.replace(/\/+$/, "");

    const res = await fetch(`${base}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target }),
    });
    if (!res.ok) {
      throw new Error(
        `Translate backend failed (${res.status} ${res.statusText}).`,
      );
    }

    const data = (await res.json()) as TranslateApiResponse;
    return data.text ?? text;
  }
}
