import { beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";

import { buildSpotFromInput, newSpotId } from "../../domain/spot";
import type { NewSpotInput, Spot } from "../../ports";
import { MockStorageAdapter } from "./storage";
import { MockSpotAdapter } from "./spot";
import { EHIME_SPOTS } from "./spots";

const CATEGORIES: Spot["category"][] = [
  "sightseeing",
  "food",
  "souvenir",
  "onsen",
];

const inputArb: fc.Arbitrary<NewSpotInput> = fc.record({
  name: fc.string({ minLength: 1 }).map((s) => `x${s}`), // ensure non-empty after trim
  category: fc.constantFrom(...CATEGORIES),
  location: fc.record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true }),
  }),
  descriptionJa: fc.option(fc.string(), { nil: undefined }),
  openingHours: fc.option(fc.string(), { nil: undefined }),
  website: fc.option(fc.string(), { nil: undefined }),
});

describe("buildSpotFromInput", () => {
  it("keeps the given id and category, and never invents reviews/images", () => {
    fc.assert(
      fc.property(inputArb, fc.string({ minLength: 1 }), (input, id) => {
        const spot = buildSpotFromInput(input, id);
        expect(spot.id).toBe(id);
        expect(spot.category).toBe(input.category);
        expect(spot.reviews).toEqual([]);
        expect(spot.imageUrls).toEqual([]);
        // Location is copied through unchanged.
        expect(spot.location).toEqual(input.location);
      }),
    );
  });

  it("only ever stores an http(s) website (or undefined)", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const spot = buildSpotFromInput(input, "id-1");
        if (spot.website !== undefined) {
          expect(/^https?:\/\//i.test(spot.website)).toBe(true);
        }
      }),
    );
  });

  it("always yields a non-empty Japanese description", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const spot = buildSpotFromInput(input, "id-1");
        expect((spot.localizedDescriptions.ja ?? "").length).toBeGreaterThan(0);
      }),
    );
  });

  it("drops a non-http website and falls back to a name-based description", () => {
    const spot = buildSpotFromInput(
      {
        name: "  道後温泉本館  ",
        category: "onsen",
        location: { lat: 33.85, lng: 132.79 },
        website: "javascript:alert(1)",
      },
      "id-x",
    );
    expect(spot.website).toBeUndefined();
    expect(spot.name).toBe("道後温泉本館");
    expect(spot.localizedDescriptions.ja).toContain("道後温泉本館");
  });

  it("keeps a valid https website and trimmed opening hours", () => {
    const spot = buildSpotFromInput(
      {
        name: "テスト",
        category: "food",
        location: { lat: 33.8, lng: 132.7 },
        website: "  https://example.com/shop  ",
        openingHours: "  9:00-17:00  ",
      },
      "id-y",
    );
    expect(spot.website).toBe("https://example.com/shop");
    expect(spot.openingHours).toBe("9:00-17:00");
  });
});

describe("newSpotId", () => {
  it("prefixes ids with 'user-' and returns unique values", () => {
    const a = newSpotId();
    const b = newSpotId();
    expect(a.startsWith("user-")).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("MockSpotAdapter", () => {
  beforeEach(() => {
    // Fresh persisted state for each test (adapter persists via StoragePort).
    globalThis.localStorage?.clear();
  });

  it("lists the real seed catalogue before anything is added", async () => {
    const adapter = new MockSpotAdapter(new MockStorageAdapter());
    const spots = await adapter.listSpots();
    expect(spots.length).toBe(EHIME_SPOTS.length);
  });

  it("adds a spot, returns it, and surfaces it first on the next list", async () => {
    const storage = new MockStorageAdapter();
    const adapter = new MockSpotAdapter(storage);

    const created = await adapter.addSpot({
      name: "追加スポット",
      category: "sightseeing",
      location: { lat: 33.84, lng: 132.77 },
    });
    expect(created.id.startsWith("user-")).toBe(true);

    const spots = await adapter.listSpots();
    expect(spots.length).toBe(EHIME_SPOTS.length + 1);
    expect(spots[0].id).toBe(created.id);
    expect(spots[0].name).toBe("追加スポット");
  });

  it("persists additions across adapter instances sharing storage", async () => {
    const storage = new MockStorageAdapter();
    await new MockSpotAdapter(storage).addSpot({
      name: "永続スポット",
      category: "food",
      location: { lat: 33.8, lng: 132.7 },
    });

    // A brand-new adapter over the same storage still sees the addition.
    const spots = await new MockSpotAdapter(storage).listSpots();
    expect(spots.some((s) => s.name === "永続スポット")).toBe(true);
  });
});
