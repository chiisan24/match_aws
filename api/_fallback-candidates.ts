/**
 * Bridge module: the single point where `api/` reaches into `src/`.
 *
 * The candidate settling algorithm (Fallback top-up, stepwise radius
 * expansion, dedupe, count clamping) lives once in
 * `src/domain/candidateFallback.ts` so the Vercel function, the mock adapter
 * and the client-side final guard all share it.
 *
 * Every `src` import is confined to this file (following the `_aws.ts` /
 * `_google-places.ts` underscore-prefix convention) so that if Vercel's
 * function bundling ever fails to resolve outside `api/`, only this module
 * needs a fallback — the algorithm itself stays shared.
 *
 * The shared modules must stay free of DOM, React, `import.meta` and
 * environment variables.
 */

export {
  CANDIDATE_MINIMUM_COUNT,
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_BASE_RADIUS_METERS,
  CANDIDATE_RADII_METERS,
  clampCandidateCount,
  finalizeCandidates,
} from "../src/domain/candidateFallback.js";

export type {
  CandidateSource,
  FallbackPoint,
  FallbackPools,
  FinalizeContext,
  FinalizeResult,
} from "../src/domain/candidateFallback.js";

export { DEFAULT_FALLBACK_POOLS } from "../src/data/fallbackPools.js";
