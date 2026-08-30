interface GooglePhotoAttribution {
  displayName?: string;
  uri?: string;
}

interface GooglePhoto {
  name?: string;
  authorAttributions?: GooglePhotoAttribution[];
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: GooglePhoto[];
}

export interface EnrichedPlace {
  id: string;
  name: string;
  formattedAddress: string;
  location?: { lat: number; lng: number };
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: string[];
  photoUrl?: string;
  photoAttributions?: Array<{ displayName: string; uri?: string }>;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.photos",
].join(",");

function placesLanguage(lang: string): string {
  if (lang === "zh-Hans") return "zh-CN";
  if (lang === "zh-Hant") return "zh-TW";
  if (lang === "iyo") return "ja";
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(lang) ? lang : "ja";
}

function isInEhime(place: GooglePlace): boolean {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return true;
  return lat >= 32.8 && lat <= 34.6 && lng >= 131.8 && lng <= 134.3;
}

/** Maps one Google place onto {@link EnrichedPlace}, dropping absent fields. */
function toEnrichedPlace(place: GooglePlace): EnrichedPlace | null {
  if (!place.id || !place.displayName?.text) return null;

  const photo = place.photos?.[0];
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  const location =
    typeof latitude === "number" && typeof longitude === "number"
      ? { lat: latitude, lng: longitude }
      : undefined;
  const photoAttributions = photo?.authorAttributions
    ?.filter((item) => Boolean(item.displayName))
    .map((item) => ({
      displayName: item.displayName as string,
      ...(item.uri ? { uri: item.uri } : {}),
    }));

  return {
    id: place.id,
    name: place.displayName.text,
    formattedAddress: place.formattedAddress ?? "",
    ...(location ? { location } : {}),
    ...(place.googleMapsUri ? { googleMapsUri: place.googleMapsUri } : {}),
    ...(place.websiteUri ? { websiteUri: place.websiteUri } : {}),
    ...(place.nationalPhoneNumber
      ? { nationalPhoneNumber: place.nationalPhoneNumber }
      : {}),
    ...(typeof place.rating === "number" ? { rating: place.rating } : {}),
    ...(typeof place.userRatingCount === "number"
      ? { userRatingCount: place.userRatingCount }
      : {}),
    ...(place.regularOpeningHours?.weekdayDescriptions?.length
      ? { regularOpeningHours: place.regularOpeningHours.weekdayDescriptions }
      : {}),
    ...(photo?.name
      ? { photoUrl: `/api/places/photo?name=${encodeURIComponent(photo.name)}` }
      : {}),
    ...(photoAttributions?.length ? { photoAttributions } : {}),
  };
}

export async function searchEhimePlace(
  query: string,
  lang: string,
  area?: { center: { lat: number; lng: number }; radiusMeters: number },
): Promise<EnrichedPlace | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${query}, 愛媛県, 日本`,
        languageCode: placesLanguage(lang),
        regionCode: "JP",
        pageSize: 3,
        locationBias: area
          ? {
              circle: {
                center: {
                  latitude: area.center.lat,
                  longitude: area.center.lng,
                },
                radius: Math.min(50_000, Math.max(1, area.radiusMeters)),
              },
            }
          : {
              rectangle: {
                low: { latitude: 32.8, longitude: 131.8 },
                high: { latitude: 34.6, longitude: 134.3 },
              },
            },
      }),
    },
  );

  if (!response.ok) {
    console.error("Google Places text search failed", {
      status: response.status,
      query,
    });
    return null;
  }

  const data = (await response.json()) as { places?: GooglePlace[] };
  const place = (data.places ?? []).find(
    (candidate) => candidate.id && candidate.displayName?.text && isInEhime(candidate),
  );
  if (!place) return null;

  return toEnrichedPlace(place);
}

/**
 * Google place types that count as "somewhere to take a break".
 *
 * Verified against the live Nearby Search API. Ordered roughly by how much the
 * place is actually meant for resting. `public_bath` and `convenience_store`
 * are deliberately excluded: 入浴施設 belong to the onsen category, and
 * convenience stores would flood the results in any town.
 */
const REST_STOP_TYPES = [
  "rest_stop",
  "park",
  "community_center",
  "tourist_information_center",
  "garden",
] as const;

/**
 * Nearest places to take a break inside `area`, closest first.
 *
 * Used when a requested kind yields nothing at all — asking for a café around
 * 面河渓 is the case this exists for. Unlike {@link searchEhimePlace}, which
 * text-searches one proposed name at a time, this asks Google for everything of
 * a given type inside a circle, so it finds 公民館 and 道の駅 that no AI proposal
 * would have named.
 *
 * `locationRestriction` is a hard boundary (not the `locationBias` the text
 * search uses), so every result is guaranteed inside the radius and the caller
 * does not need to re-filter by distance.
 *
 * Returns `[]` when the key is absent or the request fails, so the caller keeps
 * treating "nothing to offer" as its own case rather than as an exception.
 */
export async function searchEhimeRestStops(
  area: { center: { lat: number; lng: number }; radiusMeters: number },
  lang: string,
  limit: number,
): Promise<EnrichedPlace[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: [...REST_STOP_TYPES],
          languageCode: placesLanguage(lang),
          regionCode: "JP",
          maxResultCount: Math.min(20, Math.max(1, limit)),
          rankPreference: "DISTANCE",
          locationRestriction: {
            circle: {
              center: {
                latitude: area.center.lat,
                longitude: area.center.lng,
              },
              radius: Math.min(50_000, Math.max(1, area.radiusMeters)),
            },
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("Google Places nearby search failed", {
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as { places?: GooglePlace[] };
    const places: EnrichedPlace[] = [];
    for (const place of data.places ?? []) {
      if (!isInEhime(place)) continue;
      const enriched = toEnrichedPlace(place);
      // A candidate without coordinates cannot be placed on the route.
      if (enriched?.location) places.push(enriched);
      if (places.length >= limit) break;
    }
    return places;
  } catch (error) {
    console.error("Google Places nearby search threw", error);
    return [];
  }
}