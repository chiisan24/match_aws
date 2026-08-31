interface GooglePhotoAttribution {
  displayName?: string;
  uri?: string;
}

interface GooglePhoto {
  name?: string;
  authorAttributions?: GooglePhotoAttribution[];
}

/**
 * The part of a Places response this module reads.
 *
 * Deliberately limited to {@link FIELD_MASK}: a field that is not requested is
 * never returned, so listing more here would only invite reads that are always
 * `undefined` in production.
 */
interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  photos?: GooglePhoto[];
}

/**
 * A place as the rest of the API passes it around.
 *
 * Wider than what {@link searchEhimePlace} can fill, and intentionally so: the
 * offline fallback paths build values of this shape from the bundled
 * OpenStreetMap catalogue, and those do carry `websiteUri` / `regularOpeningHours`
 * for free. Google is simply no longer asked for them — `rating`,
 * `userRatingCount` and `nationalPhoneNumber` therefore never arrive at all now,
 * and the screens fall back to a Google マップ link for that detail.
 */
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

/**
 * Text Search で要求するフィールド。
 *
 * Places (New) は **マスクに含まれる最上位 SKU** で 1 リクエストを課金する
 * （Essentials と Pro を混ぜれば Pro 課金）。したがってフィールドを 1 つ足すことは
 * リクエスト全体の単価を上げることと同じで、ここに何を書くかがそのまま費用になる。
 *
 * このマスクは意図的に **Enterprise ティアのフィールドを 1 つも含まない**。
 * 以前は `rating` / `userRatingCount` / `regularOpeningHours` /
 * `nationalPhoneNumber` / `websiteUri` を要求していて、その 5 つだけが
 * リクエストを Enterprise ティアへ押し上げていた。★ や営業時間の表示のために
 * 全リクエストが最上位単価を払っていたことになる。
 *
 * それらは取得をやめ、利用者には `googleMapsUri` から Google マップへ移動して
 * もらう。マップ側には営業時間・レビュー・電話番号が最新の状態で揃っているので、
 * 情報が失われるわけではなく、出所が変わる。
 *
 * 残した 6 フィールドはいずれも同一ティアなので、この中で数を削っても単価は
 * 下がらない。つまり以下はすべて「無料で付いてくる」もので、削ると費用は変わらず
 * 機能だけ落ちる:
 *
 *  - `id` — Place ID。Google マップリンクを API 無しで組み立てる材料になる。
 *  - `displayName` — 候補 3 件から正しいものを選ぶために必要（空ヒットの排除）。
 *  - `location` — 愛媛県内かどうかの検証と地図表示・距離計算に必要。
 *  - `formattedAddress` — カードと詳細パネルが住所として表示する。
 *  - `googleMapsUri` — 詳細情報への導線そのもの。
 *  - `photos` — 写真。そもそもこの呼び出しの主目的。
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.formattedAddress",
  "places.googleMapsUri",
  "places.photos",
].join(",");

/**
 * A resolved lookup, kept so the same name is never billed twice.
 *
 * Every caller now shares one field mask, so there is nothing to reconcile
 * between entries: any hit answers any request.
 */
interface CacheEntry {
  expiresAt: number;
  /** `null` is cached too: "Places does not know this name" is worth remembering. */
  place: EnrichedPlace | null;
}

/**
 * How long a resolved lookup is trusted.
 *
 * A day, because what is cached is a place's *identity* — its id, coordinates and
 * photo resource names — and those are stable. The short-lived part is the signed
 * media URL, and that is not cached here: `api/places/photo.ts` re-resolves it
 * from the photo name on every request.
 */
const PLACE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Cap on retained lookups.
 *
 * The map lives for the lifetime of a serverless instance, so it needs a ceiling
 * rather than a sweep: without one a long-lived instance would grow with every
 * distinct query. Insertion order is the eviction order, which is all this needs
 * — entries are written once per name.
 */
const PLACE_CACHE_LIMIT = 2_000;

const placeCache = new Map<string, CacheEntry>();

/**
 * Cache key. The area is part of it because `locationBias` changes which place a
 * name resolves to — 「城山」 near 松山 and 「城山」 near 宇和島 are different places,
 * and `rescueStopsNearAnchor` relies on exactly that difference.
 */
function cacheKey(
  query: string,
  lang: string,
  area?: { center: { lat: number; lng: number }; radiusMeters: number },
): string {
  const where = area
    ? `${area.center.lat.toFixed(3)},${area.center.lng.toFixed(3)}@${Math.round(area.radiusMeters)}`
    : "ehime";
  return `${placesLanguage(lang)}|${where}|${query.trim().toLowerCase()}`;
}

/**
 * The cached place for this key when it is still fresh, else `undefined`.
 *
 * The two cases differ: `{ place: null }` means "looked up, Places has nothing",
 * which is a hit and must not be re-billed. `undefined` means "never looked up".
 */
function cachedPlace(
  key: string,
  now: number,
): { place: EnrichedPlace | null } | undefined {
  const entry = placeCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    placeCache.delete(key);
    return undefined;
  }
  return { place: entry.place };
}

function rememberPlace(
  key: string,
  place: EnrichedPlace | null,
  now: number,
): void {
  placeCache.delete(key);
  placeCache.set(key, { expiresAt: now + PLACE_CACHE_TTL_MS, place });
  while (placeCache.size > PLACE_CACHE_LIMIT) {
    const oldest = placeCache.keys().next();
    if (oldest.done) break;
    placeCache.delete(oldest.value);
  }
}

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

/**
 * Resolve a place by name, returning only the fields `fieldSet` asks for.
 *
 * Results — including misses — are cached per name/language/area for a day, so a
 * name resolved by the itinerary generator costs nothing when the swipe deck or
 * the map panel asks for it again. The cache is shared by every caller and every
 * request handled by the same instance; before it, `/api/recommendations` alone
 * re-billed the same 5-25 names on every generation.
 */
export async function searchEhimePlace(
  query: string,
  lang: string,
  area?: { center: { lat: number; lng: number }; radiusMeters: number },
): Promise<EnrichedPlace | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;

  const now = Date.now();
  const key = cacheKey(query, lang, area);
  const hit = cachedPlace(key, now);
  if (hit) return hit.place;

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
    // Deliberately not cached: a 429 or a 5xx is about this moment, not about
    // the name, and remembering it for a day would hide a place that exists.
    return null;
  }

  const data = (await response.json()) as { places?: GooglePlace[] };
  const place = (data.places ?? []).find(
    (candidate) => candidate.id && candidate.displayName?.text && isInEhime(candidate),
  );
  if (!place?.id || !place.displayName?.text) {
    // A real answer — Places has nothing in Ehime under this name. Worth
    // remembering, or every deck rebuild pays to be told the same thing.
    rememberPlace(key, null, Date.now());
    return null;
  }

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

  // `rating` / `userRatingCount` / `regularOpeningHours` / `nationalPhoneNumber`
  // / `websiteUri` are absent by design — see FIELD_MASK. They stay on
  // `EnrichedPlace` because the offline paths (同梱カタログのフォールバック) still
  // populate `websiteUri` and `regularOpeningHours` from OpenStreetMap data at no
  // cost; what changed is only that Google is no longer asked for them.
  const enriched: EnrichedPlace = {
    id: place.id,
    name: place.displayName.text,
    formattedAddress: place.formattedAddress ?? "",
    ...(location ? { location } : {}),
    ...(place.googleMapsUri ? { googleMapsUri: place.googleMapsUri } : {}),
    ...(photo?.name
      ? { photoUrl: `/api/places/photo?name=${encodeURIComponent(photo.name)}` }
      : {}),
    ...(photoAttributions?.length ? { photoAttributions } : {}),
  };

  rememberPlace(key, enriched, Date.now());
  return enriched;
}