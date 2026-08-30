#!/usr/bin/env node
/**
 * Generates `api/_shared/candidate-fallback.{js,d.ts}`.
 *
 * Why a generated bundle instead of a plain re-export:
 *
 * A Vercel function build compiles `api/*.ts` to `api/*.js` and emits nothing
 * for `src/`. An `api/` module that says `from "../src/**.js"` therefore cannot
 * resolve that specifier at load time and dies with ERR_MODULE_NOT_FOUND before
 * the handler body runs, so the handler's own try/catch never sees it and the
 * request answers HTTP 500. The local vite dev plugin bundles the handler with
 * its whole import graph, so the failure never reproduces during development.
 * That is exactly what broke `/api/route-candidates` in production.
 *
 * `api/_recommendation-fallback.ts` solved the same problem by inlining static
 * literals, but the candidate fallback pools are built from `EHIME_SPOTS` plus
 * the 札所 datasets and run to hundreds of kilobytes, so hand-inlining them is
 * not an option. Instead esbuild bundles the shared modules into one dependency
 * free ESM file under `api/`, which keeps `src/` as the single source of truth
 * while giving the function bundle something it can actually resolve.
 *
 * The output is committed: local dev, vitest and `tsc -p api/tsconfig.json` all
 * read it directly. `npm run build` regenerates it, and
 * `api/_fallback-candidates.test.ts` fails if the committed copy has drifted.
 *
 * Usage:
 *   node scripts/build-api-shared.mjs            write the generated files
 *   node scripts/build-api-shared.mjs --check    fail (exit 1) if they drifted
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "api", "_shared");
const JS_PATH = join(OUT_DIR, "candidate-fallback.js");
const DTS_PATH = join(OUT_DIR, "candidate-fallback.d.ts");

/** The command shown in the generated banner and in drift failures. */
export const REGENERATE_COMMAND = "node scripts/build-api-shared.mjs";

/**
 * Synthetic entry point. Every value `api/route-candidates.ts` needs, pulled
 * from the two shared modules so esbuild can inline their whole graph.
 */
const ENTRY_SOURCE = `export {
  CANDIDATE_MINIMUM_COUNT,
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_BASE_RADIUS_METERS,
  CANDIDATE_RADII_METERS,
  clampCandidateCount,
  finalizeCandidates,
} from "./src/domain/candidateFallback";
export { DEFAULT_FALLBACK_POOLS } from "./src/data/fallbackPools";
`;

/** An import or require the bundler failed to inline would crash on Vercel. */
const RESIDUAL_IMPORT_PATTERNS = [
  /^[ \t]*import[\s{*"']/m,
  /^[ \t]*export[^;\n]*\bfrom\b/m,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bcreateRequire\b/,
];

/**
 * Loads esbuild, which is present as a transitive dependency of vite.
 *
 * The bare specifier is tried first; the direct path covers a layout where the
 * package is not hoisted to the top-level `node_modules`.
 */
async function loadEsbuild() {
  try {
    return (await import("esbuild")).default;
  } catch {
    const direct = join(ROOT, "node_modules", "esbuild", "lib", "main.js");
    if (!existsSync(direct)) {
      throw new Error(
        "esbuild was not found. Run `npm install` before generating api/_shared.",
      );
    }
    return (await import(pathToFileURL(direct).href)).default;
  }
}

/** Line endings only, so a CRLF checkout hashes and compares like an LF one. */
function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Fingerprint of every module esbuild actually read, so the banner records what
 * the bundle was built from and drift is visible without diffing the payload.
 */
function fingerprint(inputs) {
  const hash = createHash("sha256");
  for (const file of inputs) {
    hash.update(file);
    hash.update("\0");
    hash.update(normalizeNewlines(readFileSync(join(ROOT, file), "utf8")));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

function banner(sourcesHash, inputs) {
  return [
    "/**",
    " * GENERATED FILE - DO NOT EDIT.",
    " *",
    ` * Regenerate with: ${REGENERATE_COMMAND}`,
    " *",
    " * Bundled so the Vercel function build has no `../src/` specifier to",
    " * resolve; see scripts/build-api-shared.mjs for why that mattered.",
    " *",
    ` * Sources (sha256 ${sourcesHash}):`,
    ...inputs.map((file) => ` *   ${file}`),
    " */",
  ].join("\n");
}

/**
 * Hand-written declarations for the bundle.
 *
 * Self-contained on purpose: a `.d.ts` that referenced `src/` would put the
 * `../src/` dependency straight back into the graph `tsc -p api/tsconfig.json`
 * checks. The shapes mirror `src/domain/candidateFallback.ts` and
 * `src/domain/types.ts` structurally, which is what lets the api-local
 * `RouteCandidate` in `api/route-candidates.ts` be passed in without a cast.
 */
function declarations(bannerText) {
  return `${bannerText}

/** Origin of a route candidate. Mirrors \`CandidateSource\` in src/domain/types.ts. */
export type CandidateSource = "primary" | "temple" | "spot" | "rest";

/** Mirrors \`RouteCandidateKind\` in src/domain/types.ts. */
export type RouteCandidateKind = "sightseeing" | "food" | "cafe" | "custom";

/** Mirrors \`GeoPoint\` in src/domain/types.ts. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Mirrors \`RecommendedPlace\` in src/domain/types.ts, which is also the shape of
 * \`EnrichedPlace\` in api/_google-places.ts.
 */
export interface CandidatePlace {
  id: string;
  name: string;
  formattedAddress: string;
  location?: GeoPoint;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: string[];
  photoUrl?: string;
  photoAttributions?: Array<{ displayName: string; uri?: string }>;
}

/** Mirrors \`RouteCandidate\` in src/domain/types.ts. */
export interface RouteCandidate {
  id: string;
  kind: RouteCandidateKind;
  title: string;
  description: string;
  searchQuery: string;
  /**
   * Omitted means primary (Google-verified). Fallbacks use "temple" / "spot",
   * and "rest" marks a break spot standing in for an empty result.
   */
  source?: CandidateSource;
  place: CandidatePlace & { location: GeoPoint };
}

/** A single fallback source point: temples and spots normalised to one shape. */
export interface FallbackPoint {
  id: string;
  source: Exclude<CandidateSource, "primary">;
  name: string;
  location: GeoPoint;
  formattedAddress: string;
  /** Language code to description. Unlisted languages fall back to \`ja\`. */
  descriptions: Partial<Record<string, string>>;
  /** Spot-derived only. Used to exclude food spots for \`sightseeing\`. */
  category?: "sightseeing" | "food" | "souvenir" | "onsen";
  photoUrl?: string;
  websiteUri?: string;
}

/** The fallback inventory, split by data source. */
export interface FallbackPools {
  temples: FallbackPoint[];
  spots: FallbackPoint[];
}

/** Inputs that drive {@link finalizeCandidates}. */
export interface FinalizeContext {
  kind: RouteCandidateKind;
  lang: string;
  center: GeoPoint;
  /** Requested base radius (normally 5,000m). */
  baseRadiusMeters: number;
  /** Place ids already present in the current route. */
  usedPlaceIds: readonly string[];
  /** Upper bound of the candidate set (already clamped). */
  maximumCount: number;
  /** Lower bound of the candidate set. Defaults to {@link CANDIDATE_MINIMUM_COUNT}. */
  minimumCount?: number;
}

/** The settled candidate set plus the radius and minimum count that produced it. */
export interface FinalizeResult {
  candidates: RouteCandidate[];
  /** Radius actually applied when the candidate set was settled. */
  appliedRadiusMeters: number;
  /** Minimum count used for the shortage decision. */
  minimumCount: number;
}

/** Lower bound of the swipe candidate set (Minimum_Count). */
export declare const CANDIDATE_MINIMUM_COUNT: 5;
/** Upper bound of the swipe candidate set (Maximum_Count). */
export declare const CANDIDATE_MAXIMUM_COUNT: 8;
/** Base search radius (Base_Radius) in metres. */
export declare const CANDIDATE_BASE_RADIUS_METERS: 5000;
/** Base radius plus the stepwise expansion radii, ascending by contract. */
export declare const CANDIDATE_RADII_METERS: readonly [5000, 10000, 20000];

/** Clamps a requested candidate count into \`[minimum, CANDIDATE_MAXIMUM_COUNT]\`. */
export declare function clampCandidateCount(
  value: unknown,
  fallback: number,
  minimum?: number,
): number;

/** Settles the candidate set, topping \`sightseeing\` up from the fallback pools. */
export declare function finalizeCandidates(
  primary: readonly RouteCandidate[],
  context: FinalizeContext,
  pools: FallbackPools,
): FinalizeResult;

/** The default Fallback inventory used by every Candidate_Provider. */
export declare const DEFAULT_FALLBACK_POOLS: FallbackPools;
`;
}

/**
 * Bundles the shared modules and renders both generated files.
 *
 * Nothing is written here so `--check` and the test suite can compare against
 * the committed copies without touching them.
 */
export async function renderApiShared() {
  const esbuild = await loadEsbuild();
  const result = await esbuild.build({
    stdin: {
      contents: ENTRY_SOURCE,
      resolveDir: ROOT,
      sourcefile: "api-shared-entry.ts",
      loader: "ts",
    },
    absWorkingDir: ROOT,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2020",
    // Keep the Japanese descriptions readable instead of \\u-escaped.
    charset: "utf8",
    legalComments: "none",
    metafile: true,
    write: false,
  });

  const inputs = Object.keys(result.metafile.inputs)
    .filter((file) => !file.startsWith("<") && existsSync(join(ROOT, file)))
    .sort();
  const bundled = normalizeNewlines(result.outputFiles[0].text);

  for (const pattern of RESIDUAL_IMPORT_PATTERNS) {
    const match = pattern.exec(bundled);
    if (match) {
      throw new Error(
        `The bundle still references a module (${JSON.stringify(match[0])}). `
          + "A Vercel function cannot resolve it, which is the bug this file exists to avoid.",
      );
    }
  }

  const bannerText = banner(fingerprint(inputs), inputs);
  return {
    inputs,
    js: `${bannerText}\n${bundled}`,
    dts: declarations(bannerText),
  };
}

/** Committed content of a generated file, newline-normalised, or `null`. */
function readGenerated(path) {
  return existsSync(path) ? normalizeNewlines(readFileSync(path, "utf8")) : null;
}

async function main() {
  const check = process.argv.includes("--check");
  const rendered = await renderApiShared();
  const files = [
    { path: JS_PATH, name: "api/_shared/candidate-fallback.js", content: rendered.js },
    { path: DTS_PATH, name: "api/_shared/candidate-fallback.d.ts", content: rendered.dts },
  ];

  if (check) {
    const stale = files.filter((file) => readGenerated(file.path) !== file.content);
    if (stale.length > 0) {
      console.error(
        `${stale.map((file) => file.name).join(", ")} is out of date. `
          + `Run \`${REGENERATE_COMMAND}\` and commit the result.`,
      );
      process.exitCode = 1;
      return;
    }
    console.log("api/_shared is up to date.");
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const file of files) {
    writeFileSync(file.path, file.content, "utf8");
    console.log(`wrote ${file.name} (${file.content.length} bytes)`);
  }
  console.log(`bundled from ${rendered.inputs.length} source files`);
}

// Only run when invoked directly; the test suite imports `renderApiShared`.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
