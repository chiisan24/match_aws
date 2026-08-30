// @vitest-environment node
/**
 * Guards the generated `api/_shared/` bundle.
 *
 * `api/_fallback-candidates.ts` reads a bundle produced by
 * `scripts/build-api-shared.mjs` instead of importing `../src/` directly,
 * because a Vercel function bundle contains no compiled `src/` and the
 * unresolvable specifier crashed the module before `api/route-candidates.ts`
 * could answer (HTTP 500 on every call). A generated artifact can go stale and
 * a regenerated one can quietly grow an import, so this file pins all three
 * invariants: the committed bundle matches what the generator produces today,
 * it contains no import or require, and `api/route-candidates.ts` reaches
 * nothing outside `api/` at runtime. It also checks the bundled copies of
 * `clampCandidateCount`, `finalizeCandidates` and `DEFAULT_FALLBACK_POOLS`
 * against the `src/` originals so a stale bundle cannot silently change
 * behaviour.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  CANDIDATE_BASE_RADIUS_METERS,
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_MINIMUM_COUNT,
  CANDIDATE_RADII_METERS,
  clampCandidateCount as bundledClampCandidateCount,
  DEFAULT_FALLBACK_POOLS as BUNDLED_POOLS,
  finalizeCandidates as bundledFinalizeCandidates,
} from "./_fallback-candidates.js";
import {
  CANDIDATE_MAXIMUM_COUNT as SOURCE_MAXIMUM_COUNT,
  CANDIDATE_MINIMUM_COUNT as SOURCE_MINIMUM_COUNT,
  clampCandidateCount as sourceClampCandidateCount,
  finalizeCandidates as sourceFinalizeCandidates,
} from "../src/domain/candidateFallback.js";
import { DEFAULT_FALLBACK_POOLS as SOURCE_POOLS } from "../src/data/fallbackPools.js";
import type { RouteCandidate, RouteCandidateKind } from "../src/domain/types.js";

const BUNDLE_PATH = "api/_shared/candidate-fallback.js";
const KINDS: RouteCandidateKind[] = ["sightseeing", "food", "cafe", "custom"];

/** Pool ids used as `usedPlaceIds`, so exclusion actually removes candidates. */
const POOL_IDS = [
  ...SOURCE_POOLS.temples.slice(0, 6).map((point) => point.id),
  ...SOURCE_POOLS.spots.slice(0, 6).map((point) => point.id),
];

/** A Primary-shaped candidate. Only `place.id` and the count drive settling. */
function primaryCandidate(placeId: string, index: number): RouteCandidate {
  return {
    id: `primary:${placeId}`,
    kind: "sightseeing",
    title: `候補${index}`,
    description: `説明${index}`,
    searchQuery: `検索${index}`,
    place: {
      id: placeId,
      name: `候補${index}`,
      formattedAddress: "愛媛県",
      location: { lat: 33.8 + index / 500, lng: 132.7 + index / 500 },
    },
  };
}

describe("the generated api/_shared bundle is current", () => {
  it("matches what scripts/build-api-shared.mjs produces from src/ today", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/build-api-shared.mjs", "--check"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.error).toBeUndefined();
    // Non-zero means src/domain/candidateFallback.ts, src/data/fallbackPools.ts
    // or one of their transitive imports changed without a regeneration.
    expect(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim()).toContain(
      "api/_shared is up to date.",
    );
    expect(result.status).toBe(0);
  });

  it("re-exports the same constants the shared module declares", () => {
    expect(CANDIDATE_MINIMUM_COUNT).toBe(SOURCE_MINIMUM_COUNT);
    expect(CANDIDATE_MAXIMUM_COUNT).toBe(SOURCE_MAXIMUM_COUNT);
    expect(CANDIDATE_BASE_RADIUS_METERS).toBe(5_000);
    expect(CANDIDATE_RADII_METERS).toEqual([5_000, 10_000, 20_000]);
  });
});

describe("nothing in the route-candidates graph leaves api/", () => {
  it("leaves no import or require in the generated bundle", () => {
    const bundle = readFileSync(BUNDLE_PATH, "utf8");

    // Each of these would be an unresolvable specifier inside a Vercel
    // function bundle, which is the failure mode this file exists to prevent.
    expect(bundle).not.toMatch(/^[ \t]*import[\s{*"']/m);
    expect(bundle).not.toMatch(/^[ \t]*export[^;\n]*\bfrom\b/m);
    expect(bundle).not.toMatch(/\bimport\s*\(/);
    expect(bundle).not.toMatch(/\brequire\s*\(/);
  });

  it("keeps api/_fallback-candidates.ts free of ../src imports", () => {
    const source = readFileSync("api/_fallback-candidates.ts", "utf8");

    // The regression that produced ERR_MODULE_NOT_FOUND in production.
    expect(source).not.toMatch(/^[ \t]*(?:import|export)[^;]*from\s+["']\.\.\/src\//m);
    expect(source).not.toMatch(/\bimport\s*\(\s*["']\.\.\/src\//);
  });

  it("keeps every module api/route-candidates.ts loads inside api/", () => {
    const visited = new Set<string>();
    const queue = ["api/route-candidates.ts"];
    const escapes: string[] = [];

    while (queue.length > 0) {
      const file = queue.shift() as string;
      if (visited.has(file)) continue;
      visited.add(file);

      const source = readFileSync(file, "utf8");
      for (const [, specifier] of source.matchAll(
        // Value imports and re-exports only; `import type` never reaches runtime.
        /^[ \t]*(?:import|export)(?!\s+type\b)[^;]*?from\s+["'](\.[^"']+)["']/gms,
      )) {
        const resolved = resolve(dirname(file), specifier).replace(/\\/g, "/");
        const relativePath = resolved.slice(process.cwd().replace(/\\/g, "/").length + 1);
        if (!relativePath.startsWith("api/")) {
          escapes.push(`${file} -> ${specifier}`);
          continue;
        }
        // Handlers are authored as `.js` specifiers; only `.ts` sources exist.
        const candidates = [relativePath.replace(/\.js$/, ".ts"), relativePath];
        const next = candidates.find((path) => existsSync(join(process.cwd(), path)));
        if (next?.endsWith(".ts")) queue.push(next);
      }
    }

    expect(escapes).toEqual([]);
    expect(visited).toContain("api/_fallback-candidates.ts");
  });
});

describe("the bundled copy behaves like the src/ original", () => {
  it("exposes a deep-equal DEFAULT_FALLBACK_POOLS", () => {
    expect(BUNDLED_POOLS).toEqual(SOURCE_POOLS);
    expect(BUNDLED_POOLS.temples.length).toBeGreaterThan(0);
    expect(BUNDLED_POOLS.spots.length).toBeGreaterThan(0);
  });

  it("clamps candidate counts identically", () => {
    const count = fc.oneof(
      fc.integer({ min: -20, max: 20 }),
      fc.double({ min: -20, max: 20, noNaN: true }),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    );

    fc.assert(
      fc.property(
        // `value` is `unknown`, so the non-numeric branches must be reachable.
        fc.oneof(count, fc.constantFrom<unknown>("5", null, undefined, true, {})),
        count,
        fc.option(count, { nil: undefined }),
        (value, fallback, minimum) => {
          expect(bundledClampCandidateCount(value, fallback, minimum))
            .toBe(sourceClampCandidateCount(value, fallback, minimum));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("settles candidate sets identically", () => {
    const placeId = fc.oneof(
      fc.constantFrom(...POOL_IDS),
      fc.integer({ min: 0, max: 12 }).map((index) => `primary-${index}`),
    );

    fc.assert(
      fc.property(
        fc.array(placeId, { maxLength: 10 }),
        fc.constantFrom(...KINDS),
        fc.constantFrom("ja", "en", "iyo", "ko"),
        // Ehime, so the pools actually fall inside the expansion radii.
        fc.record({
          lat: fc.double({ min: 32.9, max: 34.35, noNaN: true }),
          lng: fc.double({ min: 132.0, max: 133.7, noNaN: true }),
        }),
        fc.constantFrom(1, 1_000, 5_000, 10_000, 20_000, 30_000),
        fc.subarray(POOL_IDS, { maxLength: 6 }),
        fc.integer({ min: 0, max: 10 }),
        fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
        (placeIds, kind, lang, center, baseRadiusMeters, usedPlaceIds, maximumCount, minimumCount) => {
          const primary = placeIds.map((id, index) => primaryCandidate(id, index));
          const context = {
            kind,
            lang,
            center,
            baseRadiusMeters,
            usedPlaceIds,
            maximumCount,
            minimumCount,
          };

          expect(bundledFinalizeCandidates(primary, context, BUNDLED_POOLS))
            .toEqual(sourceFinalizeCandidates(primary, context, SOURCE_POOLS));
        },
      ),
      { numRuns: 150 },
    );
  });
});
