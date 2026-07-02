/**
 * useWikipediaImage — look up a real, name-searched photo from the Japanese
 * Wikipedia for a subject (e.g. a 札所 temple name) and expose it for display.
 *
 * The お遍路マッチ cards use this to show an actual photo of each temple found
 * by *name* (Req: 名前で調べて画像表示), falling back to AI generation / an
 * on-brand placeholder when nothing is found.
 *
 * Implementation notes:
 *  - Calls the MediaWiki API on `ja.wikipedia.org` with `origin=*`, which is
 *    CORS-enabled, so this works directly from the browser with no backend and
 *    no API key.
 *  - Uses `generator=search` so a plain name (with redirects) resolves to the
 *    best-matching article, then reads that article's `pageimages` thumbnail.
 *  - Module-level caches memoise results by query for the session and de-dupe
 *    concurrent lookups for the same query — mirroring {@link useGeneratedImage}.
 *
 * Content note: images returned are hosted on Wikimedia; attribution/licensing
 * lives on each file's Commons page. This is a development-time convenience for
 * the MVP; a production build should surface proper credit per image.
 */

import { useEffect, useState } from "react";

/** State of a name-based Wikipedia image lookup. */
export type WikipediaImageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; src: string }
  | { status: "error" };

// Session-lifetime caches shared by every hook instance. `null` = looked up,
// none found (so we don't refetch a known miss).
const cache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

interface WikiPage {
  index?: number;
  title?: string;
  thumbnail?: { source?: string };
}

/**
 * Query the ja.wikipedia API for the best article image matching `query` (the
 * bare 札所 name). Searching the name alone makes the temple's own article the
 * top hit; we then prefer the highest-ranked result **whose title contains the
 * name** and has a thumbnail — so e.g. `龍光寺` resolves to `龍光寺 (宇和島市)`
 * rather than the generic pilgrimage article, and unrelated hits (観音菩薩,
 * 四国八十八箇所, …) are skipped.
 */
async function fetchWikipediaImage(query: string): Promise<string | null> {
  const url =
    "https://ja.wikipedia.org/w/api.php" +
    "?action=query&format=json&origin=*&redirects=1" +
    "&generator=search&gsrlimit=5&gsrsearch=" +
    encodeURIComponent(query) +
    "&prop=pageimages&piprop=thumbnail&pithumbsize=640";

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const pages = data.query?.pages;
  if (!pages) return null;

  // Search-rank order, keeping only pages that actually have a thumbnail.
  const withThumb = Object.values(pages)
    .filter((p) => typeof p.thumbnail?.source === "string" && p.thumbnail.source)
    .sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
  if (withThumb.length === 0) return null;

  // Prefer a title that contains the searched name (handles disambiguated
  // titles like "龍光寺 (宇和島市)"); otherwise take the top-ranked hit.
  const named = withThumb.find((p) => (p.title ?? "").includes(query));
  return (named ?? withThumb[0]).thumbnail!.source!;
}

/**
 * Returns the name-searched Wikipedia image for `query`, fetching it (once)
 * when enabled. Pass `query = null` or `enabled = false` to skip the lookup.
 */
export function useWikipediaImage(
  query: string | null,
  enabled: boolean,
): WikipediaImageState {
  const [state, setState] = useState<WikipediaImageState>(() => {
    if (query && cache.has(query)) {
      const cached = cache.get(query)!;
      return cached ? { status: "ready", src: cached } : { status: "error" };
    }
    return { status: "idle" };
  });

  useEffect(() => {
    if (!enabled || !query) return;

    if (cache.has(query)) {
      const cached = cache.get(query)!;
      setState(cached ? { status: "ready", src: cached } : { status: "error" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    let request = inFlight.get(query);
    if (!request) {
      request = fetchWikipediaImage(query).catch(() => null);
      inFlight.set(query, request);
    }

    request.then((src) => {
      inFlight.delete(query);
      cache.set(query, src);
      if (cancelled) return;
      setState(src ? { status: "ready", src } : { status: "error" });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, query]);

  return state;
}
