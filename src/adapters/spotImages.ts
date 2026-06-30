/**
 * Spot image lookup — fetches a real photo for a spot from the internet via the
 * same-origin Vercel function `GET /api/spot-image` (which queries Openverse,
 * CC-licensed images). Used by the swipe cards to show actual photos instead of
 * the local placeholder.
 *
 * Resilient by design: any failure (network error, non-2xx, no result, missing
 * API in local dev) resolves to `null` so the caller falls back to the existing
 * placeholder behaviour.
 */

export interface SpotImageResult {
  /** Direct image URL suitable for an <img> src (a thumbnail when available). */
  url: string;
  /** Human-readable credit line (creator / license / Openverse) for display. */
  credit?: string;
}

/**
 * Look up a spot image by free-text query (typically the spot name).
 * Returns `null` when no usable image is found or on any error.
 */
export async function fetchSpotImage(
  query: string,
  signal?: AbortSignal,
): Promise<SpotImageResult | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const response = await fetch(
      `/api/spot-image?q=${encodeURIComponent(q)}`,
      { signal, headers: { Accept: "application/json" } },
    );

    // 204 (no result) or any non-2xx → fall back to placeholder.
    if (!response.ok || response.status === 204) return null;

    const data: unknown = await response.json();
    const url =
      data && typeof (data as { url?: unknown }).url === "string"
        ? (data as { url: string }).url
        : "";
    if (!url) return null;

    const credit =
      data && typeof (data as { credit?: unknown }).credit === "string"
        ? (data as { credit: string }).credit
        : undefined;

    return { url, credit };
  } catch {
    return null;
  }
}
