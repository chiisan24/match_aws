// @vitest-environment node
/**
 * Guards the duplicated Itinerary_Contract and Fallback_Plan_Pool.
 *
 * `api/_recommendation-fallback.ts` carries its own copy of both because a
 * Vercel function bundle contains no compiled `src/`, and an unresolvable
 * `../src/**.js` specifier crashed the module before the handler could degrade
 * (HTTP 500 on every call). Two copies can drift, so this file pins them
 * together: the pools must be deep equal, the two `itineraryPlanViolations`
 * must agree on arbitrary input, and the api-side copy must stay importless.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  ITINERARY_PLAN_COUNT,
  isItineraryPlan,
  isTourismRecommendations,
  itineraryPlanViolations as apiViolations,
  RECOMMENDATION_FALLBACK_PLANS as API_FALLBACK_PLANS,
} from "./_recommendation-fallback.js";
import { itineraryPlanViolations as sourceViolations } from "../src/domain/itineraryContract.js";
import {
  RECOMMENDATION_FALLBACK_PLANS as SOURCE_FALLBACK_PLANS,
} from "../src/data/recommendationFallbackPlans.js";

/** Same normalization the handler compares titles with. */
function comparisonKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const KINDS = ["sightseeing", "food", "cafe", "custom"];

describe("api Fallback_Plan_Pool conforms to Itinerary_Contract", () => {
  it("holds more plans than Plan_Count so a top-up can always reach five", () => {
    expect(API_FALLBACK_PLANS.length).toBe(8);
    expect(API_FALLBACK_PLANS.length).toBeGreaterThan(ITINERARY_PLAN_COUNT);
  });

  it.each(API_FALLBACK_PLANS.map((plan) => [plan.id, plan] as const))(
    "%s satisfies the contract",
    (_id, plan) => {
      expect(apiViolations(plan)).toEqual([]);
      expect(isItineraryPlan(plan)).toBe(true);
      expect(plan.mode).toBe("tourism");
      expect(plan.stops.length).toBeGreaterThanOrEqual(2);
      expect(plan.stops.length).toBeLessThanOrEqual(4);

      plan.stops.forEach((stop, index) => {
        expect(stop.time).toMatch(TIME_PATTERN);
        if (index > 0) {
          expect(stop.time > plan.stops[index - 1].time).toBe(true);
        }
        expect(KINDS).toContain(stop.kind);
        expect(stop.title.trim()).not.toBe("");
        expect(Number.isFinite(stop.place?.location?.lat)).toBe(true);
        expect(Number.isFinite(stop.place?.location?.lng)).toBe(true);
      });
    },
  );

  it("keeps id, normalized title and first-stop place id unique across the pool", () => {
    const ids = API_FALLBACK_PLANS.map((plan) => plan.id);
    const titles = API_FALLBACK_PLANS.map((plan) => comparisonKey(plan.title));
    const placeIds = API_FALLBACK_PLANS.map((plan) => plan.stops[0]?.place?.id ?? "");

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(placeIds).size).toBe(placeIds.length);
    expect(placeIds).not.toContain("");
  });

  it("yields five conforming plans for any five it is asked for", () => {
    expect(isTourismRecommendations(API_FALLBACK_PLANS.slice(0, ITINERARY_PLAN_COUNT)))
      .toBe(true);
  });
});

describe("api and src copies do not drift", () => {
  it("exposes the same Fallback_Plan_Pool as src/data/recommendationFallbackPlans", () => {
    expect(API_FALLBACK_PLANS).toEqual(SOURCE_FALLBACK_PLANS);
  });

  it("agrees with src/domain/itineraryContract on the real pool", () => {
    for (const plan of SOURCE_FALLBACK_PLANS) {
      expect(apiViolations(plan)).toEqual(sourceViolations(plan));
      expect(apiViolations(plan)).toEqual([]);
    }
  });

  it("agrees with src/domain/itineraryContract on arbitrary plan-shaped input", () => {
    // Coordinates land on the finite / non-finite / absent branches the
    // location check distinguishes.
    const coordinate = fc.oneof(
      fc.double({ min: 32, max: 35, noNaN: true }),
      fc.constantFrom<unknown>(
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        "33.8",
        null,
        undefined,
      ),
    );
    const place = fc.oneof(
      fc.constant(undefined),
      fc.record({
        location: fc.oneof(
          fc.constant(undefined),
          fc.record({ lat: coordinate, lng: coordinate }),
        ),
      }),
    );
    // A near-miss `HH:MM` alphabet keeps the pattern and the strict-ascending
    // check both reachable instead of always failing on the format.
    const time = fc.oneof(
      fc.tuple(fc.integer({ min: 0, max: 25 }), fc.integer({ min: 0, max: 65 }))
        .map(([hour, minute]) =>
          `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`),
      fc.constantFrom<unknown>("", " 09:00", "9:00", "0900", 900, undefined),
    );
    const stop = fc.oneof(
      fc.constantFrom<unknown>(null, undefined, 0, "stop"),
      fc.record({
        time,
        kind: fc.constantFrom<unknown>(...KINDS, "onsen", "", 1, undefined),
        title: fc.oneof(fc.constantFrom("", "  ", "松山城"), fc.string()),
        place,
      }),
    );
    const plan = fc.oneof(
      fc.constantFrom<unknown>(null, undefined, 42, "plan", true, []),
      fc.record({
        mode: fc.constantFrom<unknown>("tourism", "pilgrimage", "", undefined),
        stops: fc.oneof(
          fc.constant<unknown>(undefined),
          fc.constant<unknown>("nope"),
          fc.array(stop, { maxLength: 6 }),
        ),
      }),
    );

    fc.assert(
      fc.property(plan, (value) => {
        expect(apiViolations(value)).toEqual(sourceViolations(value));
      }),
      { numRuns: 200 },
    );
  });
});

describe("api/_recommendation-fallback.ts stays inside api/", () => {
  it("imports nothing from ../src, which a Vercel bundle cannot resolve", () => {
    const source = readFileSync("api/_recommendation-fallback.ts", "utf8");
    // The regression that produced ERR_MODULE_NOT_FOUND in production.
    expect(source).not.toMatch(/from\s+["']\.\.\/src\//);
    expect(source).not.toMatch(/import\s*\(\s*["']\.\.\/src\//);
    // Any import at all, since only api/ files reach the function bundle.
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
