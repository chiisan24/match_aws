/**
 * Tests for the しおり's saved-itinerary projection.
 *
 * The projection is the only thing standing between "the route builder produced
 * a schedule" and "the しおり can still show that schedule tomorrow", so the
 * claims here are about **not losing the schedule**: every stop survives, the
 * order survives, and the map pins keep the numbering the timeline shows.
 *
 * The guard (`isSavedItinerary`) gets the hostile inputs, because the value it
 * inspects comes back out of `localStorage` where an older build, a truncated
 * write or a hand edit are all possible.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  isSavedItinerary,
  itineraryMapItems,
  itinerarySummary,
  savedItineraryFromPlan,
} from "./savedItinerary";
import type { RecommendedPlan, RecommendedPlanStop } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KINDS: RecommendedPlanStop["kind"][] = [
  "sightseeing",
  "food",
  "cafe",
  "custom",
];

/** `HH:MM`, drawn across the whole day so the pattern check is exercised. */
const timeArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

/**
 * A stop that may or may not carry a place, and whose place may or may not carry
 * coordinates — the three shapes the AI backend actually returns.
 */
const stopArb: fc.Arbitrary<RecommendedPlanStop> = fc
  .record({
    time: timeArb,
    kind: fc.constantFrom(...KINDS),
    title: fc.string({ minLength: 1, maxLength: 20 }),
    description: fc.string({ maxLength: 30 }),
    searchQuery: fc.string({ minLength: 1, maxLength: 20 }),
    location: fc.option(
      fc.record({
        lat: fc.double({ min: 32, max: 35, noNaN: true }),
        lng: fc.double({ min: 131, max: 135, noNaN: true }),
      }),
      { nil: undefined },
    ),
  })
  .map(({ location, ...rest }) => ({
    ...rest,
    ...(location
      ? {
        place: {
          id: `place-${rest.searchQuery}`,
          name: rest.title,
          formattedAddress: "愛媛県",
          location,
        },
      }
      : {}),
  }));

const planArb: fc.Arbitrary<RecommendedPlan> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  mode: fc.constant("tourism" as const),
  icon: fc.constant("🗺️"),
  title: fc.string({ minLength: 1, maxLength: 24 }),
  summary: fc.string({ maxLength: 40 }),
  reason: fc.string({ maxLength: 40 }),
  duration: fc.string({ maxLength: 12 }),
  transport: fc.string({ maxLength: 12 }),
  intensity: fc.string({ maxLength: 12 }),
  stops: fc.array(stopArb, { maxLength: 8 }),
});

const SAVED_AT = "2026-08-31T04:05:06.000Z";

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

describe("savedItineraryFromPlan", () => {
  /**
   * Feature: itinerary-save, Property 1: 射影は立寄先の件数と順序を保つ
   *
   * *For any* plan, the saved itinerary holds the same number of stops, in the
   * same order, with the same times and titles. The order *is* the schedule, so
   * a projection that re-sorted or dropped a stop would quietly rewrite the trip.
   */
  it("Feature: itinerary-save, Property 1: 射影は立寄先の件数と順序を保つ", () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        const saved = savedItineraryFromPlan(plan, SAVED_AT);
        expect(saved.stops).toHaveLength(plan.stops.length);
        expect(saved.stops.map((s) => s.time)).toEqual(plan.stops.map((s) => s.time));
        expect(saved.stops.map((s) => s.title)).toEqual(plan.stops.map((s) => s.title));
        expect(saved.id).toBe(plan.id);
        expect(saved.savedAt).toBe(SAVED_AT);
      }),
    );
  });

  /**
   * Feature: itinerary-save, Property 2: 座標は元プランと共有されない
   *
   * *For any* plan, a stop's saved coordinates are a copy, and a stop with no
   * usable coordinates carries no `location` at all. The copy matters because the
   * live plan stays mutable in memory while the saved one is meant to be a
   * snapshot; the omission matters because the map filters on presence.
   */
  it("Feature: itinerary-save, Property 2: 座標は元プランと共有されない", () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        const saved = savedItineraryFromPlan(plan, SAVED_AT);
        saved.stops.forEach((stop, index) => {
          const source = plan.stops[index]?.place?.location;
          if (source) {
            expect(stop.location).toEqual(source);
            expect(stop.location).not.toBe(source);
          } else {
            expect(stop.location).toBeUndefined();
          }
        });
      }),
    );
  });

  it("omits the area when the plan had none", () => {
    const plan = { ...basePlan(), stops: [] };
    expect("area" in savedItineraryFromPlan(plan, SAVED_AT)).toBe(false);
  });

  it("keeps the area when the plan carried one", () => {
    const area = { center: { lat: 33.84, lng: 132.76 }, radiusMeters: 5000 };
    const saved = savedItineraryFromPlan({ ...basePlan(), area, stops: [] }, SAVED_AT);
    expect(saved.area).toEqual(area);
  });
});

// ---------------------------------------------------------------------------
// Map pins
// ---------------------------------------------------------------------------

describe("itineraryMapItems", () => {
  /**
   * Feature: itinerary-save, Property 3: ピンの番号は行程上の位置と一致する
   *
   * *For any* plan, each pin's `order` equals its 1-based position in the
   * itinerary — not its position among the pins. This is what lets the user match
   * a numbered pin to a numbered timeline row when a stop in between has no
   * coordinates and therefore no pin.
   */
  it("Feature: itinerary-save, Property 3: ピンの番号は行程上の位置と一致する", () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        const saved = savedItineraryFromPlan(plan, SAVED_AT);
        const items = itineraryMapItems(saved);
        // Only located stops become pins.
        const located = saved.stops.filter((s) => s.location != null).length;
        expect(items).toHaveLength(located);
        for (const item of items) {
          const stop = saved.stops[item.order - 1];
          expect(stop).toBeDefined();
          expect(item.label).toBe(stop?.title);
          expect(item.location).toEqual(stop?.location);
        }
      }),
    );
  });

  it("skips a stop with no coordinates but keeps the later numbering", () => {
    const saved = savedItineraryFromPlan(
      {
        ...basePlan(),
        stops: [
          stopWith("09:00", "松山城", { lat: 33.8457, lng: 132.7657 }),
          stopWith("11:00", "座標なしの店", undefined),
          stopWith("13:00", "道後温泉", { lat: 33.8521, lng: 132.7864 }),
        ],
      },
      SAVED_AT,
    );
    const items = itineraryMapItems(saved);
    expect(items.map((item) => item.order)).toEqual([1, 3]);
    expect(items.map((item) => item.label)).toEqual(["松山城", "道後温泉"]);
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

describe("itinerarySummary", () => {
  it("reports the first and last valid times in itinerary order", () => {
    const saved = savedItineraryFromPlan(
      {
        ...basePlan(),
        stops: [
          stopWith("09:30", "朝", { lat: 33.84, lng: 132.76 }),
          stopWith("12:00", "昼", { lat: 33.84, lng: 132.76 }),
          stopWith("16:45", "夕", { lat: 33.84, lng: 132.76 }),
        ],
      },
      SAVED_AT,
    );
    expect(itinerarySummary(saved)).toEqual({
      stopCount: 3,
      startTime: "09:30",
      endTime: "16:45",
    });
  });

  it("does not sort — a plan whose times descend is reported as authored", () => {
    // The AI is contractually ascending, but the summary must not silently
    // "fix" a plan that is not: doing so would show a span the plan never had.
    const saved = savedItineraryFromPlan(
      {
        ...basePlan(),
        stops: [
          stopWith("16:00", "あと", undefined),
          stopWith("09:00", "さき", undefined),
        ],
      },
      SAVED_AT,
    );
    expect(itinerarySummary(saved)).toMatchObject({
      startTime: "16:00",
      endTime: "09:00",
    });
  });

  it("ignores malformed times and reports null when none are usable", () => {
    const saved = savedItineraryFromPlan(
      {
        ...basePlan(),
        stops: [
          { ...stopWith("09:00", "ok", undefined), time: "9:00" },
          { ...stopWith("10:00", "bad", undefined), time: "25:61" },
        ],
      },
      SAVED_AT,
    );
    expect(itinerarySummary(saved)).toEqual({
      stopCount: 2,
      startTime: null,
      endTime: null,
    });
  });

  it("uses the single timed stop as both ends", () => {
    const saved = savedItineraryFromPlan(
      { ...basePlan(), stops: [stopWith("10:15", "一件", undefined)] },
      SAVED_AT,
    );
    expect(itinerarySummary(saved)).toEqual({
      stopCount: 1,
      startTime: "10:15",
      endTime: "10:15",
    });
  });
});

// ---------------------------------------------------------------------------
// Storage guard
// ---------------------------------------------------------------------------

describe("isSavedItinerary", () => {
  it("accepts what the projection produces", () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        expect(isSavedItinerary(savedItineraryFromPlan(plan, SAVED_AT))).toBe(true);
      }),
    );
  });

  it("rejects values a stale or edited storage entry could hold", () => {
    const cases: unknown[] = [
      null,
      undefined,
      42,
      "itinerary",
      [],
      {},
      { id: "a", title: "t", savedAt: SAVED_AT },
      { id: "a", title: "t", savedAt: SAVED_AT, stops: "none" },
      { id: "a", title: "t", stops: [] },
      { id: 1, title: "t", savedAt: SAVED_AT, stops: [] },
      // A stop missing the two fields the timeline renders.
      { id: "a", title: "t", savedAt: SAVED_AT, stops: [{ title: "x" }] },
      { id: "a", title: "t", savedAt: SAVED_AT, stops: [{ time: "09:00" }] },
    ];
    for (const value of cases) {
      expect(isSavedItinerary(value)).toBe(false);
    }
  });

  it("accepts an itinerary with no stops at all", () => {
    expect(
      isSavedItinerary({ id: "a", title: "t", savedAt: SAVED_AT, stops: [] }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basePlan(): RecommendedPlan {
  return {
    id: "plan-1",
    mode: "tourism",
    icon: "🗺️",
    title: "松山まちあるき",
    summary: "城下町をゆっくり",
    reason: "歩きやすいから",
    duration: "約6時間",
    transport: "路面電車＋徒歩",
    intensity: "ゆったり",
    stops: [],
  };
}

function stopWith(
  time: string,
  title: string,
  location: { lat: number; lng: number } | undefined,
): RecommendedPlanStop {
  return {
    time,
    kind: "sightseeing",
    title,
    description: "",
    searchQuery: title,
    ...(location
      ? {
        place: {
          id: `place-${title}`,
          name: title,
          formattedAddress: "愛媛県",
          location,
        },
      }
      : {}),
  };
}
