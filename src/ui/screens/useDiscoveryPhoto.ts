/**
 * useDiscoveryPhotos — resolves Google Places photos for the 発見 screen.
 *
 * Every lookup is billed, so this hook exists to make one promise precise: a
 * spot is looked up **at most once, ever**. Three layers enforce it.
 *
 *  1. Only the card on screen and the next one are requested at all (Req 6.2).
 *     Prefetching exactly one ahead is what keeps the next card instant without
 *     paying for spots the user may never reach.
 *  2. The persisted cache is checked first, so a spot resolved in an earlier
 *     session costs nothing (Req 7.2, 7.3).
 *  3. Failures are remembered for the session, so a 404 (the spot simply is not
 *     in Places) is not retried on every re-render (Req 8.10, 8.11).
 *
 * When `apiEndpoint` is unset — the default in local development — no request is
 * ever made and every card falls back to a bundled image (Req 8.6, 8.7). That is
 * also what makes this safe under jsdom: tests never touch the network unless
 * they set the endpoint themselves.
 */

import { useEffect, useRef } from "react";

import { useDiscovery } from "../../app/DiscoveryContext";
import { awsEnv } from "../../config/env";
import type { LangCode, PlacePhotoAttribution, Spot } from "../../domain/types";

/** Shape of the `/places/lookup` success body we care about. */
interface LookupResponse {
  place?: {
    photoUrl?: unknown;
    photoAttributions?: unknown;
  };
}

/** Join the configured endpoint and the lookup path with exactly one slash (Req 6.10). */
function lookupUrl(endpoint: string): string {
  return `${endpoint.replace(/\/+$/, "")}/places/lookup`;
}

/** Keep only well-formed attributions; Google requires `displayName`. */
function parseAttributions(value: unknown): PlacePhotoAttribution[] {
  if (!Array.isArray(value)) return [];
  const parsed: PlacePhotoAttribution[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { displayName?: unknown; uri?: unknown };
    if (typeof candidate.displayName !== "string" || candidate.displayName === "") {
      continue;
    }
    parsed.push({
      displayName: candidate.displayName,
      ...(typeof candidate.uri === "string" && candidate.uri
        ? { uri: candidate.uri }
        : {}),
    });
  }
  return parsed;
}

/**
 * Fetch photos for `spots` (the current card and the next one), filling the
 * shared cache as results arrive.
 *
 * Returns nothing: the card reads its photo from the cache, which means a
 * pending request never blocks rendering or the decision buttons (Req 6.9). A
 * result that lands after the user has already swiped past is still cached, so
 * the work is not wasted.
 */
export function useDiscoveryPhotos(spots: readonly Spot[], lang: LangCode): void {
  const { hasPhoto, cachePhoto, photoFailed, markPhotoFailed } = useDiscovery();

  // Requests in flight this mount. Without this, a re-render between "request
  // sent" and "result cached" would fire a second billed call for the same spot.
  const inFlightRef = useRef<Set<string>>(new Set<string>());

  useEffect(() => {
    const endpoint = awsEnv.apiEndpoint;
    // No backend configured — never call, every card uses a bundled image.
    if (!endpoint) return;

    let cancelled = false;
    const inFlight = inFlightRef.current;

    for (const spot of spots) {
      if (hasPhoto(spot.id) || photoFailed(spot.id) || inFlight.has(spot.id)) {
        continue;
      }
      inFlight.add(spot.id);
      void (async () => {
        try {
          const response = await fetch(lookupUrl(endpoint), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: spot.name, lang }),
          });
          // 404 (not in Places), 502 (search failed) and 503 (no key) are all
          // "no photo for this spot" — the card falls back and we stop asking.
          if (!response.ok) {
            markPhotoFailed(spot.id);
            return;
          }
          const data = (await response.json()) as LookupResponse;
          const photoUrl = data.place?.photoUrl;
          if (typeof photoUrl !== "string" || photoUrl === "") {
            markPhotoFailed(spot.id);
            return;
          }
          if (cancelled) return;
          cachePhoto({
            id: spot.id,
            photoUrl,
            attributions: parseAttributions(data.place?.photoAttributions),
          });
        } catch {
          // Network error / abort — treat as "no photo this session" (Req 8.5).
          markPhotoFailed(spot.id);
        } finally {
          inFlight.delete(spot.id);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [spots, lang, hasPhoto, cachePhoto, photoFailed, markPhotoFailed]);
}
