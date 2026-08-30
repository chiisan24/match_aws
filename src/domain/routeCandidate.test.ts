/**
 * Property tests for the pure Route_Candidate -> Spot conversion in
 * `./routeCandidate`. fast-check only — no React, no DOM.
 *
 * The shared fixtures (`LANGS`, `candidateArb`, `spotArb`) sit at the top of the
 * file so every property here draws from the same input space. Each optional
 * place field is generated as "present or absent" via `fc.option`, so one
 * property run covers both branches of every conditional spread in the
 * conversion.
 *
 * Two example-based tests sit alongside the properties, both about the
 * `openingHours` fold: the properties describe what the result has to contain,
 * the examples fix the exact string it comes out as.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  appendUniqueById,
  spotFromRouteCandidate,
  spotsFromRouteCandidates,
} from "./routeCandidate";
import type { LangCode, RouteCandidate, RouteCandidateKind, Spot } from "./types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const KINDS: RouteCandidateKind[] = ["sightseeing", "food", "cafe", "custom"];

/** A spread of display languages: two scripts, one non-Latin locale, one dialect. */
const LANGS: LangCode[] = ["ja", "en", "ko", "iyo"];

/** Google place ids are opaque; the prefix only makes failures readable. */
const placeIdArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1 })
  .map((suffix) => `place-${suffix}`);

/**
 * One `regularOpeningHours` line. Empty and whitespace-only entries are drawn
 * deliberately: they are exactly what the conversion drops, and `fc.string()`
 * alone rarely lands on them, so the "nothing usable" branch would otherwise go
 * untested. The padded entry exercises the trim.
 */
const openingHoursLineArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom("", "   ", "\t\n", "月: 9:00–17:00", "火: 定休", "  水: 10:00–18:00  "),
  fc.string(),
);

const candidateArb: fc.Arbitrary<RouteCandidate> = fc.record({
  id: fc.string({ minLength: 1 }),
  kind: fc.constantFrom(...KINDS),
  title: fc.string(),
  description: fc.string(),
  searchQuery: fc.string(),
  place: fc.record({
    id: placeIdArb,
    name: fc.string(),
    formattedAddress: fc.string(),
    location: fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    }),
    // Present / absent in one arbitrary, so both branches get exercised.
    photoUrl: fc.option(fc.webUrl(), { nil: undefined }),
    websiteUri: fc.option(fc.webUrl(), { nil: undefined }),
    regularOpeningHours: fc.option(fc.array(openingHoursLineArb), { nil: undefined }),
  }),
});

/**
 * The kind -> category table (AC 1.5), restated here rather than imported: a
 * test that reads the implementation's own table would pass whatever the table
 * said.
 */
const EXPECTED_CATEGORY: Record<RouteCandidateKind, Spot["category"]> = {
  sightseeing: "sightseeing",
  food: "food",
  cafe: "food",
  custom: "sightseeing",
};

/** Re-point a generated candidate at a specific Google place (AC 1.14). */
function withPlaceId(candidate: RouteCandidate, placeId: string): RouteCandidate {
  return { ...candidate, place: { ...candidate.place, id: placeId } };
}

/**
 * Ids for `spotArb`, drawn from a pool small enough that generated collections
 * actually overlap. With `placeIdArb`-style ids a collision between the existing
 * collection and the additions would essentially never be generated, and every
 * claim the merge properties make about skipped duplicates would hold vacuously.
 */
const SPOT_ID_POOL = ["place-a", "place-b", "place-c", "place-d"] as const;

const SPOT_CATEGORIES: Spot["category"][] = ["sightseeing", "food", "souvenir", "onsen"];

/**
 * A `Spot` as the favorites / shiori collections hold them. `appendUniqueById`
 * only ever reads `id`, but `name` carries a nonce so that two spots sharing an
 * id stay distinguishable — that is what lets a property pin down *which* of
 * several same-id additions survives.
 */
const spotArb: fc.Arbitrary<Spot> = fc
  .record({
    id: fc.constantFrom(...SPOT_ID_POOL),
    nonce: fc.integer({ min: 0, max: 99 }),
    category: fc.constantFrom(...SPOT_CATEGORIES),
    location: fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    }),
  })
  .map(({ id, nonce, category, location }) => ({
    id,
    name: `${id}#${nonce}`,
    category,
    location,
    localizedDescriptions: { ja: `desc-${nonce}` },
    reviews: [],
    imageUrls: [],
  }));

// ---------------------------------------------------------------------------
// spotFromRouteCandidate — required fields
// ---------------------------------------------------------------------------

describe("spotFromRouteCandidate", () => {
  // Feature: swipe-favorites-itinerary, Property 1: 変換は必須フィールドを一意に決める
  // Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.12, 1.14
  //
  // One candidate in, one spot out, with every required field decided by a fixed
  // rule. The second candidate and the shared place id cover AC 1.14: candidates
  // that resolved to the same Google place must produce the same spot id, which
  // is what lets the favorites / shiori merge de-duplicate by id.
  it("Feature: swipe-favorites-itinerary, Property 1: 変換は必須フィールドを一意に決める", () => {
    fc.assert(
      fc.property(
        candidateArb,
        candidateArb,
        placeIdArb,
        fc.constantFrom(...LANGS),
        (candidate, other, sharedPlaceId, lang) => {
          const spot = spotFromRouteCandidate(candidate, lang);

          expect(spot.id).toBe(candidate.place.id); // AC 1.2
          expect(spot.name).toBe(candidate.title); // AC 1.3
          expect(spot.location).toEqual(candidate.place.location); // AC 1.4
          expect(spot.category).toBe(EXPECTED_CATEGORY[candidate.kind]); // AC 1.5

          // AC 1.6: the description lands under the display language, and under
          // no other key — a second key would be a language the user never chose.
          expect(Object.keys(spot.localizedDescriptions)).toEqual([lang]);
          expect(spot.localizedDescriptions[lang]).toBe(candidate.description);

          expect(spot.reviews).toEqual([]); // AC 1.7

          // AC 1.12: the key must be absent, not present-and-undefined. Asserting
          // `toBeUndefined()` would pass either way and so would not pin the
          // conditional-spread intent.
          expect("popularityRank" in spot).toBe(false);

          // AC 1.14
          const first = spotFromRouteCandidate(withPlaceId(candidate, sharedPlaceId), lang);
          const second = spotFromRouteCandidate(withPlaceId(other, sharedPlaceId), lang);
          expect(first.id).toBe(sharedPlaceId);
          expect(second.id).toBe(first.id);
        },
      ),
    );
  });

  // Feature: swipe-favorites-itinerary, Property 2: 任意フィールドの有無が入力の有無に一致する
  // Validates: Requirements 1.8, 1.9, 1.10, 1.11
  //
  // The optional half of the spot follows what the candidate actually carries:
  // nothing is invented for a missing source, nothing usable is dropped from a
  // present one. `openingHours` is pinned by content rather than by format —
  // every usable line has to survive into the result and a set with nothing
  // usable has to leave the field absent. The separator itself is fixed by an
  // example-based test instead, so changing it stays a one-line decision.
  it("Feature: swipe-favorites-itinerary, Property 2: 任意フィールドの有無が入力の有無に一致する", () => {
    fc.assert(
      fc.property(candidateArb, fc.constantFrom(...LANGS), (candidate, lang) => {
        const { place } = candidate;
        const spot = spotFromRouteCandidate(candidate, lang);

        // AC 1.8 / 1.9: a photo becomes a one-element list, no photo an empty
        // one. `imageUrls` is always present — `Spot` declares it non-optional,
        // and the downstream thumbnails branch on emptiness, not on absence.
        if (place.photoUrl === undefined) {
          expect(spot.imageUrls).toEqual([]);
        } else {
          expect(spot.imageUrls).toEqual([place.photoUrl]);
        }

        // AC 1.11: the website is copied through verbatim, or the key is absent.
        // `in` rather than `toBeUndefined()` — the latter passes for a key that
        // is present and explicitly `undefined`, which is what the conditional
        // spread exists to avoid.
        if (place.websiteUri === undefined) {
          expect("website" in spot).toBe(false);
        } else {
          expect(spot.website).toBe(place.websiteUri);
        }

        // AC 1.10: usable lines are the trimmed, non-blank ones. Missing hours,
        // an empty list and a list of nothing but blanks all collapse to the
        // same "no usable content" case.
        const usableLines = (place.regularOpeningHours ?? [])
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (usableLines.length === 0) {
          expect("openingHours" in spot).toBe(false);
        } else {
          expect(typeof spot.openingHours).toBe("string");
          expect(spot.openingHours).not.toBe("");
          for (const line of usableLines) {
            expect(spot.openingHours).toContain(line);
          }
        }
      }),
    );
  });

  // Feature: swipe-favorites-itinerary, Property 3: 変換は決定的で入力を変更しない
  // Validates: Requirements 1.13
  //
  // Three claims about what the conversion must *not* do, all of which the
  // callers rely on. Determinism: the route builder converts the same candidate
  // once for favorites and again for the shiori, so the two spots have to agree
  // or the id-based merge would treat them as one entry with the wrong content.
  // Non-mutation: the deck keeps holding the candidate after conversion, so a
  // write-through here would corrupt the card the user is still looking at.
  // Reference separation: `location` has to be a fresh object, otherwise a spot
  // stored in favorites and the candidate still on screen would share coordinates
  // and either side's edit would leak into the other.
  it("Feature: swipe-favorites-itinerary, Property 3: 変換は決定的で入力を変更しない", () => {
    fc.assert(
      fc.property(candidateArb, fc.constantFrom(...LANGS), (candidate, lang) => {
        // `structuredClone` preserves keys whose value is `undefined`, which is
        // exactly what `candidateArb` produces for every absent optional field.
        // A JSON round-trip would drop them and weaken the comparison below.
        const before = structuredClone(candidate);

        const first = spotFromRouteCandidate(candidate, lang);
        const second = spotFromRouteCandidate(candidate, lang);

        // Determinism. `toStrictEqual` rather than `toEqual` so that a
        // conversion emitting `openingHours: undefined` on one call and omitting
        // the key on the other would fail instead of comparing equal.
        expect(second).toStrictEqual(first);

        // AC 1.13: the candidate is left exactly as it arrived.
        expect(candidate).toStrictEqual(before);

        // Reference separation: equal in content, distinct as objects — on every
        // call, not just the first.
        expect(first.location).toEqual(candidate.place.location);
        expect(first.location).not.toBe(candidate.place.location);
        expect(second.location).not.toBe(first.location);
      }),
    );
  });

  /**
   * A candidate whose only field of interest is `regularOpeningHours`. The
   * examples below are about the fold alone, so everything else is held fixed
   * rather than generated.
   */
  function candidateWithOpeningHours(regularOpeningHours: string[]): RouteCandidate {
    return {
      id: "candidate-dogo",
      kind: "sightseeing",
      title: "道後温泉本館",
      description: "",
      searchQuery: "道後温泉本館",
      place: {
        id: "place-dogo",
        name: "道後温泉本館",
        formattedAddress: "愛媛県松山市道後湯之町5-6",
        location: { lat: 33.8516, lng: 132.7864 },
        regularOpeningHours,
      },
    };
  }

  // Example-based companion to Property 2.
  // Validates: Requirements 1.10
  //
  // Property 2 only requires that every usable line survive as a substring,
  // which any separator satisfies. The separator itself is a design decision
  // (`" / "`, matching the `regularOpeningHours?.join(" / ")` that
  // `SpotDetailPanel` already renders), so it is pinned by one example instead:
  // changing the decision stays a one-line edit rather than a rewritten
  // property.
  it("openingHours は非空要素を \" / \" で連結する", () => {
    const spot = spotFromRouteCandidate(
      candidateWithOpeningHours(["月: 9:00–17:00", "火: 定休"]),
      "ja",
    );

    expect(spot.openingHours).toBe("月: 9:00–17:00 / 火: 定休");
  });

  // Validates: Requirements 1.10
  //
  // How the trim and the separator interact. Both examples are cases where a
  // fold that joined first and cleaned up afterwards would still contain every
  // usable line — and so would still satisfy Property 2 — while producing
  // padding around the separator or an empty segment between two of them.
  it("openingHours は要素ごとにトリムし空白のみの要素を落とす", () => {
    // Trim is per element, so the padding never reaches the separator.
    const padded = spotFromRouteCandidate(
      candidateWithOpeningHours(["  水: 10:00–18:00  "]),
      "ja",
    );
    expect(padded.openingHours).toBe("水: 10:00–18:00");

    // Blank entries are dropped before the join, leaving no stray separator:
    // `" /  / 木: 9:00"` is the failure this example rules out.
    const withBlanks = spotFromRouteCandidate(
      candidateWithOpeningHours(["", "  ", "木: 9:00"]),
      "ja",
    );
    expect(withBlanks.openingHours).toBe("木: 9:00");
  });
});

// ---------------------------------------------------------------------------
// spotsFromRouteCandidates — route order
// ---------------------------------------------------------------------------

describe("spotsFromRouteCandidates", () => {
  // Feature: swipe-favorites-itinerary, Property 1, 4: 変換はルート順を保つ
  // Validates: Requirements 4.2
  //
  // The whole-route conversion is the per-candidate rule (Property 1) applied in
  // route order (Property 4). Order is what AC 4.2 is about: the shiori has to
  // read in the sequence the user built on the deck, so a `map` that sorted,
  // filtered or reversed would be wrong even with every individual spot correct.
  //
  // `fc.array` draws the empty route too, which is the case AC 4.9 leans on —
  // an empty route converts to an empty list, and `appendUniqueById` then hands
  // the shiori back unchanged.
  it("Feature: swipe-favorites-itinerary, Property 1, 4: 変換はルート順を保つ", () => {
    fc.assert(
      fc.property(
        fc.array(candidateArb),
        placeIdArb,
        fc.constantFrom(...LANGS),
        (candidates, sharedPlaceId, lang) => {
          const spots = spotsFromRouteCandidates(candidates, lang);

          // AC 4.2: the id sequence is the `place.id` sequence, position for
          // position. `toEqual` on the two arrays pins the length as well, so a
          // dropped or invented stop fails here.
          expect(spots.map((spot) => spot.id)).toEqual(
            candidates.map((candidate) => candidate.place.id),
          );

          // Each element is the single-candidate conversion of the candidate at
          // the same index — not just the right ids in the right order, but the
          // right whole spot. Property 1 already fixes what that conversion is,
          // so this ties the route-level function to it rather than restating
          // the field rules.
          candidates.forEach((candidate, i) => {
            expect(spots[i]).toStrictEqual(spotFromRouteCandidate(candidate, lang));
          });

          // No de-duplication here: repeated ids pass straight through. That is
          // deliberate — skipping duplicates is `appendUniqueById`'s job and
          // happens later, against the collection being merged into, where the
          // ids already in the shiori are known. Collapsing them at conversion
          // time would silently shorten the route.
          //
          // Every candidate is forced onto one place id because `candidateArb`
          // draws ids that collide essentially never, so the case would
          // otherwise go untested on every run.
          const repeated = candidates.map((candidate) =>
            withPlaceId(candidate, sharedPlaceId),
          );
          const repeatedSpots = spotsFromRouteCandidates(repeated, lang);
          expect(repeatedSpots.length).toBe(candidates.length);
          expect(repeatedSpots.map((spot) => spot.id)).toEqual(
            candidates.map(() => sharedPlaceId),
          );
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// appendUniqueById — the favorites / shiori merge
// ---------------------------------------------------------------------------

describe("appendUniqueById", () => {
  // Feature: swipe-favorites-itinerary, Property 4: 追記は既存の接頭辞と追加順序を保つ
  // Validates: Requirements 4.2, 4.4
  //
  // The merge is append-only in both directions. What was already in the shiori
  // stays where it was (AC 4.4) — a route confirmed later must not reshuffle a
  // list the user has already reordered by hand — and what does get appended
  // arrives in route order (AC 4.2), so the itinerary reads in the sequence the
  // user built on the deck.
  //
  // The expected tail is spelled out declaratively ("new to the collection, and
  // the first occurrence of its id") rather than by replaying the merge's own
  // loop, so the two would not fail in the same direction together.
  it("Feature: swipe-favorites-itinerary, Property 4: 追記は既存の接頭辞と追加順序を保つ", () => {
    fc.assert(
      fc.property(fc.array(spotArb), fc.array(spotArb), (collection, additions) => {
        const result = appendUniqueById(collection, additions);

        // AC 4.4: the head is the original collection, element for element and
        // reference for reference — nothing reordered, nothing rebuilt.
        expect(result.slice(0, collection.length)).toStrictEqual(collection);
        collection.forEach((spot, i) => {
          expect(result[i]).toBe(spot);
        });

        const existingIds = new Set(collection.map((spot) => spot.id));
        const expectedTail = additions.filter(
          (spot, i) =>
            !existingIds.has(spot.id) &&
            additions.findIndex((other) => other.id === spot.id) === i,
        );

        // AC 4.2: everything past the prefix is exactly the new additions, in
        // the order they were handed over, and they are the very objects passed
        // in rather than copies.
        const tail = result.slice(collection.length);
        expect(tail).toStrictEqual(expectedTail);
        tail.forEach((spot, i) => {
          expect(spot).toBe(expectedTail[i]);
        });
        expect(result.length).toBe(collection.length + expectedTail.length);

        // Stated without reference to `expectedTail`: an appended id is never one
        // the collection already held, and never repeats within the tail.
        const tailIds = tail.map((spot) => spot.id);
        expect(tailIds.filter((id) => existingIds.has(id))).toEqual([]);
        expect(new Set(tailIds).size).toBe(tailIds.length);
      }),
    );
  });

  /**
   * A collection paired with additions whose ids are *all* already in it — the
   * precondition of the "same reference" half of Property 5. Drawing additions
   * independently would satisfy that precondition only by luck, so they are
   * drawn from the collection itself instead.
   *
   * Each addition is either the very object the collection holds or a distinct
   * object carrying the same id. The second form is the one that actually occurs:
   * re-converting the same Google place yields a fresh `Spot` every time, so
   * de-duplication has to key on `id` and not on object identity. An empty
   * collection pairs with empty additions, which satisfies the precondition too.
   */
  const alreadyPresentArb: fc.Arbitrary<{ collection: Spot[]; additions: Spot[] }> = fc
    .array(spotArb)
    .chain((collection) =>
      fc.record({
        collection: fc.constant(collection),
        additions:
          collection.length === 0
            ? fc.constant<Spot[]>([])
            : fc.array(
                fc.constantFrom(...collection).chain((spot) =>
                  fc.oneof(
                    fc.constant(spot),
                    fc
                      .integer({ min: 0, max: 99 })
                      .map((nonce) => ({ ...spot, name: `re-converted#${nonce}` })),
                  ),
                ),
              ),
      }),
    );

  // Feature: swipe-favorites-itinerary, Property 5: 追記は id で冪等である
  // Validates: Requirements 2.3, 4.3, 4.9
  //
  // Adding the same places again changes nothing. This is what keeps a place
  // from landing in お気に入り twice when the user meets it on two decks
  // (AC 2.3) and from landing in the しおり twice when a confirmed route repeats
  // a stop already there (AC 4.3); with no additions at all it makes confirming
  // an empty route a no-op (AC 4.9).
  //
  // "Changes nothing" is pinned as reference identity, not just equality: the
  // store returns the previous state object when the merge returns its input, so
  // an implementation that rebuilt an identical array would be correct in
  // content yet would re-render every subscriber on every skipped duplicate.
  it("Feature: swipe-favorites-itinerary, Property 5: 追記は id で冪等である", () => {
    // Applying twice equals applying once — the ids added by the first pass are
    // present for the second, so the second finds nothing new to add.
    fc.assert(
      fc.property(fc.array(spotArb), fc.array(spotArb), (collection, additions) => {
        const once = appendUniqueById(collection, additions);
        const twice = appendUniqueById(once, additions);

        expect(twice).toStrictEqual(once);
        expect(twice).toBe(once);

        // AC 4.9: an empty addition list is a no-op for any collection.
        expect(appendUniqueById(collection, [])).toBe(collection);
      }),
    );

    // AC 2.3 / 4.3: additions that are all already present leave the collection
    // untouched, whether they arrive as the same objects or as freshly converted
    // ones sharing an id.
    fc.assert(
      fc.property(alreadyPresentArb, ({ collection, additions }) => {
        // Guard against a vacuous run: the generator has to have produced only
        // ids the collection already holds, or the claim below proves nothing.
        const existingIds = new Set(collection.map((spot) => spot.id));
        expect(additions.filter((spot) => !existingIds.has(spot.id))).toEqual([]);

        expect(appendUniqueById(collection, additions)).toBe(collection);

        // Independent of what the generator drew: re-converting every entry in
        // the collection produces distinct objects with the same ids, and none of
        // them may be appended. This keeps the distinct-instance case covered on
        // every run rather than only when `fc.oneof` happens to pick it.
        const reconverted = collection.map((spot, i) => ({ ...spot, name: `again#${i}` }));
        expect(appendUniqueById(collection, reconverted)).toBe(collection);
      }),
    );
  });
});
