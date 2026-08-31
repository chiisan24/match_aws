/**
 * Tests for the photo cache.
 *
 * The cache exists to make one billing guarantee true — a spot is looked up at
 * most once — so the claims that matter are about *never losing a key* and
 * *never growing without bound*. Both are stated as properties because the
 * failure they guard against only appears at a size no example would reach.
 *
 * The last section feeds it values from storage that a well-behaved app would
 * never write, because that is exactly what a stale build or a hand-edited
 * `localStorage` looks like (AC 7.9).
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  normalizePhotoCache,
  photoCacheGet,
  photoCacheHas,
  photoCachePut,
  PHOTO_CACHE_LIMIT,
  type PhotoCache,
  type PhotoCacheEntry,
} from "./photoCache";

/** An entry as the resolver builds it. */
const entryArb: fc.Arbitrary<PhotoCacheEntry> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  photoUrl: fc
    .string({ minLength: 1, maxLength: 10 })
    .map((name) => `/api/places/photo?name=${name}`),
  attributions: fc.array(
    fc.record({ displayName: fc.string({ minLength: 1, maxLength: 8 }) }),
    { maxLength: 2 },
  ),
});

/** Build `count` entries with distinct ids. */
function entries(count: number): PhotoCacheEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `spot-${index}`,
    photoUrl: `/api/places/photo?name=p${index}`,
    attributions: [],
  }));
}

describe("photoCachePut", () => {
  /**
   * Feature: swipe-discovery-game, Property 7: キャッシュは上限を超えない
   *
   * *For any* sequence of insertions, the cache never exceeds the cap and holds
   * no duplicate ids. Without the cap, a long-lived install would grow the
   * persisted value until `localStorage` started rejecting writes — at which
   * point every photo lookup would start being billed again.
   */
  it("Feature: swipe-discovery-game, Property 7: キャッシュは上限を超えない", () => {
    fc.assert(
      fc.property(fc.array(entryArb, { maxLength: 120 }), (inserted) => {
        let cache: PhotoCache = [];
        for (const entry of inserted) cache = photoCachePut(cache, entry);
        expect(cache.length).toBeLessThanOrEqual(PHOTO_CACHE_LIMIT);
        const ids = cache.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
      }),
    );
  });

  /**
   * Feature: swipe-discovery-game, Property 8: 直前に入れた項目は必ず引ける
   *
   * *For any* cache and entry, the entry is readable straight after insertion.
   * This is the property the "skip the API call" check depends on: if a freshly
   * cached spot could be missing, the very next render would pay for it again.
   */
  it("Feature: swipe-discovery-game, Property 8: 直前に入れた項目は必ず引ける", () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { maxLength: 40 }),
        entryArb,
        (existing, entry) => {
          let cache: PhotoCache = [];
          for (const item of existing) cache = photoCachePut(cache, item);
          cache = photoCachePut(cache, entry);
          expect(photoCacheHas(cache, entry.id)).toBe(true);
          expect(photoCacheGet(cache, entry.id)?.photoUrl).toBe(entry.photoUrl);
        },
      ),
    );
  });

  it("evicts the oldest entry once past the cap (AC 7.8)", () => {
    let cache: PhotoCache = [];
    for (const entry of entries(PHOTO_CACHE_LIMIT)) cache = photoCachePut(cache, entry);
    expect(cache).toHaveLength(PHOTO_CACHE_LIMIT);
    expect(photoCacheHas(cache, "spot-0")).toBe(true);

    cache = photoCachePut(cache, {
      id: "overflow",
      photoUrl: "/api/places/photo?name=overflow",
      attributions: [],
    });
    expect(cache).toHaveLength(PHOTO_CACHE_LIMIT);
    // The first one inserted is the one that leaves.
    expect(photoCacheHas(cache, "spot-0")).toBe(false);
    expect(photoCacheHas(cache, "overflow")).toBe(true);
  });

  it("replaces an existing id in place instead of appending", () => {
    let cache: PhotoCache = photoCachePut([], {
      id: "a",
      photoUrl: "/old",
      attributions: [],
    });
    cache = photoCachePut(cache, { id: "b", photoUrl: "/b", attributions: [] });
    cache = photoCachePut(cache, { id: "a", photoUrl: "/new", attributions: [] });

    expect(cache).toHaveLength(2);
    expect(cache.map((item) => item.id)).toEqual(["a", "b"]);
    expect(photoCacheGet(cache, "a")?.photoUrl).toBe("/new");
  });

  it("does not mutate the cache it was given", () => {
    const original: PhotoCache = [{ id: "a", photoUrl: "/a", attributions: [] }];
    photoCachePut(original, { id: "b", photoUrl: "/b", attributions: [] });
    expect(original).toHaveLength(1);
  });
});

describe("normalizePhotoCache", () => {
  it("yields an empty cache for anything that is not an array (AC 7.9)", () => {
    for (const value of [null, undefined, 0, "[]", {}, true]) {
      expect(normalizePhotoCache(value)).toEqual([]);
    }
  });

  it("drops unusable entries but keeps the usable ones", () => {
    const restored = normalizePhotoCache([
      { id: "ok", photoUrl: "/api/places/photo?name=x", attributions: [] },
      null,
      "nope",
      { id: "", photoUrl: "/y", attributions: [] },
      { id: "no-url", attributions: [] },
      { id: "ok", photoUrl: "/duplicate", attributions: [] },
    ]);
    expect(restored.map((item) => item.id)).toEqual(["ok"]);
    expect(restored[0]?.photoUrl).toBe("/api/places/photo?name=x");
  });

  it("keeps only well-formed attributions and defaults the rest to empty", () => {
    const restored = normalizePhotoCache([
      {
        id: "a",
        photoUrl: "/a",
        attributions: [{ displayName: "Taro" }, { uri: "https://x" }, null],
      },
      { id: "b", photoUrl: "/b", attributions: "not an array" },
    ]);
    expect(restored[0]?.attributions).toEqual([{ displayName: "Taro" }]);
    expect(restored[1]?.attributions).toEqual([]);
  });

  it("truncates a value larger than the cap", () => {
    const oversized = entries(PHOTO_CACHE_LIMIT + 25);
    expect(normalizePhotoCache(oversized)).toHaveLength(PHOTO_CACHE_LIMIT);
  });

  /**
   * Feature: swipe-discovery-game, Property 9: 保存と復元は往復する
   *
   * *For any* cache built through the public API, a JSON round trip returns the
   * same entries in the same order. The cache is persisted as JSON, so anything
   * the serialiser mangles would silently cost real API calls on the next visit.
   */
  it("Feature: swipe-discovery-game, Property 9: 保存と復元は往復する", () => {
    fc.assert(
      fc.property(fc.array(entryArb, { maxLength: 30 }), (inserted) => {
        let cache: PhotoCache = [];
        for (const entry of inserted) cache = photoCachePut(cache, entry);
        const restored = normalizePhotoCache(JSON.parse(JSON.stringify(cache)));
        expect(restored).toEqual(cache);
      }),
    );
  });
});
