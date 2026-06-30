/**
 * POST /api/images/generate — real royalty-free photo generation
 * (Amazon Bedrock / Titan Image Generator).
 *
 * Body: { id, subject, description?, category? }
 * Returns: { base64: string } (PNG) — the frontend wraps it as a data URL.
 *
 * Titan-generated images are royalty-free for the account that creates them.
 * The prompt is built from the subject + description and steers toward a clean,
 * text-free photo of an Ehime, Japan scene.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { invokeTitanImage } from "../_bedrock";

interface ImageBody {
  id?: string;
  subject?: string;
  description?: string;
  category?: string;
}

/** Stable seed from the subject id so the same subject looks consistent. */
function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Titan seed range is 0..2147483646.
  return Math.abs(h) % 2147483646;
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
    const body = (req.body ?? {}) as ImageBody;
    const subject = body.subject?.trim();
    if (!subject) {
      res.status(400).json({ error: "subject required" });
      return;
    }

    const prompt = [
      `A beautiful, realistic travel photograph of ${subject} in Ehime, Japan.`,
      body.description ? body.description : "",
      "Natural daylight, scenic, high detail, no people in focus.",
    ]
      .filter(Boolean)
      .join(" ");

    const negativeText =
      "text, letters, words, watermark, logo, signature, caption, frame, blurry, distorted";

    const base64 = await invokeTitanImage({
      prompt,
      negativeText,
      seed: body.id ? seedFrom(body.id) : 0,
    });

    if (!base64) {
      res.status(502).json({ error: "No image generated" });
      return;
    }

    res.status(200).json({ base64 });
  } catch (err) {
    console.error("image generate error", err);
    res.status(502).json({ error: "Image generation backend error" });
  }
}
