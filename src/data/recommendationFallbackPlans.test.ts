import { describe, expect, it } from "vitest";

import {
  ITINERARY_KINDS,
  ITINERARY_PLAN_COUNT,
  ITINERARY_TIME_PATTERN,
  itineraryPlanViolations,
} from "../domain/itineraryContract";
import { RECOMMENDATION_FALLBACK_PLANS } from "./recommendationFallbackPlans";

/** Stocked fallback itineraries: more than Plan_Count so collisions cannot starve the pool. */
const FALLBACK_PLAN_STOCK = 8;

/**
 * Mirrors `comparisonKey` in `api/recommendations.ts` (NFKC, lower case, then
 * whitespace / punctuation / symbol removal).
 *
 * `api/` modules are outside this test's reach, so the rule is restated instead
 * of imported. Keep the two in step when either changes.
 */
function comparisonKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

describe("RECOMMENDATION_FALLBACK_PLANS", () => {
  it("stocks more plans than Plan_Count requires", () => {
    expect(RECOMMENDATION_FALLBACK_PLANS).toHaveLength(FALLBACK_PLAN_STOCK);
    expect(RECOMMENDATION_FALLBACK_PLANS.length).toBeGreaterThan(ITINERARY_PLAN_COUNT);
  });

  // Feature: recommendations-backend-error-fix, Property 7: Fallback_Plan_Pool の全プランが契約を満たす
  // Validates: Requirements 2.3, 2.8
  //
  // The pool is finite (8 plans), so this walks every element instead of
  // sampling: an exhaustive check is strictly stronger than a random one here.
  it("Feature: recommendations-backend-error-fix, Property 7: Fallback_Plan_Pool の全プランが契約を満たす", () => {
    expect(RECOMMENDATION_FALLBACK_PLANS.length).toBeGreaterThan(0);

    RECOMMENDATION_FALLBACK_PLANS.forEach((plan) => {
      // The contract as a whole, reported per plan id so a failure names the culprit.
      expect({ id: plan.id, violations: itineraryPlanViolations(plan) }).toEqual({
        id: plan.id,
        violations: [],
      });
      expect(plan.mode).toBe("tourism");

      // Stop count: 2..4 inclusive.
      expect(plan.stops.length).toBeGreaterThanOrEqual(2);
      expect(plan.stops.length).toBeLessThanOrEqual(4);

      let previousTime = "";
      plan.stops.forEach((stop, index) => {
        const where = `${plan.id}.stop[${index}]`;

        // 24-hour HH:MM, strictly ascending. Zero-padded HH:MM compares
        // lexicographically in clock order, so `>` is a strict time comparison.
        expect({ where, time: ITINERARY_TIME_PATTERN.test(stop.time) }).toEqual({
          where,
          time: true,
        });
        expect({ where, ascending: stop.time > previousTime }).toEqual({
          where,
          ascending: true,
        });
        previousTime = stop.time;

        // One of the four accepted kinds.
        expect({ where, kind: ITINERARY_KINDS.has(stop.kind) }).toEqual({ where, kind: true });

        // Finite coordinates (a missing place or location fails here).
        expect({
          where,
          lat: Number.isFinite(stop.place?.location?.lat),
          lng: Number.isFinite(stop.place?.location?.lng),
        }).toEqual({ where, lat: true, lng: true });
      });
    });
  });

  it("keeps ids, normalized titles and leading place ids distinct across the pool", () => {
    const ids = RECOMMENDATION_FALLBACK_PLANS.map((plan) => plan.id);
    const titles = RECOMMENDATION_FALLBACK_PLANS.map((plan) => comparisonKey(plan.title));
    const leadingPlaceIds = RECOMMENDATION_FALLBACK_PLANS.map(
      (plan) => plan.stops[0]?.place?.id ?? "",
    );

    // No empty keys: an empty key would collide with itself and mask duplicates.
    expect(titles.filter((title) => title === "")).toEqual([]);
    expect(leadingPlaceIds.filter((placeId) => placeId === "")).toEqual([]);

    expect([...new Set(ids)]).toHaveLength(ids.length);
    expect([...new Set(titles)]).toHaveLength(titles.length);
    expect([...new Set(leadingPlaceIds)]).toHaveLength(leadingPlaceIds.length);
  });
});
