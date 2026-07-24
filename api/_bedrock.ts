/**
 * Shared server-side AWS helpers for the Vercel Functions under `api/`.
 *
 * Bedrock Runtime uses `AWS_BEARER_TOKEN_BEDROCK` automatically through the
 * AWS SDK. If the token is absent, IAM credentials are resolved instead.
 * Nothing here is bundled into the browser. Files prefixed with `_` are not
 * routable endpoints.
 */

import type { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { awsCredentials, awsRegion } from "./_aws.js";

/** Region for Bedrock — BEDROCK_REGION → AWS_REGION → ap-northeast-1. */
const REGION = awsRegion();

/** Default models (override via env in the Vercel dashboard). */
export const CHAT_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ||
  process.env.BEDROCK_CHAT_MODEL_ID ||
  "jp.anthropic.claude-sonnet-4-6";
export const IMAGE_MODEL_ID =
  process.env.BEDROCK_IMAGE_MODEL_ID || "amazon.titan-image-generator-v1";

/**
 * Lazy-load the AWS SDK inside the request lifecycle instead of at module load.
 * If resolving/bundling the SDK ever fails, it now throws where the route
 * handlers can catch it (and return the real message) rather than crashing the
 * whole function at import time with an opaque FUNCTION_INVOCATION_FAILED.
 */
let sdkPromise:
  | Promise<typeof import("@aws-sdk/client-bedrock-runtime")>
  | null = null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = import("@aws-sdk/client-bedrock-runtime");
  return sdkPromise;
}

let client: BedrockRuntimeClient | null = null;
async function bedrock(): Promise<BedrockRuntimeClient> {
  const { BedrockRuntimeClient } = await loadSdk();
  if (!client) {
    const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
    if (/^(?:Bearer\s+|AWS_BEARER_TOKEN_BEDROCK=)/i.test(bearerToken ?? "")) {
      throw new Error(
        "AWS_BEARER_TOKEN_BEDROCK must contain only the Bedrock API key value.",
      );
    }

    client = bearerToken
      ? new BedrockRuntimeClient({
          region: REGION,
          token: { token: bearerToken },
          authSchemePreference: ["httpBearerAuth"],
        })
      : new BedrockRuntimeClient({
          region: REGION,
          credentials: awsCredentials(),
        });
  }
  return client;
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  text: string;
}

/**
 * Invokes an Anthropic Claude model on Bedrock and returns its text output.
 * `messages` must start with a user turn and alternate roles; callers should
 * normalize first (see `normalizeMessages`).
 */
export async function invokeClaude(args: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<string> {
  const { InvokeModelCommand } = await loadSdk();
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: args.maxTokens ?? 1024,
    system: args.system,
    messages: args.messages.map((m) => ({
      role: m.role,
      content: [{ type: "text", text: m.text }],
    })),
  };

  const out = await (await bedrock()).send(
    new InvokeModelCommand({
      modelId: CHAT_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    }),
  );

  const decoded = JSON.parse(new TextDecoder().decode(out.body)) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return (decoded.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

/**
 * Invokes Amazon Titan Image Generator and returns a single PNG as base64.
 * Returns `null` if the model produced no image.
 */
export async function invokeTitanImage(args: {
  prompt: string;
  negativeText?: string;
  seed?: number;
}): Promise<string | null> {
  const { InvokeModelCommand } = await loadSdk();
  const body = {
    taskType: "TEXT_IMAGE",
    textToImageParams: {
      text: args.prompt,
      ...(args.negativeText ? { negativeText: args.negativeText } : {}),
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      quality: "standard",
      height: 512,
      width: 512,
      cfgScale: 8.0,
      seed: args.seed ?? 0,
    },
  };

  const out = await (await bedrock()).send(
    new InvokeModelCommand({
      modelId: IMAGE_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    }),
  );

  const decoded = JSON.parse(new TextDecoder().decode(out.body)) as {
    images?: string[];
  };
  return decoded.images?.[0] ?? null;
}

/**
 * Best-effort JSON extraction from an LLM text reply: tolerates ```json fences
 * and surrounding prose by grabbing the first `{ … }` block.
 */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Normalizes a turn history for Claude: drops leading assistant turns so it
 * starts with a user message, and coalesces consecutive same-role turns.
 */
export function normalizeMessages(
  messages: ClaudeMessage[],
): ClaudeMessage[] {
  const out: ClaudeMessage[] = [];
  for (const m of messages) {
    if (out.length === 0 && m.role !== "user") continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.text = `${last.text}\n\n${m.text}`;
    } else {
      out.push({ role: m.role, text: m.text });
    }
  }
  return out;
}
