/**
 * useWikipediaImage — look up a real, name-searched photo from the Japanese
 * Wikipedia for a subject (e.g. a 札所 temple name) together with the credit its
 * licence requires.
 *
 * The お遍路マッチ cards use this to show an actual photo of each temple found
 * by *name* (Req: 名前で調べて画像表示), falling back to AI generation / an
 * on-brand placeholder when nothing is found.
 *
 * Two rules shape everything here, both learned from real misbehaviour:
 *
 *  1. **A photo we cannot vouch for is not shown.** `generator=search` is a
 *     full-text search, so it always answers — a name with no article of its own
 *     still returns five articles that merely mention the words. Accepting the
 *     top hit put a group photo of strangers on a café card. A hit is used only
 *     when its title is confidently *about* the searched name
 *     ({@link isConfidentArticleTitle}).
 *  2. **A photo we cannot credit is not shown.** Wikimedia files are licensed
 *     individually; CC BY / BY-SA oblige us to name the author wherever the image
 *     appears. So the licence and author are fetched alongside the thumbnail, and
 *     an image whose licence or required author cannot be determined is treated
 *     as unusable rather than displayed bare.
 *
 * Implementation notes:
 *  - Calls the MediaWiki API on `ja.wikipedia.org` with `origin=*`, which is
 *    CORS-enabled, so this works directly from the browser with no backend and
 *    no API key. `imageinfo` resolves files hosted on Commons too.
 *  - Two requests per subject: the article search, then the file's `extmetadata`.
 *    Both are behind the same per-query cache, so a subject costs them once per
 *    session.
 *  - Module-level caches memoise results by query for the session and de-dupe
 *    concurrent lookups for the same query — mirroring {@link useGeneratedImage}.
 */

import { useEffect, useState } from "react";

/** A Wikimedia-hosted photo plus everything needed to credit it. */
export interface WikipediaPhoto {
  /** Thumbnail URL to render. */
  src: string;
  /** File description page, where the full licence text lives. May be empty. */
  descriptionUrl: string;
  /** Photographer / uploader as Wikimedia records them, as plain text. */
  artist: string;
  /** Short licence name, e.g. `CC BY-SA 4.0`, `Public domain`. */
  license: string;
  /**
   * True when the licence obliges us to name the author wherever the image is
   * shown.
   *
   * Only images that are `false` here may be used somewhere too small to carry a
   * visible credit (a 40px thumbnail). Commons omits the field on some files, and
   * an absent value is read as "required" — guessing the permissive direction is
   * the one mistake with a legal consequence.
   */
  requiresAttribution: boolean;
}

/** State of a name-based Wikipedia image lookup. */
export type WikipediaImageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; photo: WikipediaPhoto }
  | { status: "error" };

// Session-lifetime caches shared by every hook instance. `null` = looked up,
// none usable (so we don't refetch a known miss).
const cache = new Map<string, WikipediaPhoto | null>();
const inFlight = new Map<string, Promise<WikipediaPhoto | null>>();

const API = "https://ja.wikipedia.org/w/api.php";

interface WikiPage {
  index?: number;
  title?: string;
  pageimage?: string;
  thumbnail?: { source?: string };
}

interface WikiFilePage {
  imageinfo?: Array<{
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: unknown } | undefined>;
  }>;
}

/**
 * Strips the HTML Wikimedia stores in `extmetadata` down to display text.
 *
 * `Artist` is authored markup, not a plain name — commonly
 * `<a href="/wiki/User:Foo" title="User:Foo">Foo</a>` or a whole `<span>` with
 * nested links. Rendering it raw would mean injecting third-party HTML, and
 * showing it escaped would put tags in front of the user, so it is flattened to
 * text here. `&amp;` is decoded last so an escaped entity like `&amp;lt;` does
 * not get decoded twice.
 */
export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether `title` is an article *about* `query`, rather than one that merely
 * mentions it.
 *
 * This is the guard that decides whether a photo is shown at all, so it is
 * deliberately strict. A café called 喫茶ニジ once ended up wearing a group photo
 * lifted from an unrelated article about something containing 「ニジ」, because the
 * previous rule took the top-ranked hit whenever no title matched. Nothing
 * downstream can tell that such a photo is wrong, so an unverifiable photo is not
 * worth showing — the card falls back to a placeholder carrying the real name.
 *
 * A title qualifies when it is the query itself, optionally followed by a
 * parenthesised qualifier: `松山城`, `松山城 (伊予国)`, `龍光寺 (宇和島市)`.
 * Plain `includes` was too loose — 「ニジ」 sits inside plenty of unrelated titles.
 */
export function isConfidentArticleTitle(title: string, query: string): boolean {
  const articleTitle = title.trim();
  const searched = query.trim();
  if (searched.length === 0) return false;
  if (articleTitle === searched) return true;
  if (!articleTitle.startsWith(searched)) return false;
  // Only a disambiguation suffix may follow, e.g. "松山城 (伊予国)".
  const remainder = articleTitle.slice(searched.length).trim();
  return /^[（(][^（(]*[）)]$/.test(remainder);
}

/** A metadata field's value as plain text, or `""` when absent. */
function metaText(
  extmetadata: Record<string, { value?: unknown } | undefined> | undefined,
  key: string,
): string {
  const raw = extmetadata?.[key]?.value;
  return typeof raw === "string" ? plainTextFromHtml(raw) : "";
}

/**
 * Reads the credit for a Commons / Wikipedia file, or `null` when it cannot be
 * established.
 *
 * Returning `null` is a decision, not a failure path: without a licence name
 * there is nothing truthful to print beside the photo, and without an author for
 * a licence that demands one the display would be non-compliant. Both cases are
 * better served by falling back to a placeholder.
 */
async function fetchFileCredit(
  fileName: string,
): Promise<Omit<WikipediaPhoto, "src"> | null> {
  const url =
    `${API}?action=query&format=json&origin=*` +
    "&prop=imageinfo&iiprop=extmetadata%7Curl" +
    "&iiextmetadatafilter=Artist%7CLicenseShortName%7CAttributionRequired" +
    "&titles=" +
    encodeURIComponent(`File:${fileName}`);

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiFilePage> };
  };
  const info = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info) return null;

  const artist = metaText(info.extmetadata, "Artist");
  const license = metaText(info.extmetadata, "LicenseShortName");
  // Absent means "unknown", which we read as "required" — see WikipediaPhoto.
  const requiresAttribution =
    metaText(info.extmetadata, "AttributionRequired").toLowerCase() !== "false";

  if (!license) return null;
  if (requiresAttribution && !artist) return null;

  return {
    descriptionUrl: typeof info.descriptionurl === "string" ? info.descriptionurl : "",
    artist,
    license,
    requiresAttribution,
  };
}

/**
 * Finds the article confidently about `query` and returns its lead image's
 * thumbnail URL and file name, or `null`.
 *
 * Hits are considered in search-rank order, so `龍光寺` resolves to
 * `龍光寺 (宇和島市)` while unrelated hits (観音菩薩, 四国八十八箇所, …) and
 * coincidental substring matches are skipped rather than displayed.
 */
async function searchArticleImage(
  query: string,
): Promise<{ src: string; fileName: string } | null> {
  const url =
    `${API}?action=query&format=json&origin=*&redirects=1` +
    "&generator=search&gsrlimit=5&gsrsearch=" +
    encodeURIComponent(query) +
    "&prop=pageimages&piprop=thumbnail%7Cname&pithumbsize=640";

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    query?: { pages?: Record<string, WikiPage> };
  };
  const pages = data.query?.pages;
  if (!pages) return null;

  // Search-rank order, keeping only pages that actually have a usable image.
  const usable = Object.values(pages)
    .filter(
      (page) =>
        typeof page.thumbnail?.source === "string"
        && page.thumbnail.source.length > 0
        && typeof page.pageimage === "string"
        && page.pageimage.length > 0,
    )
    .sort((a, b) => (a.index ?? 999) - (b.index ?? 999));

  // No confident match means no photo. There is deliberately no "best effort"
  // branch here: showing the top-ranked hit is what put a stranger's photo on a
  // café card.
  const confident = usable.find((page) =>
    isConfidentArticleTitle(page.title ?? "", query),
  );
  if (!confident) return null;

  return { src: confident.thumbnail!.source!, fileName: confident.pageimage! };
}

/** The creditable photo for `query`, or `null` when there is not one. */
async function fetchWikipediaPhoto(query: string): Promise<WikipediaPhoto | null> {
  const found = await searchArticleImage(query);
  if (!found) return null;
  const credit = await fetchFileCredit(found.fileName);
  if (!credit) return null;
  return { src: found.src, ...credit };
}

/**
 * Returns the name-searched Wikipedia photo for `query`, fetching it (once)
 * when enabled. Pass `query = null` or `enabled = false` to skip the lookup.
 */
export function useWikipediaImage(
  query: string | null,
  enabled: boolean,
): WikipediaImageState {
  const [state, setState] = useState<WikipediaImageState>(() => {
    if (query && cache.has(query)) {
      const cached = cache.get(query)!;
      return cached ? { status: "ready", photo: cached } : { status: "error" };
    }
    return { status: "idle" };
  });

  useEffect(() => {
    if (!enabled || !query) return;

    if (cache.has(query)) {
      const cached = cache.get(query)!;
      setState(cached ? { status: "ready", photo: cached } : { status: "error" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    let request = inFlight.get(query);
    if (!request) {
      request = fetchWikipediaPhoto(query).catch(() => null);
      inFlight.set(query, request);
    }

    request.then((photo) => {
      inFlight.delete(query);
      cache.set(query, photo);
      if (cancelled) return;
      setState(photo ? { status: "ready", photo } : { status: "error" });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, query]);

  return state;
}
