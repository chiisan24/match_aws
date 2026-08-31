/**
 * Tests for {@link ./googleMapsUrl}.
 *
 * This module carries more weight than its size suggests. The app stopped
 * requesting ratings, opening hours and phone numbers from Places (they are
 * Enterprise-tier fields), so these links are now the *only* way a user reaches
 * that detail. A link that fails to build, or builds to the wrong place, removes
 * information rather than relocating it.
 */

import { describe, expect, it } from "vitest";

import {
  googleMapsUrl,
  googleMapsUrlForPlaceId,
  googleMapsUrlForQuery,
} from "./googleMapsUrl";

const PLACE_ID = "ChIJ8cM8zdaoQjQRDdCiAvMTMFg";

describe("googleMapsUrlForPlaceId", () => {
  // The documented `?q=place_id:<id>` shape, byte for byte. Place IDs are
  // alphanumeric plus `-` and `_`, so encoding is a no-op on real input — this
  // pins the format rather than the encoder.
  it("builds the documented place_id form", () => {
    expect(googleMapsUrlForPlaceId(PLACE_ID)).toBe(
      `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`,
    );
  });

  // Nothing to point at is not a link. Returning `undefined` lets callers omit
  // the anchor instead of rendering one that goes nowhere.
  it.each(["", "   "])("returns undefined for blank input (%p)", (value) => {
    expect(googleMapsUrlForPlaceId(value)).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(googleMapsUrlForPlaceId(`  ${PLACE_ID}  `)).toBe(
      `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`,
    );
  });

  // Place IDs reach this function from `localStorage`, which the user can edit.
  // A tampered value must not be able to append its own query parameters.
  it("encodes characters that would otherwise alter the query", () => {
    const url = googleMapsUrlForPlaceId("abc&hl=xx#frag");
    expect(url).toBe("https://www.google.com/maps/place/?q=place_id:abc%26hl%3Dxx%23frag");
    expect(new URL(url as string).searchParams.get("q")).toBe("place_id:abc&hl=xx#frag");
  });
});

describe("googleMapsUrlForQuery", () => {
  it("builds a search URL with the query encoded", () => {
    expect(googleMapsUrlForQuery("道後温泉本館 愛媛県")).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E9%81%93%E5%BE%8C%E6%B8%A9%E6%B3%89%E6%9C%AC%E9%A4%A8%20%E6%84%9B%E5%AA%9B%E7%9C%8C",
    );
  });

  it.each(["", "   "])("returns undefined for blank input (%p)", (value) => {
    expect(googleMapsUrlForQuery(value)).toBeUndefined();
  });
});

describe("googleMapsUrl", () => {
  // Google's own URL is the most accurate answer, so it wins whenever present.
  it("prefers googleMapsUri over everything else", () => {
    expect(
      googleMapsUrl({
        googleMapsUri: "https://maps.google.com/?cid=123",
        placeId: PLACE_ID,
        searchQuery: "道後温泉",
      }),
    ).toBe("https://maps.google.com/?cid=123");
  });

  // The Place ID path is the one that costs nothing: it needs no API call, only
  // a value the app already stored.
  it("falls back to the Place ID when no URI is available", () => {
    expect(googleMapsUrl({ placeId: PLACE_ID, searchQuery: "道後温泉" })).toBe(
      `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`,
    );
  });

  // Last resort for catalogue-only spots that were never resolved through Places.
  it("falls back to a name search when there is no URI and no Place ID", () => {
    expect(googleMapsUrl({ searchQuery: "内子座 愛媛県" })).toBe(
      googleMapsUrlForQuery("内子座 愛媛県"),
    );
  });

  it("returns undefined when there is nothing to build from", () => {
    expect(googleMapsUrl({})).toBeUndefined();
    expect(googleMapsUrl({ googleMapsUri: "", placeId: "", searchQuery: "" })).toBeUndefined();
  });

  // These strings end up in an `href`. `googleMapsUri` arrives over the network
  // and the Place ID out of `localStorage`, so a pseudo-scheme must not survive
  // to become a link target.
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "not a url at all",
  ])("rejects %p as a googleMapsUri", (uri) => {
    expect(googleMapsUrl({ googleMapsUri: uri, placeId: PLACE_ID })).toBe(
      `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`,
    );
  });

  // Rejecting an unsafe URI must not take the whole link down when there is a
  // safe way to build one.
  it("falls through to a search when the URI is unsafe and no Place ID exists", () => {
    expect(
      googleMapsUrl({ googleMapsUri: "javascript:alert(1)", searchQuery: "松山城" }),
    ).toBe(googleMapsUrlForQuery("松山城"));
  });

  it("accepts plain http as well as https", () => {
    expect(googleMapsUrl({ googleMapsUri: "http://maps.google.com/?cid=1" })).toBe(
      "http://maps.google.com/?cid=1",
    );
  });
});
