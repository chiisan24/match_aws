/**
 * Vercel Serverless Function: GET /api/spot-image?q=<query>
 *
 * スワイプカード等で使う「スポット画像」を Openverse（CC ライセンス画像の検索 API）
 * から取得して返す。ブラウザから直接 Openverse を叩くと CORS / レート制限の懸念が
 * あるため、同一オリジンのこの関数経由で取得する（API キー不要）。
 *
 * レスポンス: { url, source, license, creator, attribution, landingUrl } または
 *             204（該当画像なし）。
 *
 * 取得した画像は CC ライセンス等のため、表示側で creator / license のクレジットを
 * 併記すること。
 */

const OPENVERSE_ENDPOINT = "https://api.openverse.org/v1/images/";

interface OpenverseResult {
  url?: string;
  thumbnail?: string;
  title?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  foreign_landing_url?: string;
  source?: string;
  attribution?: string;
}

function buildCredit(r: OpenverseResult): string {
  const parts: string[] = [];
  if (r.creator) parts.push(r.creator);
  const lic = [r.license?.toUpperCase(), r.license_version]
    .filter(Boolean)
    .join(" ");
  if (lic) parts.push(lic);
  parts.push("Openverse");
  return parts.join(" / ");
}

export default async function handler(
  req: { method?: string; query?: Record<string, string | string[]> },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => {
      json: (body: unknown) => void;
      end: () => void;
    };
  },
): Promise<void> {
  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const raw = req.query?.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!q) {
    res.status(400).json({ error: "missing query parameter 'q'" });
    return;
  }

  try {
    const params = new URLSearchParams({
      q,
      page_size: "3",
      mature: "false",
    });
    const response = await fetch(`${OPENVERSE_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ehime-tourism-app/0.1 (spot image lookup)",
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: `openverse responded ${response.status}` });
      return;
    }

    const data = (await response.json()) as { results?: OpenverseResult[] };
    const hit = (data.results ?? []).find((r) => r.thumbnail || r.url);

    if (!hit) {
      res.status(204).end();
      return;
    }

    // Cache at the edge to limit repeat lookups for the same spot.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    res.status(200).json({
      url: hit.thumbnail || hit.url,
      source: hit.source ?? "openverse",
      license: hit.license ?? "",
      creator: hit.creator ?? "",
      attribution: hit.attribution ?? "",
      landingUrl: hit.foreign_landing_url ?? "",
      credit: buildCredit(hit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ error: message });
  }
}
