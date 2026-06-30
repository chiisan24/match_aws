/**
 * AWS ImagePort adapter — generative-AI spot/temple photos via Amazon Bedrock.
 *
 * Browsers must never hold AWS credentials, so this adapter does NOT call
 * Bedrock directly. Instead it posts the prompt to the app's serverless API
 * (`{apiEndpoint}/images/generate`), whose Lambda invokes the Bedrock
 * **Titan Image Generator** model with a prompt built from the subject name +
 * description, requesting a royalty-free, text-free photo. The Lambda is
 * expected to cache the result in S3 keyed by the subject `id` and return a
 * stable object URL, so each subject is only billed once (Req 16.3).
 *
 * Expected JSON response (any one of):
 *   { "src": "https://.../bucket/spot-dogo-onsen.png" }  // preferred (S3 URL)
 *   { "url": "https://..." }
 *   { "base64": "<png-base64>" }                          // inline fallback
 *
 * On failure (or when no API endpoint is configured) it throws / returns null
 * and the UI degrades to the on-brand placeholder (Req 4.7).
 */

import type { GeneratedImage, ImagePort, ImagePrompt } from "../../ports";
import type { AwsEnv } from "../../config/env";
import { AWS_NOT_CONFIGURED } from "./not-configured";

interface ImageApiResponse {
  src?: string;
  url?: string;
  base64?: string;
}

export class AwsImageAdapter implements ImagePort {
  constructor(private readonly env: AwsEnv) {}

  async generateImage(prompt: ImagePrompt): Promise<GeneratedImage | null> {
    const endpoint = this.env.apiEndpoint;
    if (!endpoint) {
      throw new Error(AWS_NOT_CONFIGURED("ImagePort.generateImage"));
    }

    const base = endpoint.replace(/\/+$/, "");
    const res = await fetch(`${base}/images/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: prompt.id,
        subject: prompt.subject,
        description: prompt.description,
        category: prompt.category,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Bedrock image generation failed (${res.status} ${res.statusText}).`,
      );
    }

    const data = (await res.json()) as ImageApiResponse;
    const src =
      data.src ??
      data.url ??
      (data.base64 ? `data:image/png;base64,${data.base64}` : undefined);

    if (!src) return null;
    return { src, source: "ai-bedrock" };
  }
}
