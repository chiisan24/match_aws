/**
 * Candidate settling logic, resolved for the Vercel function.
 *
 * This module used to re-export `src/domain/candidateFallback.ts` and
 * `src/data/fallbackPools.ts` directly. That works locally, where the vite dev
 * plugin bundles the handler together with its whole import graph, but not on
 * Vercel: the function build compiles `api/*.ts` to `.js` and emits nothing for
 * `src/`, so the `../src/**.js` specifiers could not be resolved at load time.
 * The failure happened while loading the module, before `api/route-candidates.ts`
 * ran a single line, so its catch (which answers 502) never saw it and every
 * `/api/route-candidates` request returned HTTP 500 in production.
 *
 * So `api/` reads a generated bundle instead. `scripts/build-api-shared.mjs`
 * inlines the shared modules into `api/_shared/candidate-fallback.js` with no
 * import left in it, which keeps `src/` the single source of truth: the
 * algorithm and the pools are still defined exactly once, and the mock adapter
 * plus the client-side final guard keep importing them from `src/`.
 * `api/_fallback-candidates.test.ts` fails if the committed bundle drifts from
 * `src/`, if an import reappears in it, or if this file reaches into `../src/`
 * again.
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
  DEFAULT_FALLBACK_POOLS,
} from "./_shared/candidate-fallback.js";

export type {
  CandidateSource,
  FallbackPoint,
  FallbackPools,
  FinalizeContext,
  FinalizeResult,
} from "./_shared/candidate-fallback.js";
