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
  if (!place?.id || !place.displayName?.text) return null;

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