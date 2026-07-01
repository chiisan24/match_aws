/**
 * Shared server-side AWS helpers for the Vercel Functions under `api/`.
 *
 * These run on the server only, so they use real AWS credentials from the
 * function environment (the AWS SDK default provider chain reads
 * `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`). Nothing here is
 * bundled into the browser. Files prefixed with `_` are not routable endpoints.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsCredentials, awsRegion } from "./_aws";

/** Region for Bedrock — BEDROCK_REGION → AWS_REGION → us-east-1. */
const REGION = awsRegion();

/** Default models (override via env in the Vercel dashboard). */
export const CHAT_MODEL_ID =
  process.env.BEDROCK_CHAT_MODEL_ID ||
  process.env.BEDROCK_MODEL_ID ||
  "anthropic.claude-3-5-haiku-20241022-v1:0";
export const IMAGE_MODEL_ID =
  process.env.BEDROCK_IMAGE_MODEL_ID || "amazon.titan-image-generator-v1";

let client: BedrockRuntimeClient | null = null;
function bedrock(): BedrockRuntimeClient {
  if (!client)
    client = new BedrockRuntimeClient({
      region: REGION,
      credentials: awsCredentials(),
    });
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
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: args.maxTokens ?? 1024,
    system: args.system,
    messages: args.messages.map((m) => ({
      role: m.role,
      content: [{ type: "text", text: m.text }],
    })),
  };

  const out = await bedrock().send(
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

  const out = await bedrock().send(
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
