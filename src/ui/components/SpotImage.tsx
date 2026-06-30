/**
 * SpotImage — a spot photo that shows a real internet-fetched image when one is
 * available, the local `spot.imageUrls` image otherwise, and the on-brand
 * {@link PlaceholderImage} as a last resort.
 *
 * The internet image is fetched via an injected {@link SpotImageSearch}
 * (Openverse, see `adapters/spotImages`); its credit (creator / license) is
 * shown linked beneath the image. Any lookup or load failure transparently
 * falls back to the local image / placeholder, so the component is robust and
 * trivially testable (no network when `imageSearch` is omitted).
 */

import { useEffect, useState } from "react";

import type { Spot } from "../../domain/types";
import { PlaceholderImage, type PlaceholderMotif } from "./PlaceholderImage";

/** Result of an internet image lookup for a spot. */
export interface SpotImageSearchResult {
  /** Direct image URL suitable for an <img> src. */
  url: string;
  /** Optional human-readable credit line shown alongside the image. */
  credit?: string;
}

/**
 * Internet image lookup — inject `fetchSpotImage` from `adapters/spotImages`.
 * Given a free-text query (the spot name) it resolves a real photo URL, or
 * `null` to fall back to the local image / placeholder.
 */
export type SpotImageSearch = (
  query: string,
  signal?: AbortSignal,
) => Promise<SpotImageSearchResult | null>;

export interface SpotImageProps {
  /** The spot whose photo is shown. */
  spot: Spot;
  /** Placeholder motif used on fallback. Defaults to the generic spot motif. */
  motif?: PlaceholderMotif;
  /** Fixed aspect ratio for the placeholder tile. */
  aspectRatio?: string;
  /** Class applied to the rendered `<img>` (preserves screen-specific styling). */
  imageClassName?: string;
  /**
   * Whether to render the visible credit caption when a credit string exists.
   * Defaults to true; pass false for decorative / thumbnail uses where the
   * caption would clutter the layout.
   */
  showCredit?: boolean;
  /**
   * Optional internet image lookup. When provided, a real photo is fetched for
   * the spot (by name) and shown in place of the local placeholder, with its
   * credit linked beneath it. Falls back to the local image / placeholder on
   * any failure.
   */
  imageSearch?: SpotImageSearch;
}

/**
 * Render a spot's photo.
 *
 * Decision order:
 *  1. Internet-fetched photo (when `imageSearch` yields one and it loads).
 *  2. The local `spot.imageUrls[0]` image (when present and it loads).
 *  3. The on-brand {@link PlaceholderImage}.
 */
export function SpotImage({
  spot,
  motif = "spot",
  aspectRatio,
  imageClassName,
  showCredit = true,
  imageSearch,
}: SpotImageProps): JSX.Element {
  const [errored, setErrored] = useState(false);
  const [internet, setInternet] = useState<SpotImageSearchResult | null>(null);
  const [internetErrored, setInternetErrored] = useState(false);

  // The image the app would display locally (unchanged selection logic).
  const url = spot.imageUrls[0];

  // Reset load/lookup state whenever the spot changes so a previously-broken
  // image never sticks to a different spot.
  useEffect(() => {
    setErrored(false);
    setInternet(null);
    setInternetErrored(false);
  }, [spot.id]);

  // Internet image lookup (Openverse via /api/spot-image). Best-effort: any
  // failure leaves `internet` null so the local/placeholder fallback applies.
  useEffect(() => {
    if (!imageSearch) return;
    const controller = new AbortController();
    let cancelled = false;
    imageSearch(spot.name, controller.signal)
      .then((result) => {
        if (!cancelled) setInternet(result);
      })
      .catch(() => {
        if (!cancelled) setInternet(null);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [imageSearch, spot.id, spot.name]);

  // (1) Internet-fetched photo takes priority when available and loads OK.
  if (imageSearch && internet && !internetErrored) {
    const netImg = (
      <img
        className={imageClassName}
        src={internet.url}
        alt={spot.name}
        loading="lazy"
        onError={() => setInternetErrored(true)}
      />
    );
    if (!showCredit || !internet.credit) return netImg;
    return (
      <figure className="spot-image">
        {netImg}
        <figcaption
          className="spot-image__credit"
          data-testid="spot-image-credit"
        >
          {internet.credit}
        </figcaption>
      </figure>
    );
  }

  // (2) Placeholder when there is no usable local URL or it failed to load.
  if (!url || errored) {
    return (
      <PlaceholderImage motif={motif} label={spot.name} aspectRatio={aspectRatio} />
    );
  }

  // (3) The local image.
  return (
    <img
      className={imageClassName}
      src={url}
      alt={spot.name}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
