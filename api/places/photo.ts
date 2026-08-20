import type { VercelRequest, VercelResponse } from "@vercel/node";

const PHOTO_NAME = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const value = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  const name = typeof value === "string" ? value : "";
  if (!PHOTO_NAME.test(name)) {
    res.status(400).json({ error: "Invalid Google Places photo name" });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "Google Places is not configured" });
    return;
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    if (!response.ok) {
      res.status(502).json({ error: "Google Places photo request failed" });
      return;
    }

    const data = (await response.json()) as { photoUri?: string };
    if (!data.photoUri?.startsWith("https://")) {
      res.status(502).json({ error: "Google Places returned no photo" });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.redirect(302, data.photoUri);
  } catch (error) {
    console.error("Google Places photo proxy failed", error);
    res.status(502).json({ error: "Google Places photo request failed" });
  }
}