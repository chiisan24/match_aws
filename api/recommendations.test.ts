// @vitest-environment node
/**
 * Harness for the Recommendation_API request path (`api/recommendations.ts`).
 *
 * The handler owns module-scoped state (`recommendationCache`,
 * `recommendationRequests`, `refreshAllowedAt`) and reaches Bedrock and Google
 * Places through two modules. Everything below exists so a test can drive the
 * whole request path in memory: the two collaborators are replaced by spies, the
 * module state is taken fresh per test through {@link loadHandler}, and the
 * backoff waits are observed rather than slept through.
 *
 * No reset-only export was added to the handler for this; a fresh module
 * instance is what resets the state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { EnrichedPlace } from "./_google-places.js";
/**
 * The contract predicates are taken through the bridge the handler itself
 * imports, so a response is judged by the very implementation the
 * Plan_First_Screen runs on arrival. Not mocked here, and a test that mocks
 * `./_recommendation-fallback.js` wholesale has to keep these two real
 * (`importActual`) for that claim to hold.
 */
import {
  isTourismRecommendations,
  itineraryPlanViolations,
} from "./_recommendation-fallback.js";

const invokeClaude = vi.fn();
const searchEhimePlace = vi.fn();

/**
 * `extractJson` is reimplemented rather than re-exported so the harness never
 * loads `_bedrock.ts`, which resolves an AWS region and model ids from the
 * environment at import time. Mirrors the real extraction: a ```json fence if
 * present, otherwise the first `{ … }` block.
 */
vi.mock("./_bedrock.js", () => ({
  invokeClaude: (...args: unknown[]) => invokeClaude(...args),
  extractJson: <T,>(text: string): T | null => {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  },
}));

vi.mock("./_google-places.js", () => ({
  searchEhimePlace: (...args: unknown[]) => searchEhimePlace(...args),
}));

/**
 * Plan_Count, restated rather than imported: this is the number a test asserts
 * against, and reading it from the module under test would make the assertion
 * agree with whatever that module happens to hold. The contract predicates above
 * are imported for the opposite reason — they are the client's judgement, not the
 * test's expectation. Keep in step with `ITINERARY_PLAN_COUNT`.
 */
const PLAN_COUNT = 5;

const RECOMMENDATION_SCHEMA = "itinerary-v1";

// ---------------------------------------------------------------------------
// Module instance
// ---------------------------------------------------------------------------

interface Harness {
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>;
  /** Injection point for retry timing; `now` may be replaced per test. */
  timing: { now: () => number; sleep: (ms: number) => Promise<void> };
  /** Backoff waits the handler asked for, in order. */
  delays: number[];
}

/**
 * A handler with empty cache, no in-flight requests and no refresh reservations.
 *
 * `vi.resetModules()` plus a dynamic import is what makes that true: the state
 * lives in module scope, so a new module instance is the reset. The injected
 * `sleep` records the wait instead of performing it, which keeps backoff
 * assertions instant and lets a test read the delay sequence.
 */
async function loadHandler(): Promise<Harness> {
  vi.resetModules();
  const mod = await import("./recommendations.js");
  const delays: number[] = [];
  mod.recommendationTiming.sleep = async (ms: number): Promise<void> => {
    delays.push(ms);
  };
  return { handler: mod.default, timing: mod.recommendationTiming, delays };
}

// ---------------------------------------------------------------------------
// Wall clock
// ---------------------------------------------------------------------------

/**
 * Fakes `Date` only, leaving `setTimeout` real.
 *
 * `recommendationCache` writes `freshUntil` / `staleUntil` from `Date.now()`, so
 * ageing an entry into a Stale_Cache_Entry means moving the clock itself. Timers
 * stay real on purpose: the retry waits are observed through the injected
 * `sleep`, which reads more directly than driving a fake timer queue through an
 * `await`-heavy generation path.
 */
function freezeWallClock(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
}

/**
 * Moves the frozen clock forward. Requires {@link freezeWallClock} first.
 *
 * Note for callers crossing a day boundary: the handler rejects any `date` that
 * is not today's JST date, so the request query has to be rebuilt with
 * {@link todayJst} after a large jump.
 */
function advanceWallClock(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

// ---------------------------------------------------------------------------
// Request / response stubs
// ---------------------------------------------------------------------------

/** What the handler wrote to the response, in a shape assertions can read. */
interface Recorded {
  status: number;
  /** Header names lower-cased, values stringified. */
  headers: Record<string, string>;
  body: unknown;
}

/**
 * The JST date the handler computes for "today".
 *
 * Same arithmetic as `japanDate()`: a request carrying any other date is a 400,
 * so the two have to agree.
 */
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A well-formed request query; `overrides` replaces individual parameters. */
function baseQuery(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    schema: RECOMMENDATION_SCHEMA,
    count: String(PLAN_COUNT),
    date: todayJst(),
    lang: "ja",
    ...overrides,
  };
}

/**
 * Minimal `VercelRequest`. `ip` fills `x-forwarded-for`, which is how the
 * handler identifies a client, so tests that must not share a refresh slot pass
 * distinct addresses.
 */
function makeReq(init: {
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string>;
  body?: unknown;
  ip?: string;
}): VercelRequest {
  return {
    method: init.method ?? "GET",
    query: init.query ?? {},
    body: init.body,
    headers: { "x-forwarded-for": init.ip ?? "203.0.113.1" },
  } as unknown as VercelRequest;
}

/**
 * An Intentional_Refresh: POST with `refresh=1` in the query and the body the
 * client sends, the Exclusion_List included.
 *
 * The handler reads `schema` / `count` / `date` from the body on POST and only
 * cross-checks the query copies, so both carry the same values here.
 */
function makeRefreshReq(init: { exclude?: unknown; ip?: string } = {}): VercelRequest {
  const query = baseQuery({ refresh: "1" });
  return makeReq({
    method: "POST",
    query,
    body: {
      lang: "ja",
      count: PLAN_COUNT,
      schema: RECOMMENDATION_SCHEMA,
      date: query.date,
      exclude: init.exclude ?? [],
    },
    ...(init.ip ? { ip: init.ip } : {}),
  });
}

/** Record-only `VercelResponse`. Chainable, like the real one. */
function makeRes(): { res: VercelResponse; recorded: Recorded } {
  const recorded: Recorded = { status: 0, headers: {}, body: undefined };
  const res = {
    setHeader(name: string, value: string | number) {
      recorded.headers[name.toLowerCase()] = String(value);
      return res;
    },
    status(code: number) {
      recorded.status = code;
      return res;
    },
    json(payload: unknown) {
      recorded.body = payload;
      return res;
    },
  } as unknown as VercelResponse;
  return { res, recorded };
}

/** The 200 response body the handler sends. */
interface RecommendationsBody {
  plans: Array<{ id: string; title: string; origin?: string; stops: unknown[] }>;
  degraded: boolean;
}

function bodyOf(recorded: Recorded): RecommendationsBody {
  return recorded.body as RecommendationsBody;
}

// ---------------------------------------------------------------------------
// Bedrock payloads
// ---------------------------------------------------------------------------

const STOP_KINDS = ["sightseeing", "food", "cafe", "custom"] as const;

/** Strictly ascending 24-hour times: 09:00, 11:00, 13:00, … */
function stopTime(stopIndex: number): string {
  return `${String(Math.min(23, 9 + stopIndex * 2)).padStart(2, "0")}:00`;
}

/** The `searchQuery` of one stop; {@link placeFor} decodes it back. */
function stopQuery(planIndex: number, stopIndex: number): string {
  return `plan-${planIndex + 1}-stop-${stopIndex + 1}`;
}

const STOP_QUERY_PATTERN = /^plan-(\d+)-stop-(\d+)$/;

/**
 * A Bedrock reply that `normalizePlan` accepts: every field it demands is
 * present, times ascend, and ids / titles / lead places stay distinct across
 * plans so the synthesis step does not treat two plans as one.
 *
 * `planCount` and `stopsPerPlan` are free so a test can build a contract
 * violation deliberately (four plans, or five stops in one plan).
 */
function bedrockPayload(planCount: number, stopsPerPlan = 2): string {
  const plans = Array.from({ length: planCount }, (_, planIndex) => ({
    id: `plan-${planIndex + 1}`,
    mode: "tourism",
    icon: "🍊",
    title: `プラン${planIndex + 1}`,
    summary: `プラン${planIndex + 1}の概要`,
    reason: `プラン${planIndex + 1}をすすめる理由`,
    duration: "6時間",
    transport: "電車と徒歩",
    intensity: "ゆったり",
    stops: Array.from({ length: stopsPerPlan }, (_, stopIndex) => ({
      time: stopTime(stopIndex),
      kind: STOP_KINDS[stopIndex % STOP_KINDS.length],
      title: `立寄先${planIndex + 1}-${stopIndex + 1}`,
      description: `立寄先${planIndex + 1}-${stopIndex + 1}の説明`,
      searchQuery: stopQuery(planIndex, stopIndex),
    })),
  }));
  return JSON.stringify({ plans });
}

// ---------------------------------------------------------------------------
// Google Places payloads
// ---------------------------------------------------------------------------

/** Deterministic non-negative hash, used to place queries the harness did not mint. */
function hashQuery(value: string): number {
  let acc = 0;
  for (const char of value) acc = (acc * 31 + (char.codePointAt(0) ?? 0)) % 100_000;
  return acc;
}

/**
 * The place a query resolves to.
 *
 * Stops of one plan sit 0.005° apart (~550m) so all of them fall inside the
 * 5km itinerary radius and `largestNearbyCluster` keeps the whole plan; plans
 * sit 0.1° apart (~11km) so they never share an anchor. `id` is derived from the
 * query, which keeps the lead place distinct per plan.
 */
function placeFor(query: string): EnrichedPlace {
  const parsed = STOP_QUERY_PATTERN.exec(query);
  const planIndex = parsed ? Number(parsed[1]) - 1 : hashQuery(query) % 8;
  const stopIndex = parsed ? Number(parsed[2]) - 1 : 0;
  return {
    id: `place-${query}`,
    name: `${query} 施設`,
    formattedAddress: `愛媛県テスト市 ${query}`,
    location: {
      lat: 33.5 + planIndex * 0.1 + stopIndex * 0.005,
      lng: 132.5 + planIndex * 0.1 + stopIndex * 0.005,
    },
  };
}

// ---------------------------------------------------------------------------
// Failure scenarios
//
// The generator and the two `configure*` helpers below are the input surface the
// property tests of this file drive; the smoke test at the bottom only walks the
// success path through them.
// ---------------------------------------------------------------------------

/** How `invokeClaude` behaves. `http400` and `validationException` are Fatal_Failures. */
type BedrockMode =
  | "ok"
  | "http429"
  | "http500"
  | "http400"
  | "validationException"
  | "badJson"
  | "fourPlans";

/** State of `recommendationCache` before the request under test. */
type CachePreset = "empty" | "fresh" | "stale" | "expired";

interface FailureScenario {
  bedrock: BedrockMode;
  /** Indexes of the generated plans Place_Enricher is allowed to verify. */
  verifiedIndexes: number[];
  /** How many entries the Exclusion_List carries. */
  exclusionCount: number;
  cache: CachePreset;
}

/** Failure combinations. 100 runs is enough to walk every path. */
const failureArb: fc.Arbitrary<FailureScenario> = fc.record({
  bedrock: fc.constantFrom<BedrockMode>(
    "ok",
    "http429",
    "http500",
    "http400",
    "validationException",
    "badJson",
    "fourPlans",
  ),
  verifiedIndexes: fc.subarray([0, 1, 2, 3, 4]),
  // 10 is the largest list `parseExclusions` accepts; 11 is a 400 and belongs to
  // the request-validation property instead.
  exclusionCount: fc.integer({ min: 0, max: 10 }),
  cache: fc.constantFrom<CachePreset>("empty", "fresh", "stale", "expired"),
});

/** Points `invokeClaude` at the reply (or rejection) the mode names. */
function configureBedrock(mode: BedrockMode): void {
  switch (mode) {
    case "ok":
      invokeClaude.mockResolvedValue(bedrockPayload(PLAN_COUNT));
      return;
    case "badJson":
      // Unterminated: `extractJson` finds no closing brace and returns null.
      invokeClaude.mockResolvedValue('お待ちください {"plans": [{"id": "a"');
      return;
    case "fourPlans":
      invokeClaude.mockResolvedValue(bedrockPayload(PLAN_COUNT - 1));
      return;
    case "http429":
      invokeClaude.mockRejectedValue(new Error("Bedrock HTTP 429: throttled"));
      return;
    case "http500":
      invokeClaude.mockRejectedValue(new Error("Bedrock HTTP 500: internal error"));
      return;
    case "http400":
      invokeClaude.mockRejectedValue(new Error("Bedrock HTTP 400: malformed input"));
      return;
    case "validationException":
      invokeClaude.mockRejectedValue(
        Object.assign(new Error("model input is invalid"), {
          name: "ValidationException",
        }),
      );
      return;
  }
}

/**
 * Every Fatal_Failure, named by the thing the handler keys off.
 *
 * `configureBedrock` above carries one of each shape, which is enough to pick a
 * branch but not enough to speak for the whole set — the statuses and the names
 * are two separate lists in the handler, and a Fatal_Failure that fell out of
 * either would retry silently.
 */
const FATAL_BEDROCK_FAILURES = [
  "http400",
  "http401",
  "http403",
  "http404",
  "AccessDeniedException",
  "CredentialsProviderError",
  "ResourceNotFoundException",
  "UnrecognizedClientException",
  "ValidationException",
] as const;

type FatalBedrockFailure = (typeof FATAL_BEDROCK_FAILURES)[number];

const HTTP_FAILURE_PATTERN = /^http(\d{3})$/;

/**
 * Points `invokeClaude` at one Fatal_Failure, in the shape that failure really
 * arrives in.
 *
 * The two shapes are not interchangeable. A transport failure is recognised by
 * the `Bedrock HTTP {status}:` prefix that `invokeClaude` itself throws with, and
 * carries no useful `name`; an SDK rejection is recognised by `name` and carries
 * no such prefix. Producing both is the point of the list above.
 */
function configureFatalBedrock(failure: FatalBedrockFailure): void {
  const status = HTTP_FAILURE_PATTERN.exec(failure)?.[1];
  invokeClaude.mockRejectedValue(
    status
      ? new Error(`Bedrock HTTP ${status}: the request cannot be served`)
      : Object.assign(new Error("bedrock rejected the request"), { name: failure }),
  );
}

/**
 * Backoff_Delays and the attempt ceiling, restated for the same reason as
 * {@link PLAN_COUNT}: an assertion that reads its expectation out of the module
 * under test agrees with that module by construction. Keep in step with
 * `BACKOFF_DELAYS_MS` / `MAX_GENERATION_ATTEMPTS`.
 */
const BACKOFF_DELAYS_MS = [300, 900];
const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Lets Place_Enricher resolve only the named plans' stops; every other query
 * comes back unresolved, which is how a partial verification is staged.
 */
function configurePlaces(verifiedPlanIndexes: readonly number[]): void {
  const allowed = new Set(verifiedPlanIndexes);
  searchEhimePlace.mockImplementation(async (query: string) => {
    const parsed = STOP_QUERY_PATTERN.exec(query);
    const planIndex = parsed ? Number(parsed[1]) - 1 : -1;
    return allowed.has(planIndex) ? placeFor(query) : null;
  });
}

/** An Exclusion_List of `count` entries that match nothing the harness generates. */
function exclusionsOf(count: number): Array<{ id: string; title: string; place: string }> {
  return Array.from({ length: count }, (_, index) => ({
    id: `past-${index + 1}`,
    title: `過去テーマ${index + 1}`,
    place: `過去スポット${index + 1}`,
  }));
}

/** Cache_TTL and Stale_Retention, restated so an entry can be aged past either. */
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Brings `recommendationCache` into the state `preset` names: one successful
 * plain GET fills it, then the frozen wall clock moves past Cache_TTL ("stale")
 * or past Stale_Retention ("expired"). Requires {@link freezeWallClock} first.
 *
 * Throws if the priming request did not succeed, so a harness fault surfaces
 * instead of quietly turning a scenario into the "empty" one.
 *
 * Callers must build the request under test *after* this returns: an ageing jump
 * can cross JST midnight and the handler only accepts today's date.
 */
async function primeCache(
  handler: Harness["handler"],
  preset: CachePreset,
): Promise<void> {
  if (preset === "empty") return;
  configureBedrock("ok");
  configurePlaces([0, 1, 2, 3, 4]);
  const warmed = makeRes();
  await handler(makeReq({ query: baseQuery() }), warmed.res);
  if (warmed.recorded.status !== 200) {
    throw new Error(`cache priming answered HTTP ${warmed.recorded.status}`);
  }
  if (preset === "stale") advanceWallClock(CACHE_TTL_MS + 60_000);
  if (preset === "expired") advanceWallClock(STALE_RETENTION_MS + 60_000);
}

beforeEach(() => {
  vi.clearAllMocks();
  invokeClaude.mockReset();
  searchEhimePlace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("api/recommendations handler", () => {
  it("harness smoke: a verified generation answers 200 with five ai plans", async () => {
    freezeWallClock();
    configureBedrock("ok");
    configurePlaces([0, 1, 2, 3, 4]);

    const { handler, delays } = await loadHandler();
    const first = makeRes();
    await handler(makeReq({ query: baseQuery() }), first.res);

    expect(first.recorded.status).toBe(200);
    const body = bodyOf(first.recorded);
    expect(body.plans).toHaveLength(PLAN_COUNT);
    expect(body.plans.map((plan) => plan.origin)).toEqual(
      Array.from({ length: PLAN_COUNT }, () => "ai"),
    );
    expect(body.degraded).toBe(false);
    // No failure, so no retry and no backoff wait.
    expect(invokeClaude).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);

    // The wall clock helpers are the harness's only way to age a cache entry,
    // so exercise them here: inside Cache_TTL the same reply is served without
    // a second generation.
    advanceWallClock(60_000);
    const second = makeRes();
    await handler(makeReq({ query: baseQuery() }), second.res);
    expect(second.recorded.status).toBe(200);
    expect(bodyOf(second.recorded).plans).toHaveLength(PLAN_COUNT);
    expect(invokeClaude).toHaveBeenCalledTimes(1);
  });
});
describe("api/recommendations degraded responses", () => {
  /**
   * The regression this feature exists for: the screen used to show HTTP 502 and
   * nothing selectable whenever generation failed.
   *
   * Driven as an Intentional_Refresh rather than a plain GET, because POST is
   * what puts every dimension of the scenario onto the failure path: a GET
   * ignores `exclude`, and a fresh cache entry answers it without generating at
   * all. The GET path is pinned by the two examples below.
   */
  it("Feature: recommendations-backend-error-fix, Property 11: 生成が失敗しても応答は 200 になる", async () => {
    await fc.assert(
      fc.asyncProperty(failureArb, async (scenario) => {
        // Per run, not per test: the cache, the in-flight map and the refresh
        // reservations live in module scope, so only a new module instance
        // clears them. Hence `asyncProperty` — the reload is asynchronous.
        vi.useRealTimers();
        freezeWallClock();
        invokeClaude.mockReset();
        searchEhimePlace.mockReset();
        const { handler } = await loadHandler();

        await primeCache(handler, scenario.cache);
        configureBedrock(scenario.bedrock);
        configurePlaces(scenario.verifiedIndexes);

        const { res, recorded } = makeRes();
        await handler(
          makeRefreshReq({ exclude: exclusionsOf(scenario.exclusionCount) }),
          res,
        );

        // Requirements 1.1, 5.5: whatever failed, the caller gets five plans to
        // choose from. The Fallback_Plan_Pool holds eight, so the 502 of
        // Requirement 1.6 is out of reach here.
        expect(recorded.status).toBe(200);
        expect(bodyOf(recorded).plans).toHaveLength(PLAN_COUNT);
      }),
    );
  });

  // Requirement 9.1
  it("answers 200 with five fallback plans when Bedrock fails with HTTP 500", async () => {
    freezeWallClock();
    configureBedrock("http500");
    configurePlaces([]);

    const { handler } = await loadHandler();
    const { res, recorded } = makeRes();
    await handler(makeReq({ query: baseQuery() }), res);

    expect(recorded.status).toBe(200);
    const body = bodyOf(recorded);
    expect(body.plans).toHaveLength(PLAN_COUNT);
    expect(body.degraded).toBe(true);
    // Nothing was generated and the cache was empty, so the pool supplied all five.
    expect(body.plans.map((plan) => plan.origin)).toEqual(
      Array.from({ length: PLAN_COUNT }, () => "fallback"),
    );
    // Requirement 1.7: a degraded reply must not be cached by anyone.
    expect(recorded.headers["cache-control"]).toBe("private, no-store");
  });

  // Requirement 9.2
  it("keeps the verified plans and tops the response up when only three resolve", async () => {
    freezeWallClock();
    configureBedrock("ok");
    configurePlaces([0, 1, 2]);

    const { handler } = await loadHandler();
    const { res, recorded } = makeRes();
    await handler(makeReq({ query: baseQuery() }), res);

    expect(recorded.status).toBe(200);
    const body = bodyOf(recorded);
    expect(body.plans).toHaveLength(PLAN_COUNT);
    expect(body.degraded).toBe(true);
    // Requirement 1.2: the verified plans lead the response.
    expect(body.plans.map((plan) => plan.origin)).toEqual([
      "ai",
      "ai",
      "ai",
      "fallback",
      "fallback",
    ]);
    // …in the order they were generated.
    expect(body.plans.slice(0, 3).map((plan) => plan.id)).toEqual([
      "plan-1",
      "plan-2",
      "plan-3",
    ]);
  });
});

describe("api/recommendations response contract", () => {
  /**
   * The point of the degraded reply: it has to be a payload the screen can
   * actually render, not merely a 200.
   *
   * The predicate is the shared `isTourismRecommendations` — the same one the
   * Plan_First_Screen applies to what it receives — and it runs on the
   * serialized body rather than on the objects the handler held, because JSON is
   * what the client sees. So this pins the claim end to end: a response the
   * server let through cannot be rejected by the client.
   *
   * Conditional on a 200 by design. Whether a 200 comes back at all is
   * Property 11's claim, so a 502 run is skipped here rather than asserted
   * twice; the counter below only guards against the property going vacuous.
   */
  it("Feature: recommendations-backend-error-fix, Property 1: 200 応答は常にちょうど5件で Itinerary_Contract を満たす", async () => {
    let answered = 0;

    await fc.assert(
      fc.asyncProperty(failureArb, async (scenario) => {
        // Per run, not per test: the module-scoped cache, in-flight map and
        // refresh reservations are only cleared by a fresh module instance.
        vi.useRealTimers();
        freezeWallClock();
        invokeClaude.mockReset();
        searchEhimePlace.mockReset();
        const { handler } = await loadHandler();

        await primeCache(handler, scenario.cache);
        configureBedrock(scenario.bedrock);
        configurePlaces(scenario.verifiedIndexes);

        const { res, recorded } = makeRes();
        await handler(
          makeRefreshReq({ exclude: exclusionsOf(scenario.exclusionCount) }),
          res,
        );

        if (recorded.status !== 200) return;
        answered += 1;

        const wire = JSON.parse(JSON.stringify(bodyOf(recorded))) as RecommendationsBody;

        // Requirement 2.1
        expect(wire.plans).toHaveLength(PLAN_COUNT);
        // Requirements 2.2, 9.5. Listed per plan first: on a failure the reasons
        // name which rule broke, which a boolean predicate cannot.
        expect(
          wire.plans.flatMap((plan, index) =>
            itineraryPlanViolations(plan).map((reason) => `plans[${index}]: ${reason}`),
          ),
        ).toEqual([]);
        expect(isTourismRecommendations(wire.plans)).toBe(true);
      }),
    );

    // The premise held at least once, so the assertions above were reached.
    expect(answered).toBeGreaterThan(0);
  });
});

describe("api/recommendations retry policy", () => {
  /**
   * A Fatal_Failure is a refused request, not a busy backend: retrying it burns
   * the caller's wait for a rejection that cannot change. So the claim is about
   * what the handler did *not* do — one Bedrock call, no wait inserted.
   *
   * Driven as an Intentional_Refresh so the request always reaches generation; a
   * plain GET can be answered from a fresh cache entry without calling Bedrock at
   * all, which would make the call count say nothing about the retry policy.
   *
   * The cache dimension is there because the two retained states differ for the
   * request under test: "stale" leaves material the degraded response can draw
   * on, "empty" leaves none. Neither should change how often Bedrock is asked.
   */
  it("Feature: recommendations-backend-error-fix, Property 10: Fatal_Failure は再試行しない", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...FATAL_BEDROCK_FAILURES),
        fc.constantFrom<CachePreset>("empty", "stale"),
        async (failure, cache) => {
          // Per run, not per test: the cache, the in-flight map and the refresh
          // reservations live in module scope, and `delays` belongs to the module
          // instance, so only a fresh instance resets either.
          vi.useRealTimers();
          freezeWallClock();
          invokeClaude.mockReset();
          searchEhimePlace.mockReset();
          const { handler, delays } = await loadHandler();

          await primeCache(handler, cache);
          // Priming ran a clean generation, so it neither retried nor waited.
          // Asserting that rather than clearing the log keeps a harness fault
          // from being mistaken for the property holding.
          expect(delays).toEqual([]);
          // Its single Bedrock call is not part of the count under test.
          invokeClaude.mockReset();

          configureFatalBedrock(failure);
          // Nothing verifies; the response will be synthesised.
          configurePlaces([]);

          // Built after priming: ageing the cache can cross JST midnight, and the
          // handler only accepts today's date.
          const { res, recorded } = makeRes();
          await handler(makeRefreshReq(), res);

          // Requirements 5.4, 9.6
          expect(invokeClaude).toHaveBeenCalledTimes(1);
          expect(delays).toEqual([]);
          // Requirement 5.5: giving up early still owes the caller a selectable
          // response, so the early exit must not have become an error page.
          expect(recorded.status).toBe(200);
        },
      ),
    );
  });

  /**
   * The counterweight to the property above: without it, "one call and no wait"
   * would also pass on a handler that never retries anything.
   *
   * Throttling and a 5xx are the Retryable_Failures that keep failing, so they
   * exhaust the whole policy — three attempts with 300ms then 900ms between them.
   */
  it("retries a Retryable_Failure up to three times with the 300ms / 900ms backoff", async () => {
    for (const mode of ["http429", "http500"] as const) {
      vi.useRealTimers();
      freezeWallClock();
      invokeClaude.mockReset();
      searchEhimePlace.mockReset();
      const { handler, delays } = await loadHandler();

      configureBedrock(mode);
      configurePlaces([]);

      const { res, recorded } = makeRes();
      await handler(makeRefreshReq(), res);

      expect(invokeClaude, mode).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
      expect(delays, mode).toEqual(BACKOFF_DELAYS_MS);
      // Exhausting the retries is still a degraded 200, not an error page.
      expect(recorded.status, mode).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Refresh slot
// ---------------------------------------------------------------------------

/**
 * Refresh_Interval in seconds, restated for the same reason as
 * {@link PLAN_COUNT}. Keep in step with `REFRESH_INTERVAL_MS`.
 */
const REFRESH_INTERVAL_SECONDS = 60;
const REFRESH_INTERVAL_MS = REFRESH_INTERVAL_SECONDS * 1000;

let clientSeq = 0;

/**
 * A client address of its own for each scenario.
 *
 * `refreshAllowedAt` is keyed by `x-forwarded-for`, and although a fresh module
 * instance already empties it, a scenario that reserved a slot must not be able
 * to explain a 429 in the next one.
 */
function nextClientIp(): string {
  clientSeq += 1;
  return `198.51.100.${(clientSeq % 254) + 1}`;
}

/**
 * An Intentional_Refresh with `overrides` in place of the valid values, so a run
 * can aim at one specific rejection.
 *
 * `query` and `body` are separate because the handler cross-checks the two
 * copies of `schema` and `date`: overriding only one lands on the mismatch
 * check, overriding both lands on the value check.
 */
function makeRefreshReqWith(init: {
  ip: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}): VercelRequest {
  const query = baseQuery({ refresh: "1", ...init.query });
  return makeReq({
    method: "POST",
    query,
    ip: init.ip,
    body: {
      lang: "ja",
      count: PLAN_COUNT,
      schema: RECOMMENDATION_SCHEMA,
      date: query.date,
      exclude: [],
      ...init.body,
    },
  });
}

/**
 * Runs `run` against a handler whose Fallback_Plan_Pool is empty.
 *
 * The only way to reach the 502 of Requirement 1.6: with eight canned
 * itineraries in the pool, synthesis always reaches Plan_Count no matter what
 * fails. `doMock` rather than the hoisted `vi.mock` because emptying the pool
 * for the whole file would delete the very material every other test here
 * depends on, and `importActual` keeps the contract predicates real so a
 * response is still judged by the implementation the client runs.
 */
async function withEmptyFallbackPool<T>(run: (harness: Harness) => Promise<T>): Promise<T> {
  vi.doMock("./_recommendation-fallback.js", async () => {
    const actual = await vi.importActual<typeof import("./_recommendation-fallback.js")>(
      "./_recommendation-fallback.js",
    );
    return { ...actual, RECOMMENDATION_FALLBACK_PLANS: [] };
  });
  try {
    return await run(await loadHandler());
  } finally {
    vi.doUnmock("./_recommendation-fallback.js");
    // The next `loadHandler()` must not inherit the emptied pool.
    vi.resetModules();
  }
}

/**
 * The first request of a run, named by the response it draws. Only
 * `refreshAiOnly` is entitled to consume the caller's refresh slot.
 */
const SLOT_PROBE_KINDS = [
  "refreshAiOnly",
  "refreshDegraded",
  "getAiOnly",
  "badSchema",
  "badCount",
  "badDate",
  "badExclude",
  "methodNotAllowed",
  "gatewayError",
] as const;

type SlotProbeKind = (typeof SLOT_PROBE_KINDS)[number];

/**
 * The status each kind is named after. Asserted per run: a kind that quietly
 * drifted onto another path would otherwise keep passing while testing nothing.
 */
const SLOT_PROBE_FIRST_STATUS: Record<SlotProbeKind, number> = {
  refreshAiOnly: 200,
  refreshDegraded: 200,
  getAiOnly: 200,
  badSchema: 400,
  badCount: 400,
  badDate: 400,
  badExclude: 400,
  methodNotAllowed: 405,
  gatewayError: 502,
};

const SLOT_CONSUMING_KINDS = new Set<SlotProbeKind>(["refreshAiOnly"]);

/** Sends the first request of a run and returns what the handler answered. */
async function sendSlotProbeFirst(
  handler: Harness["handler"],
  kind: SlotProbeKind,
  ip: string,
): Promise<Recorded> {
  const { res, recorded } = makeRes();
  switch (kind) {
    case "refreshAiOnly":
      configureBedrock("ok");
      configurePlaces([0, 1, 2, 3, 4]);
      await handler(makeRefreshReq({ ip }), res);
      break;
    case "getAiOnly":
      // A Recovery_Retry: the same `ai`-only 200, but not an Intentional_Refresh.
      configureBedrock("ok");
      configurePlaces([0, 1, 2, 3, 4]);
      await handler(makeReq({ query: baseQuery(), ip }), res);
      break;
    case "refreshDegraded":
    case "gatewayError":
      // Nothing generates and nothing verifies. With the pool in place that is a
      // degraded 200; with the pool emptied there is nothing left to answer with
      // and it is the 502 of Requirement 1.6.
      configureBedrock("http500");
      configurePlaces([]);
      await handler(makeRefreshReq({ ip }), res);
      break;
    case "badSchema":
      await handler(makeRefreshReqWith({ ip, body: { schema: "itinerary-v0" } }), res);
      break;
    case "badCount":
      await handler(makeRefreshReqWith({ ip, body: { count: PLAN_COUNT - 1 } }), res);
      break;
    case "badDate":
      await handler(
        makeRefreshReqWith({
          ip,
          query: { date: "2001-01-01" },
          body: { date: "2001-01-01" },
        }),
        res,
      );
      break;
    case "badExclude":
      await handler(makeRefreshReqWith({ ip, body: { exclude: "宇和島" } }), res);
      break;
    case "methodNotAllowed":
      await handler(makeReq({ method: "PUT", query: baseQuery({ refresh: "1" }), ip }), res);
      break;
  }
  return recorded;
}

/**
 * Runs one first request, then a same-client Intentional_Refresh staged to be
 * answered `ai`-only 200 whenever the slot is free.
 *
 * The probe's status is the observable form of the claim: `refreshAllowedAt` is
 * module-private, so "the first request consumed the slot" is only visible as
 * the next refresh coming back 429 instead of 200.
 */
async function probeSlot(
  kind: SlotProbeKind,
): Promise<{ first: Recorded; probe: Recorded }> {
  vi.useRealTimers();
  freezeWallClock();
  invokeClaude.mockReset();
  searchEhimePlace.mockReset();
  const ip = nextClientIp();

  const run = async (harness: Harness): Promise<{ first: Recorded; probe: Recorded }> => {
    const first = await sendSlotProbeFirst(harness.handler, kind, ip);
    configureBedrock("ok");
    configurePlaces([0, 1, 2, 3, 4]);
    const probe = makeRes();
    await harness.handler(makeRefreshReq({ ip }), probe.res);
    return { first, probe: probe.recorded };
  };

  return kind === "gatewayError" ? withEmptyFallbackPool(run) : run(await loadHandler());
}

describe("api/recommendations refresh slot", () => {
  /**
   * The regression that made the original defect unrecoverable: deciding the
   * rate limit and reserving the slot used to be one call, so a failed fetch
   * bought the caller a 60 second block and the retry button answered 429.
   *
   * Every kind below is a response the handler can give an Intentional_Refresh
   * (plus a Recovery_Retry, which is not one), and only the `ai`-only 200 is
   * allowed to cost the caller their slot.
   */
  it("Feature: recommendations-backend-error-fix, Property 13: リフレッシュ枠は ai のみの 200 応答のときだけ消費される", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...SLOT_PROBE_KINDS), async (kind) => {
        const { first, probe } = await probeSlot(kind);

        expect(first.status, kind).toBe(SLOT_PROBE_FIRST_STATUS[kind]);
        if (first.status === 200) {
          expect(bodyOf(first).degraded, kind).toBe(kind === "refreshDegraded");
        }

        if (SLOT_CONSUMING_KINDS.has(kind)) {
          // Requirement 6.2
          expect(probe.status, kind).toBe(429);
          // Requirement 6.5
          const retryAfter = Number(probe.headers["retry-after"]);
          expect(Number.isInteger(retryAfter), kind).toBe(true);
          expect(retryAfter, kind).toBeGreaterThanOrEqual(1);
          expect(retryAfter, kind).toBeLessThanOrEqual(REFRESH_INTERVAL_SECONDS);
          return;
        }
        // Requirements 6.3, 6.4: whatever the first response was, the next
        // refresh still generates rather than being turned away.
        expect(probe.status, kind).toBe(200);
        expect(probe.headers["retry-after"], kind).toBeUndefined();
      }),
    );
  });

  // Requirement 9.3: the exact sequence the defect report described, minus the
  // 502 — a failed generation now answers 200, and the retry right behind it is
  // not rate limited.
  it("leaves the next refresh unblocked right after a degraded response", async () => {
    freezeWallClock();
    configureBedrock("http500");
    configurePlaces([]);

    const { handler } = await loadHandler();
    const ip = nextClientIp();

    const degraded = makeRes();
    await handler(makeRefreshReq({ ip }), degraded.res);
    expect(degraded.recorded.status).toBe(200);
    expect(bodyOf(degraded.recorded).degraded).toBe(true);

    const retry = makeRes();
    await handler(makeRefreshReq({ ip }), retry.res);

    expect(retry.recorded.status).not.toBe(429);
    expect(retry.recorded.status).toBe(200);
    expect(bodyOf(retry.recorded).plans).toHaveLength(PLAN_COUNT);
  });

  // Requirement 9.4
  it("blocks the next refresh for at most Refresh_Interval after an ai-only response", async () => {
    freezeWallClock();
    configureBedrock("ok");
    configurePlaces([0, 1, 2, 3, 4]);

    const { handler } = await loadHandler();
    const ip = nextClientIp();

    const reserving = makeRes();
    await handler(makeRefreshReq({ ip }), reserving.res);
    expect(reserving.recorded.status).toBe(200);
    expect(bodyOf(reserving.recorded).degraded).toBe(false);

    const blocked = makeRes();
    await handler(makeRefreshReq({ ip }), blocked.res);

    expect(blocked.recorded.status).toBe(429);
    // Requirement 6.5
    const retryAfter = Number(blocked.recorded.headers["retry-after"]);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(REFRESH_INTERVAL_SECONDS);
    expect(blocked.recorded.headers["cache-control"]).toBe("private, no-store");
    expect(blocked.recorded.body).toEqual({
      error: "Please wait before refreshing recommendations",
    });
  });

  /**
   * The 429 itself must stay a read.
   *
   * Reserving on the way out would let a caller who keeps pressing ↻ hold their
   * own slot open indefinitely, which is the same trap as the original defect
   * wearing a different hat. Visible only across the clock: the slot has to open
   * Refresh_Interval after the reply that took it, not after the last refusal.
   */
  it("leaves the reservation untouched when it answers 429", async () => {
    freezeWallClock();
    configureBedrock("ok");
    configurePlaces([0, 1, 2, 3, 4]);

    const { handler } = await loadHandler();
    const ip = nextClientIp();

    const reserving = makeRes();
    await handler(makeRefreshReq({ ip }), reserving.res);
    expect(reserving.recorded.status).toBe(200);

    advanceWallClock(REFRESH_INTERVAL_MS / 2);
    const blocked = makeRes();
    await handler(makeRefreshReq({ ip }), blocked.res);
    expect(blocked.recorded.status).toBe(429);
    expect(blocked.recorded.headers["retry-after"]).toBe("30");

    // Had the refusal renewed the reservation, the slot would stay shut until
    // 90s after the reply that took it. It is open at 61s.
    advanceWallClock(REFRESH_INTERVAL_MS / 2 + 1000);
    const allowed = makeRes();
    await handler(makeRefreshReq({ ip }), allowed.res);
    expect(allowed.recorded.status).toBe(200);
    expect(bodyOf(allowed.recorded).degraded).toBe(false);
  });
});
