import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchEhimePlace } from "../_google-places.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body ?? {}) as { query?: unknown; lang?: unknown };
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 120) : "";
  const lang = typeof body.lang === "string" ? body.lang.slice(0, 16) : "ja";
  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const place = await searchEhimePlace(query, lang);
    if (!place) {
      res.status(404).json({ error: "Place not found" });
      return;
    }
    res.status(200).json({ place });
  } catch (error) {
    console.error("Google Places lookup failed", error);
    res.status(502).json({ error: "Google Places lookup failed" });
  }
}