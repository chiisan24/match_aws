/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Regenerate with: node scripts/build-api-shared.mjs
 *
 * Bundled so the Vercel function build has no `../src/` specifier to
 * resolve; see scripts/build-api-shared.mjs for why that mattered.
 *
 * Sources (sha256 c88620c1228352a0):
 *   src/adapters/mock/ehime-food.curated.ts
 *   src/adapters/mock/ehime-spots.generated.ts
 *   src/adapters/mock/spots.ts
 *   src/data/fallbackPools.ts
 *   src/data/templeDetails.ts
 *   src/data/templeGeo.ts
 *   src/domain/candidateFallback.ts
 *   src/domain/geofence.ts
 */
// src/domain/geofence.ts
var EARTH_RADIUS_METERS = 6371e3;
var toRadians = (deg) => deg * Math.PI / 180;
function haversineDistanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return EARTH_RADIUS_METERS * c;
}

// src/domain/candidateFallback.ts
var CANDIDATE_MINIMUM_COUNT = 5;
var CANDIDATE_MAXIMUM_COUNT = 8;
var CANDIDATE_BASE_RADIUS_METERS = 5e3;
var CANDIDATE_RADII_METERS = [5e3, 1e4, 2e4];
function clampCandidateCount(value, fallback, minimum = CANDIDATE_MINIMUM_COUNT) {
  const lowerBound = Number.isFinite(minimum) ? Math.min(Math.max(Math.floor(minimum), 0), CANDIDATE_MAXIMUM_COUNT) : CANDIDATE_MINIMUM_COUNT;
  const clamp = (candidate) => Math.min(Math.max(Math.floor(candidate), lowerBound), CANDIDATE_MAXIMUM_COUNT);
  const safeFallback = Number.isFinite(fallback) && fallback >= 0 ? clamp(fallback) : lowerBound;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return safeFallback;
  }
  return clamp(value);
}
function resolveMinimumCount(minimumCount) {
  if (typeof minimumCount !== "number" || !Number.isFinite(minimumCount) || minimumCount < 0) {
    return CANDIDATE_MINIMUM_COUNT;
  }
  return Math.floor(minimumCount);
}
function resolveMaximumCount(maximumCount) {
  if (!Number.isFinite(maximumCount) || maximumCount < 0) {
    return CANDIDATE_MAXIMUM_COUNT;
  }
  return Math.floor(maximumCount);
}
function finalizeCandidates(primary, context, pools) {
  const minimum = resolveMinimumCount(context.minimumCount);
  const maximum = resolveMaximumCount(context.maximumCount);
  const seen = new Set(context.usedPlaceIds);
  const candidates = [];
  for (const candidate of primary) {
    if (candidates.length >= maximum) {
      break;
    }
    const placeId = candidate.place.id;
    if (seen.has(placeId)) {
      continue;
    }
    seen.add(placeId);
    candidates.push(candidate);
  }
  if (context.kind !== "sightseeing") {
    return {
      candidates,
      appliedRadiusMeters: context.baseRadiusMeters,
      minimumCount: minimum
    };
  }
  const target = Math.min(maximum, minimum);
  const pool = [...pools.temples, ...pools.spots];
  const radii = CANDIDATE_RADII_METERS.filter((radius) => radius >= context.baseRadiusMeters);
  let appliedRadiusMeters = context.baseRadiusMeters;
  for (const radius of radii) {
    appliedRadiusMeters = radius;
    if (candidates.length < target) {
      const eligible = pool.flatMap((point) => {
        if (seen.has(point.id)) {
          return [];
        }
        if (point.source === "spot" && point.category === "food") {
          return [];
        }
        const distance = distanceFromCenter(context.center, point);
        if (distance === null || distance > radius) {
          return [];
        }
        return [{ point, distance }];
      }).sort(
        (a, b) => a.distance === b.distance ? compareIds(a.point.id, b.point.id) : a.distance - b.distance
      );
      for (const { point } of eligible) {
        if (candidates.length >= target) {
          break;
        }
        seen.add(point.id);
        candidates.push(toCandidate(point, context.kind, context.lang));
      }
    }
    if (candidates.length >= minimum) {
      break;
    }
  }
  return { candidates, appliedRadiusMeters, minimumCount: minimum };
}
function distanceFromCenter(center, point) {
  const { location } = point;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return null;
  }
  const distance = haversineDistanceMeters(center, location);
  return Number.isFinite(distance) ? distance : null;
}
function compareIds(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
function defaultDescription(point) {
  const name = point.name.trim();
  if (point.source === "temple") {
    return name ? `${name}をお参りできます。` : "お遍路の札所をお参りできます。";
  }
  return name ? `${name}を楽しめるスポットです。` : "立ち寄って楽しめるスポットです。";
}
function resolveDescription(point, lang) {
  const localized = point.descriptions[lang];
  if (typeof localized === "string" && localized.trim().length > 0) {
    return localized;
  }
  const japanese = point.descriptions.ja;
  if (typeof japanese === "string" && japanese.trim().length > 0) {
    return japanese;
  }
  return defaultDescription(point);
}
function toCandidate(point, kind, lang) {
  return {
    id: `${kind}:${point.source}:${point.id}`,
    kind,
    title: point.name,
    description: resolveDescription(point, lang),
    searchQuery: point.name,
    source: point.source,
    place: {
      id: point.id,
      name: point.name,
      formattedAddress: point.formattedAddress,
      location: point.location,
      ...point.photoUrl ? { photoUrl: point.photoUrl } : {},
      ...point.websiteUri ? { websiteUri: point.websiteUri } : {}
    }
  };
}

// src/adapters/mock/ehime-spots.generated.ts
var EHIME_SPOTS = [
  {
    id: "osm-node-8331986281",
    name: "谷本蒲鉾店",
    category: "food",
    location: { lat: 33.852236, lng: 132.786047 },
    localizedDescriptions: { ja: "谷本蒲鉾店（飲食店）", en: "Tanimoto Kamaboko (food)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10839392518",
    name: "鯛めし もとやま",
    category: "food",
    location: { lat: 33.843218, lng: 132.770961 },
    localizedDescriptions: { ja: "鯛めし もとやま（飲食店）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-11543529407",
    name: "鍋焼きうどんMAMMA",
    category: "food",
    location: { lat: 33.850586, lng: 132.787822 },
    localizedDescriptions: { ja: "鍋焼きうどんMAMMA（飲食店）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-12367752630",
    name: "鯛めし秋嘉",
    category: "food",
    location: { lat: 33.842776, lng: 132.770884 },
    localizedDescriptions: { ja: "鯛めし秋嘉（飲食店）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-611661255",
    name: "松山城",
    category: "sightseeing",
    location: { lat: 33.845651, lng: 132.765746 },
    localizedDescriptions: { ja: "松山城（観光スポット）", en: "Matsuyama Castle (sightseeing)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Dec-Jan Mo-Su 09:00-16:30; Feb-Jul Mo-Su 09:00-17:00; Aug Mo-Su 09:00-17:30; Sep-Nov Mo-Su 09:00-17:00",
    website: "https://www.matsuyamajo.jp/"
  },
  {
    id: "osm-node-614515488",
    name: "勝山",
    category: "sightseeing",
    location: { lat: 33.845483, lng: 132.765752 },
    localizedDescriptions: { ja: "勝山（観光スポット）", en: "Mt. Katsu (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-930008896",
    name: "四国最西端の碑",
    category: "sightseeing",
    location: { lat: 33.342997, lng: 132.014761 },
    localizedDescriptions: { ja: "四国最西端の碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-945781872",
    name: "三坂峠",
    category: "sightseeing",
    location: { lat: 33.708007, lng: 132.86119 },
    localizedDescriptions: { ja: "三坂峠（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423706540",
    name: "ミウラート・ヴィレッジ（三浦美術館）",
    category: "sightseeing",
    location: { lat: 33.898554, lng: 132.753643 },
    localizedDescriptions: { ja: "ミウラート・ヴィレッジ（三浦美術館）（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423707002",
    name: "上黒岩岩陰遺跡考古館",
    category: "sightseeing",
    location: { lat: 33.617827, lng: 132.960309 },
    localizedDescriptions: { ja: "上黒岩岩陰遺跡考古館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423707323",
    name: "久万美術館",
    category: "sightseeing",
    location: { lat: 33.662004, lng: 132.906867 },
    localizedDescriptions: { ja: "久万美術館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423707325",
    name: "久万高原ふるさと旅行村内久万町立山村歴史館",
    category: "sightseeing",
    location: { lat: 33.672986, lng: 132.937985 },
    localizedDescriptions: { ja: "久万高原ふるさと旅行村内久万町立山村歴史館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423707363",
    name: "乗禅寺宝物館",
    category: "sightseeing",
    location: { lat: 34.071889, lng: 132.959053 },
    localizedDescriptions: { ja: "乗禅寺宝物館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423729711",
    name: "五十崎凧博物館",
    category: "sightseeing",
    location: { lat: 33.539742, lng: 132.656661 },
    localizedDescriptions: { ja: "五十崎凧博物館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423729724",
    name: "五十崎歴史民俗資料館",
    category: "sightseeing",
    location: { lat: 33.544166, lng: 132.656871 },
    localizedDescriptions: { ja: "五十崎歴史民俗資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423730110",
    name: "今治城",
    category: "sightseeing",
    location: { lat: 34.063376, lng: 133.006851 },
    localizedDescriptions: { ja: "今治城（観光スポット）", en: "Imabari Castle (sightseeing)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:00-17:00",
    website: "https://www.city.imabari.ehime.jp/museum/imabarijo/"
  },
  {
    id: "osm-node-1423730119",
    name: "村上三島記念館",
    category: "sightseeing",
    location: { lat: 34.255642, lng: 133.053595 },
    localizedDescriptions: { ja: "村上三島記念館（観光スポット）", en: "Murakami Mishima Memorial Museum (sightseeing)" },
    reviews: [],
    imageUrls: [],
    website: "https://www.city.imabari.ehime.jp/museum/santou/about/"
  },
  {
    id: "osm-node-1423730142",
    name: "今治市朝倉ふるさと美術古墳館",
    category: "sightseeing",
    location: { lat: 33.99976, lng: 133.007538 },
    localizedDescriptions: { ja: "今治市朝倉ふるさと美術古墳館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423730145",
    name: "村上水軍博物館",
    category: "sightseeing",
    location: { lat: 34.16889, lng: 133.087614 },
    localizedDescriptions: { ja: "村上水軍博物館（観光スポット）", en: "Murakami Kaizoku Museum (sightseeing)" },
    reviews: [],
    imageUrls: [],
    website: "https://www.city.imabari.ehime.jp/museum/suigun/"
  },
  {
    id: "osm-node-1423730146",
    name: "今治市河野美術館",
    category: "sightseeing",
    location: { lat: 34.062772, lng: 132.998931 },
    localizedDescriptions: { ja: "今治市河野美術館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423730152",
    name: "今治市玉川近代美術館（徳生記念館）",
    category: "sightseeing",
    location: { lat: 34.022011, lng: 132.944558 },
    localizedDescriptions: { ja: "今治市玉川近代美術館（徳生記念館）（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423730166",
    name: "今治市菊間町かわら館",
    category: "sightseeing",
    location: { lat: 34.03219, lng: 132.841035 },
    localizedDescriptions: { ja: "今治市菊間町かわら館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423730497",
    name: "伊方町町見郷土館",
    category: "sightseeing",
    location: { lat: 33.46935, lng: 132.294561 },
    localizedDescriptions: { ja: "伊方町町見郷土館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423730847",
    name: "八幡浜市民ギャラリー・郷土資料室",
    category: "sightseeing",
    location: { lat: 33.458278, lng: 132.425588 },
    localizedDescriptions: { ja: "八幡浜市民ギャラリー・郷土資料室（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423731025",
    name: "別子銅山記念館",
    category: "sightseeing",
    location: { lat: 33.92131, lng: 133.309325 },
    localizedDescriptions: { ja: "別子銅山記念館（観光スポット）", en: "Besshi Copper Mine Memorial Museum (sightseeing)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Tu-Su 09:00-16:30",
    website: "https://besshidozan-museum.jp/"
  },
  {
    id: "osm-node-1423731201",
    name: "北条鹿島博物展示館",
    category: "sightseeing",
    location: { lat: 33.974093, lng: 132.766197 },
    localizedDescriptions: { ja: "北条鹿島博物展示館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423733302",
    name: "大洲市河辺歴史民俗資料館",
    category: "sightseeing",
    location: { lat: 33.510955, lng: 132.795141 },
    localizedDescriptions: { ja: "大洲市河辺歴史民俗資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423733305",
    name: "大洲市立博物館",
    category: "sightseeing",
    location: { lat: 33.513733, lng: 132.546179 },
    localizedDescriptions: { ja: "大洲市立博物館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423733464",
    name: "大西藤山歴史資料館",
    category: "sightseeing",
    location: { lat: 34.059988, lng: 132.929182 },
    localizedDescriptions: { ja: "大西藤山歴史資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423733658",
    name: "宇和先哲記念館",
    category: "sightseeing",
    location: { lat: 33.362861, lng: 132.515465 },
    localizedDescriptions: { ja: "宇和先哲記念館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423733742",
    name: "宇和島市立歴史資料館",
    category: "sightseeing",
    location: { lat: 33.226452, lng: 132.554664 },
    localizedDescriptions: { ja: "宇和島市立歴史資料館（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "We-Mo 09:00-17:00"
  },
  {
    id: "osm-node-1423733857",
    name: "宇和歴史民俗資料館",
    category: "sightseeing",
    location: { lat: 33.364209, lng: 132.513604 },
    localizedDescriptions: { ja: "宇和歴史民俗資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423733858",
    name: "宇和民具館",
    category: "sightseeing",
    location: { lat: 33.363916, lng: 132.513942 },
    localizedDescriptions: { ja: "宇和民具館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423733874",
    name: "宇和米博物館",
    category: "sightseeing",
    location: { lat: 33.368208, lng: 132.512223 },
    localizedDescriptions: { ja: "宇和米博物館（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Tu-Su 09:00-17:00"
  },
  {
    id: "osm-node-1423737357",
    name: "庄薬師堂",
    category: "sightseeing",
    location: { lat: 33.974574, lng: 132.804607 },
    localizedDescriptions: { ja: "庄薬師堂（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423737706",
    name: "愛媛文華館",
    category: "sightseeing",
    location: { lat: 34.064351, lng: 133.005114 },
    localizedDescriptions: { ja: "愛媛文華館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423737710",
    name: "愛媛民芸館",
    category: "sightseeing",
    location: { lat: 33.919786, lng: 133.17959 },
    localizedDescriptions: { ja: "愛媛民芸館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423737734",
    name: "愛媛県歴史文化博物館",
    category: "sightseeing",
    location: { lat: 33.363945, lng: 132.518216 },
    localizedDescriptions: { ja: "愛媛県歴史文化博物館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423739161",
    name: "松山城",
    category: "sightseeing",
    location: { lat: 33.845598, lng: 132.765938 },
    localizedDescriptions: { ja: "松山城（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "09:00-17:00"
  },
  {
    id: "osm-node-1423739223",
    name: "北条ふるさと館",
    category: "sightseeing",
    location: { lat: 33.958673, lng: 132.78024 },
    localizedDescriptions: { ja: "北条ふるさと館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423739405",
    name: "松山市立中島歴史民俗資料館懐古館",
    category: "sightseeing",
    location: { lat: 33.97293, lng: 132.594386 },
    localizedDescriptions: { ja: "松山市立中島歴史民俗資料館懐古館（観光スポット）", en: "Matsuyama City Nakajima History and Folklore Museum Nostalgia Museum (sightseeing)" },
    reviews: [],
    imageUrls: [],
    website: "https://www.city.matsuyama.ehime.jp/shisetsu/bunka/kaikokan.html"
  },
  {
    id: "osm-node-1423739411",
    name: "子規記念博物館",
    category: "sightseeing",
    location: { lat: 33.849701, lng: 132.787045 },
    localizedDescriptions: { ja: "子規記念博物館（観光スポット）", en: "Shiki Memorial Museum (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423739774",
    name: "梅山古陶資料館",
    category: "sightseeing",
    location: { lat: 33.729903, lng: 132.786681 },
    localizedDescriptions: { ja: "梅山古陶資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423740447",
    name: "湯築城資料館",
    category: "sightseeing",
    location: { lat: 33.848147, lng: 132.785669 },
    localizedDescriptions: { ja: "湯築城資料館（観光スポット）", en: "Yuzuji-jo Museum (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743413",
    name: "肱川風の博物館・歌麿館",
    category: "sightseeing",
    location: { lat: 33.447215, lng: 132.693317 },
    localizedDescriptions: { ja: "肱川風の博物館・歌麿館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743470",
    name: "芝不器男記念館",
    category: "sightseeing",
    location: { lat: 33.227147, lng: 132.708182 },
    localizedDescriptions: { ja: "芝不器男記念館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743648",
    name: "虹の森公園四万十川学習センターおさかな館",
    category: "sightseeing",
    location: { lat: 33.229344, lng: 132.710424 },
    localizedDescriptions: { ja: "虹の森公園四万十川学習センターおさかな館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743675",
    name: "西予市明浜歴史民俗資料館",
    category: "sightseeing",
    location: { lat: 33.313489, lng: 132.4426 },
    localizedDescriptions: { ja: "西予市明浜歴史民俗資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743690",
    name: "西予市立ギャラリーしろかわ",
    category: "sightseeing",
    location: { lat: 33.379411, lng: 132.751639 },
    localizedDescriptions: { ja: "西予市立ギャラリーしろかわ（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743693",
    name: "西予市立城川歴史民俗資料館",
    category: "sightseeing",
    location: { lat: 33.380208, lng: 132.751546 },
    localizedDescriptions: { ja: "西予市立城川歴史民俗資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743841",
    name: "西条市こどもの国",
    category: "sightseeing",
    location: { lat: 33.922853, lng: 133.180692 },
    localizedDescriptions: { ja: "西条市こどもの国（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743867",
    name: "西条市立東予郷土館",
    category: "sightseeing",
    location: { lat: 33.927685, lng: 133.081704 },
    localizedDescriptions: { ja: "西条市立東予郷土館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743872",
    name: "西条市立西条郷土博物館",
    category: "sightseeing",
    location: { lat: 33.919617, lng: 133.179638 },
    localizedDescriptions: { ja: "西条市立西条郷土博物館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423743878",
    name: "西条市考古歴史館",
    category: "sightseeing",
    location: { lat: 33.899568, lng: 133.197458 },
    localizedDescriptions: { ja: "西条市考古歴史館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423744734",
    name: "開明学校",
    category: "sightseeing",
    location: { lat: 33.36446, lng: 132.513825 },
    localizedDescriptions: { ja: "開明学校（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423748456",
    name: "鬼北町歴史民俗資料館",
    category: "sightseeing",
    location: { lat: 33.335175, lng: 132.798039 },
    localizedDescriptions: { ja: "鬼北町歴史民俗資料館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1682099303",
    name: "皿ヶ峰",
    category: "sightseeing",
    location: { lat: 33.715321, lng: 132.895229 },
    localizedDescriptions: { ja: "皿ヶ峰（観光スポット）", en: "Saragamine (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1757024951",
    name: "下兜山",
    category: "sightseeing",
    location: { lat: 33.8988, lng: 133.358933 },
    localizedDescriptions: { ja: "下兜山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1761416782",
    name: "大谷山",
    category: "sightseeing",
    location: { lat: 34.035968, lng: 133.629592 },
    localizedDescriptions: { ja: "大谷山（観光スポット）", en: "Mt. Otani (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1851999692",
    name: "石鎚山",
    category: "sightseeing",
    location: { lat: 33.76778, lng: 133.115104 },
    localizedDescriptions: { ja: "石鎚山（観光スポット）", en: "Mt. Ishizuchi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2183006553",
    name: "市民像",
    category: "sightseeing",
    location: { lat: 33.960836, lng: 133.282552 },
    localizedDescriptions: { ja: "市民像（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2183007133",
    name: "子どもの像",
    category: "sightseeing",
    location: { lat: 33.960869, lng: 133.282083 },
    localizedDescriptions: { ja: "子どもの像（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2232339905",
    name: "大峰ヶ台",
    category: "sightseeing",
    location: { lat: 33.844582, lng: 132.741062 },
    localizedDescriptions: { ja: "大峰ヶ台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2232613169",
    name: "岩子山",
    category: "sightseeing",
    location: { lat: 33.842194, lng: 132.731917 },
    localizedDescriptions: { ja: "岩子山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2232613170",
    name: "弁天山",
    category: "sightseeing",
    location: { lat: 33.844028, lng: 132.715167 },
    localizedDescriptions: { ja: "弁天山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2232613171",
    name: "忽那山",
    category: "sightseeing",
    location: { lat: 33.844083, lng: 132.700556 },
    localizedDescriptions: { ja: "忽那山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2299649851",
    name: "タオル美術館ICHIHIRO",
    category: "sightseeing",
    location: { lat: 33.969474, lng: 133.033283 },
    localizedDescriptions: { ja: "タオル美術館ICHIHIRO（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2305741706",
    name: "庚申庵",
    category: "sightseeing",
    location: { lat: 33.843634, lng: 132.754876 },
    localizedDescriptions: { ja: "庚申庵（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2306291341",
    name: "一草庵",
    category: "sightseeing",
    location: { lat: 33.853954, lng: 132.771832 },
    localizedDescriptions: { ja: "一草庵（観光スポット）", en: "Issōan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2439787320",
    name: "弘法大師像",
    category: "sightseeing",
    location: { lat: 33.849531, lng: 132.798245 },
    localizedDescriptions: { ja: "弘法大師像（観光スポット）", en: "Grand Buddha (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2460130038",
    name: "湯築城",
    category: "sightseeing",
    location: { lat: 33.848088, lng: 132.786775 },
    localizedDescriptions: { ja: "湯築城（観光スポット）", en: "Yuzuki  Castle (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2536036651",
    name: "犬吠山",
    category: "sightseeing",
    location: { lat: 33.918382, lng: 132.689997 },
    localizedDescriptions: { ja: "犬吠山（観光スポット）", en: "Mt. Inuboe (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2536036652",
    name: "小富士山",
    category: "sightseeing",
    location: { lat: 33.881747, lng: 132.671364 },
    localizedDescriptions: { ja: "小富士山（観光スポット）", en: "Mt. Kofuji (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2536036654",
    name: "高戸山",
    category: "sightseeing",
    location: { lat: 33.905534, lng: 132.667981 },
    localizedDescriptions: { ja: "高戸山（観光スポット）", en: "Mt. Takado (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935358552",
    name: "塩ヶ森",
    category: "sightseeing",
    location: { lat: 33.779464, lng: 132.909154 },
    localizedDescriptions: { ja: "塩ヶ森（観光スポット）", en: "Shiogamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935358553",
    name: "番駄ヶ森",
    category: "sightseeing",
    location: { lat: 33.773976, lng: 132.90151 },
    localizedDescriptions: { ja: "番駄ヶ森（観光スポット）", en: "Bandagamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935358554",
    name: "陣ヶ森",
    category: "sightseeing",
    location: { lat: 33.725857, lng: 132.913673 },
    localizedDescriptions: { ja: "陣ヶ森（観光スポット）", en: "Jingamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935374062",
    name: "御岳山",
    category: "sightseeing",
    location: { lat: 33.748247, lng: 132.87093 },
    localizedDescriptions: { ja: "御岳山（観光スポット）", en: "Mitakisan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476969",
    name: "堂ヶ森",
    category: "sightseeing",
    location: { lat: 33.755968, lng: 133.066845 },
    localizedDescriptions: { ja: "堂ヶ森（観光スポット）", en: "Dougamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476971",
    name: "西ノ冠岳",
    category: "sightseeing",
    location: { lat: 33.769235, lng: 133.101384 },
    localizedDescriptions: { ja: "西ノ冠岳（観光スポット）", en: "Nishinokanmuridake (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476972",
    name: "弥山",
    category: "sightseeing",
    location: { lat: 33.769067, lng: 133.113632 },
    localizedDescriptions: { ja: "弥山（観光スポット）", en: "Misen (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476973",
    name: "南尖峰",
    category: "sightseeing",
    location: { lat: 33.767036, lng: 133.115806 },
    localizedDescriptions: { ja: "南尖峰（観光スポット）", en: "Minamisenpou (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476975",
    name: "剣山",
    category: "sightseeing",
    location: { lat: 33.775569, lng: 133.120862 },
    localizedDescriptions: { ja: "剣山（観光スポット）", en: "Tsurugisan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476976",
    name: "前社森",
    category: "sightseeing",
    location: { lat: 33.777062, lng: 133.120732 },
    localizedDescriptions: { ja: "前社森（観光スポット）", en: "Zensyagamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476977",
    name: "天柱石",
    category: "sightseeing",
    location: { lat: 33.772918, lng: 133.126999 },
    localizedDescriptions: { ja: "天柱石（観光スポット）", en: "Tenchuuseki (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476978",
    name: "三ヶ森",
    category: "sightseeing",
    location: { lat: 33.80239, lng: 133.06779 },
    localizedDescriptions: { ja: "三ヶ森（観光スポット）", en: "Sangamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476979",
    name: "黒森",
    category: "sightseeing",
    location: { lat: 33.791655, lng: 133.021512 },
    localizedDescriptions: { ja: "黒森（観光スポット）", en: "Kuromori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476980",
    name: "面木山",
    category: "sightseeing",
    location: { lat: 33.813947, lng: 133.012675 },
    localizedDescriptions: { ja: "面木山（観光スポット）", en: "Omogiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476981",
    name: "千羽ヶ岳",
    category: "sightseeing",
    location: { lat: 33.828582, lng: 132.985347 },
    localizedDescriptions: { ja: "千羽ヶ岳（観光スポット）", en: "Senbagadake (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476982",
    name: "船野山",
    category: "sightseeing",
    location: { lat: 33.8041, lng: 132.947506 },
    localizedDescriptions: { ja: "船野山（観光スポット）", en: "Funanoyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476983",
    name: "皿ヶ森",
    category: "sightseeing",
    location: { lat: 33.823394, lng: 132.941319 },
    localizedDescriptions: { ja: "皿ヶ森（観光スポット）", en: "Saragamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476984",
    name: "経座ヶ森",
    category: "sightseeing",
    location: { lat: 33.827813, lng: 132.934504 },
    localizedDescriptions: { ja: "経座ヶ森（観光スポット）", en: "Kyouzagamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476985",
    name: "ヨソ山",
    category: "sightseeing",
    location: { lat: 33.84115, lng: 132.929334 },
    localizedDescriptions: { ja: "ヨソ山（観光スポット）", en: "Yosoyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476986",
    name: "城山",
    category: "sightseeing",
    location: { lat: 33.814689, lng: 132.876407 },
    localizedDescriptions: { ja: "城山（観光スポット）", en: "Mount Shiro (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476987",
    name: "潮見山",
    category: "sightseeing",
    location: { lat: 33.819063, lng: 132.853126 },
    localizedDescriptions: { ja: "潮見山（観光スポット）", en: "Mount Shiomi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476988",
    name: "観音山",
    category: "sightseeing",
    location: { lat: 33.838902, lng: 132.83949 },
    localizedDescriptions: { ja: "観音山（観光スポット）", en: "Mount Kannon (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476989",
    name: "大友山",
    category: "sightseeing",
    location: { lat: 33.748199, lng: 132.807042 },
    localizedDescriptions: { ja: "大友山（観光スポット）", en: "Ootomoyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476990",
    name: "黒森山",
    category: "sightseeing",
    location: { lat: 33.689607, lng: 132.849202 },
    localizedDescriptions: { ja: "黒森山（観光スポット）", en: "Kuromoriyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476991",
    name: "船山",
    category: "sightseeing",
    location: { lat: 33.698175, lng: 132.886383 },
    localizedDescriptions: { ja: "船山（観光スポット）", en: "Funayama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476992",
    name: "餓鬼ヶ森",
    category: "sightseeing",
    location: { lat: 33.690929, lng: 132.905495 },
    localizedDescriptions: { ja: "餓鬼ヶ森（観光スポット）", en: "Mt. Gakigamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476993",
    name: "菊ヶ森",
    category: "sightseeing",
    location: { lat: 33.67725, lng: 132.912146 },
    localizedDescriptions: { ja: "菊ヶ森（観光スポット）", en: "Mt. Kikugamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476994",
    name: "福見山",
    category: "sightseeing",
    location: { lat: 33.889417, lng: 132.901926 },
    localizedDescriptions: { ja: "福見山（観光スポット）", en: "Fukumiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476995",
    name: "明神ヶ森",
    category: "sightseeing",
    location: { lat: 33.893847, lng: 132.917774 },
    localizedDescriptions: { ja: "明神ヶ森（観光スポット）", en: "Myoujingamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476996",
    name: "白潰",
    category: "sightseeing",
    location: { lat: 33.905535, lng: 132.925586 },
    localizedDescriptions: { ja: "白潰（観光スポット）", en: "Shiratsue (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2935476998",
    name: "青滝山",
    category: "sightseeing",
    location: { lat: 33.762297, lng: 133.034914 },
    localizedDescriptions: { ja: "青滝山（観光スポット）", en: "Aotakiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941312085",
    name: "捻山",
    category: "sightseeing",
    location: { lat: 33.860872, lng: 132.970312 },
    localizedDescriptions: { ja: "捻山（観光スポット）", en: "Nejireyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941423932",
    name: "引地山",
    category: "sightseeing",
    location: { lat: 33.727843, lng: 132.875032 },
    localizedDescriptions: { ja: "引地山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941423942",
    name: "鶴ノ子ノ頭",
    category: "sightseeing",
    location: { lat: 33.760517, lng: 133.136229 },
    localizedDescriptions: { ja: "鶴ノ子ノ頭（観光スポット）", en: "Tsurunokonoatama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941423943",
    name: "五代ヶ森",
    category: "sightseeing",
    location: { lat: 33.736914, lng: 133.083197 },
    localizedDescriptions: { ja: "五代ヶ森（観光スポット）", en: "Mt. Godaigamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941423945",
    name: "面河山",
    category: "sightseeing",
    location: { lat: 33.750905, lng: 133.111999 },
    localizedDescriptions: { ja: "面河山（観光スポット）", en: "Mt. Omogo (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941423947",
    name: "岩黒山",
    category: "sightseeing",
    location: { lat: 33.750758, lng: 133.156984 },
    localizedDescriptions: { ja: "岩黒山（観光スポット）", en: "Iwakurosan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941423948",
    name: "丸滝山",
    category: "sightseeing",
    location: { lat: 33.746268, lng: 133.15117 },
    localizedDescriptions: { ja: "丸滝山（観光スポット）", en: "Marutakisan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941423973",
    name: "桂ヶ森",
    category: "sightseeing",
    location: { lat: 33.658858, lng: 132.857753 },
    localizedDescriptions: { ja: "桂ヶ森（観光スポット）", en: "Katsuragamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2941440868",
    name: "大ノ森",
    category: "sightseeing",
    location: { lat: 33.718294, lng: 133.056758 },
    localizedDescriptions: { ja: "大ノ森（観光スポット）", en: "Oonomori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3085392638",
    name: "草屋敷",
    category: "sightseeing",
    location: { lat: 33.604639, lng: 132.614626 },
    localizedDescriptions: { ja: "草屋敷（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3255214561",
    name: "塩ケ森",
    category: "sightseeing",
    location: { lat: 33.779464, lng: 132.909154 },
    localizedDescriptions: { ja: "塩ケ森（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3258078118",
    name: "北三方ヶ森",
    category: "sightseeing",
    location: { lat: 33.95031, lng: 132.888611 },
    localizedDescriptions: { ja: "北三方ヶ森（観光スポット）", en: "Mount Kitasanpougamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3258078120",
    name: "大月山",
    category: "sightseeing",
    location: { lat: 33.929655, lng: 132.847751 },
    localizedDescriptions: { ja: "大月山（観光スポット）", en: "Mount Otsuki (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3258078121",
    name: "伊之子山",
    category: "sightseeing",
    location: { lat: 33.934084, lng: 132.920017 },
    localizedDescriptions: { ja: "伊之子山（観光スポット）", en: "Mount Inoko (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3258078122",
    name: "楢原山",
    category: "sightseeing",
    location: { lat: 33.940249, lng: 132.944435 },
    localizedDescriptions: { ja: "楢原山（観光スポット）", en: "Narabarasan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259199776",
    name: "愛ノ山",
    category: "sightseeing",
    location: { lat: 33.892542, lng: 133.038785 },
    localizedDescriptions: { ja: "愛ノ山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228836",
    name: "丸山",
    category: "sightseeing",
    location: { lat: 33.972488, lng: 132.925041 },
    localizedDescriptions: { ja: "丸山（観光スポット）", en: "Maruyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228846",
    name: "夫婦山",
    category: "sightseeing",
    location: { lat: 33.900324, lng: 132.803652 },
    localizedDescriptions: { ja: "夫婦山（観光スポット）", en: "Meotoyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228847",
    name: "勝岡山",
    category: "sightseeing",
    location: { lat: 33.883356, lng: 132.816399 },
    localizedDescriptions: { ja: "勝岡山（観光スポット）", en: "Mount Katsuka (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228852",
    name: "芝ヶ峠",
    category: "sightseeing",
    location: { lat: 33.824789, lng: 132.816384 },
    localizedDescriptions: { ja: "芝ヶ峠（観光スポット）", en: "Shibagato (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228855",
    name: "御幸寺山",
    category: "sightseeing",
    location: { lat: 33.855927, lng: 132.773334 },
    localizedDescriptions: { ja: "御幸寺山（観光スポット）", en: "Miyukijisan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228857",
    name: "潮見山",
    category: "sightseeing",
    location: { lat: 33.876623, lng: 132.761464 },
    localizedDescriptions: { ja: "潮見山（観光スポット）", en: "Shiomiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228858",
    name: "大久保山",
    category: "sightseeing",
    location: { lat: 33.879213, lng: 132.771539 },
    localizedDescriptions: { ja: "大久保山（観光スポット）", en: "Okuboyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259228859",
    name: "城山",
    category: "sightseeing",
    location: { lat: 33.883807, lng: 132.783224 },
    localizedDescriptions: { ja: "城山（観光スポット）", en: "Shiroyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259229768",
    name: "陣が森",
    category: "sightseeing",
    location: { lat: 33.988836, lng: 132.889427 },
    localizedDescriptions: { ja: "陣が森（観光スポット）", en: "Jingamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259229769",
    name: "岩が森",
    category: "sightseeing",
    location: { lat: 33.994805, lng: 132.8661 },
    localizedDescriptions: { ja: "岩が森（観光スポット）", en: "Iwagamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259229771",
    name: "高萩山",
    category: "sightseeing",
    location: { lat: 33.998565, lng: 132.833959 },
    localizedDescriptions: { ja: "高萩山（観光スポット）", en: "Takahagiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259229772",
    name: "名石山",
    category: "sightseeing",
    location: { lat: 34.006571, lng: 132.818641 },
    localizedDescriptions: { ja: "名石山（観光スポット）", en: "Meishiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259229773",
    name: "恵良山",
    category: "sightseeing",
    location: { lat: 33.992338, lng: 132.799171 },
    localizedDescriptions: { ja: "恵良山（観光スポット）", en: "Erayama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259229777",
    name: "雄甲山",
    category: "sightseeing",
    location: { lat: 33.946564, lng: 132.799864 },
    localizedDescriptions: { ja: "雄甲山（観光スポット）", en: "Ongoyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259229779",
    name: "経ヶ森",
    category: "sightseeing",
    location: { lat: 33.883336, lng: 132.711113 },
    localizedDescriptions: { ja: "経ヶ森（観光スポット）", en: "Kyogamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259460659",
    name: "腰折山",
    category: "sightseeing",
    location: { lat: 33.993378, lng: 132.789662 },
    localizedDescriptions: { ja: "腰折山（観光スポット）", en: "Koshioreyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259474675",
    name: "花木山",
    category: "sightseeing",
    location: { lat: 34.075081, lng: 132.923522 },
    localizedDescriptions: { ja: "花木山（観光スポット）", en: "Hanakiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259489536",
    name: "海山",
    category: "sightseeing",
    location: { lat: 34.106835, lng: 132.953635 },
    localizedDescriptions: { ja: "海山（観光スポット）", en: "Umiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259489538",
    name: "高山",
    category: "sightseeing",
    location: { lat: 34.114571, lng: 132.915717 },
    localizedDescriptions: { ja: "高山（観光スポット）", en: "Takayama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259489540",
    name: "塔の峰",
    category: "sightseeing",
    location: { lat: 34.12489, lng: 132.943966 },
    localizedDescriptions: { ja: "塔の峰（観光スポット）", en: "Tonomine (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259489555",
    name: "近見山",
    category: "sightseeing",
    location: { lat: 34.085196, lng: 132.970794 },
    localizedDescriptions: { ja: "近見山（観光スポット）", en: "Chikamiyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259525602",
    name: "重茂山",
    category: "sightseeing",
    location: { lat: 34.038806, lng: 132.929868 },
    localizedDescriptions: { ja: "重茂山（観光スポット）", en: "Jumosan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259525632",
    name: "大黒山",
    category: "sightseeing",
    location: { lat: 33.949292, lng: 133.020749 },
    localizedDescriptions: { ja: "大黒山（観光スポット）", en: "Daikokuyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259525633",
    name: "竜門山",
    category: "sightseeing",
    location: { lat: 33.957732, lng: 133.013286 },
    localizedDescriptions: { ja: "竜門山（観光スポット）", en: "Ryumonzan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259525637",
    name: "世田山",
    category: "sightseeing",
    location: { lat: 33.977644, lng: 133.04135 },
    localizedDescriptions: { ja: "世田山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259525639",
    name: "笠松山",
    category: "sightseeing",
    location: { lat: 33.981842, lng: 133.033813 },
    localizedDescriptions: { ja: "笠松山（観光スポット）", en: "Kasamatsuyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3259525642",
    name: "霊仙山",
    category: "sightseeing",
    location: { lat: 34.010708, lng: 133.020326 },
    localizedDescriptions: { ja: "霊仙山（観光スポット）", en: "Ryosenzan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3261261232",
    name: "長者森",
    category: "sightseeing",
    location: { lat: 34.007401, lng: 132.844797 },
    localizedDescriptions: { ja: "長者森（観光スポット）", en: "Mount Tyojamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3261293431",
    name: "無宗天山",
    category: "sightseeing",
    location: { lat: 34.038697, lng: 132.892364 },
    localizedDescriptions: { ja: "無宗天山（観光スポット）", en: "Mushode (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267197638",
    name: "瓶ヶ森",
    category: "sightseeing",
    location: { lat: 33.794612, lng: 133.193251 },
    localizedDescriptions: { ja: "瓶ヶ森（観光スポット）", en: "Mt. Kamegamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267197640",
    name: "筒上山",
    category: "sightseeing",
    location: { lat: 33.731943, lng: 133.161103 },
    localizedDescriptions: { ja: "筒上山（観光スポット）", en: "Mt. Tsutsujo (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313211",
    name: "赤星山",
    category: "sightseeing",
    location: { lat: 33.919373, lng: 133.457953 },
    localizedDescriptions: { ja: "赤星山（観光スポット）", en: "Mt. Akaboshi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313212",
    name: "東赤石山",
    category: "sightseeing",
    location: { lat: 33.875091, lng: 133.37503 },
    localizedDescriptions: { ja: "東赤石山（観光スポット）", en: "Mt. Higashi-Akaishi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313213",
    name: "ニノ森",
    category: "sightseeing",
    location: { lat: 33.758559, lng: 133.093766 },
    localizedDescriptions: { ja: "ニノ森（観光スポット）", en: "Mt. Ninomori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313214",
    name: "石墨山",
    category: "sightseeing",
    location: { lat: 33.733786, lng: 132.984647 },
    localizedDescriptions: { ja: "石墨山（観光スポット）", en: "Mt. Ishizumi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313215",
    name: "東三方ヶ森",
    category: "sightseeing",
    location: { lat: 33.902792, lng: 132.959803 },
    localizedDescriptions: { ja: "東三方ヶ森（観光スポット）", en: "Mt. Higashi-Sanpogamori (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313216",
    name: "高縄山",
    category: "sightseeing",
    location: { lat: 33.945803, lng: 132.850106 },
    localizedDescriptions: { ja: "高縄山（観光スポット）", en: "Mt. Takanawa (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313218",
    name: "御在所山",
    category: "sightseeing",
    location: { lat: 33.344008, lng: 132.755788 },
    localizedDescriptions: { ja: "御在所山（観光スポット）", en: "Mt. Gozaisho (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313219",
    name: "三本杭",
    category: "sightseeing",
    location: { lat: 33.188252, lng: 132.63539 },
    localizedDescriptions: { ja: "三本杭（観光スポット）", en: "Mt. Sanbongui (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313220",
    name: "高月山",
    category: "sightseeing",
    location: { lat: 33.208732, lng: 132.634644 },
    localizedDescriptions: { ja: "高月山（観光スポット）", en: "Mt. Takatsuki (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313221",
    name: "障子山",
    category: "sightseeing",
    location: { lat: 33.70534, lng: 132.765222 },
    localizedDescriptions: { ja: "障子山（観光スポット）", en: "Mt. Shoji (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313222",
    name: "壺神山",
    category: "sightseeing",
    location: { lat: 33.605561, lng: 132.554628 },
    localizedDescriptions: { ja: "壺神山（観光スポット）", en: "Mt. Tsubogami (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3267313223",
    name: "出石山",
    category: "sightseeing",
    location: { lat: 33.534951, lng: 132.465225 },
    localizedDescriptions: { ja: "出石山（観光スポット）", en: "Mt. Izushi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3283370102",
    name: "鷲ヶ頭山",
    category: "sightseeing",
    location: { lat: 34.239112, lng: 133.021423 },
    localizedDescriptions: { ja: "鷲ヶ頭山（観光スポット）", en: "Mt. Washigato (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3439339480",
    name: "権現山",
    category: "sightseeing",
    location: { lat: 33.445278, lng: 132.239933 },
    localizedDescriptions: { ja: "権現山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3439339481",
    name: "見晴山",
    category: "sightseeing",
    location: { lat: 33.433018, lng: 132.206497 },
    localizedDescriptions: { ja: "見晴山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3559946886",
    name: "犬尾山",
    category: "sightseeing",
    location: { lat: 33.274369, lng: 132.538196 },
    localizedDescriptions: { ja: "犬尾山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3562554936",
    name: "遠見山",
    category: "sightseeing",
    location: { lat: 33.271923, lng: 132.55449 },
    localizedDescriptions: { ja: "遠見山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3584908827",
    name: "御殿山",
    category: "sightseeing",
    location: { lat: 33.287093, lng: 132.538513 },
    localizedDescriptions: { ja: "御殿山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3589050991",
    name: "槇の山(地四国山)",
    category: "sightseeing",
    location: { lat: 33.253406, lng: 132.55649 },
    localizedDescriptions: { ja: "槇の山(地四国山)（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3697952629",
    name: "史跡今治城跡",
    category: "sightseeing",
    location: { lat: 34.06386, lng: 133.006167 },
    localizedDescriptions: { ja: "史跡今治城跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3697968018",
    name: "今治綿業の父　矢野七三郎について",
    category: "sightseeing",
    location: { lat: 34.06364, lng: 133.007635 },
    localizedDescriptions: { ja: "今治綿業の父　矢野七三郎について（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3697968020",
    name: "原爆死没者慰霊碑",
    category: "sightseeing",
    location: { lat: 34.063861, lng: 133.008521 },
    localizedDescriptions: { ja: "原爆死没者慰霊碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3697968021",
    name: "吹揚神社",
    category: "sightseeing",
    location: { lat: 34.064583, lng: 133.008151 },
    localizedDescriptions: { ja: "吹揚神社（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3697968022",
    name: "指定史跡今治城跡",
    category: "sightseeing",
    location: { lat: 34.064463, lng: 133.00824 },
    localizedDescriptions: { ja: "指定史跡今治城跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3697968023",
    name: "檜垣俊幸翁",
    category: "sightseeing",
    location: { lat: 34.064374, lng: 133.00808 },
    localizedDescriptions: { ja: "檜垣俊幸翁（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3697968225",
    name: "藤堂高虎像",
    category: "sightseeing",
    location: { lat: 34.063915, lng: 133.007076 },
    localizedDescriptions: { ja: "藤堂高虎像（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698023621",
    name: "忠魂碑",
    category: "sightseeing",
    location: { lat: 33.509914, lng: 132.541154 },
    localizedDescriptions: { ja: "忠魂碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698023622",
    name: "日露戦役記念",
    category: "sightseeing",
    location: { lat: 33.509408, lng: 132.541951 },
    localizedDescriptions: { ja: "日露戦役記念（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698023626",
    name: "窮無烈光",
    category: "sightseeing",
    location: { lat: 33.509407, lng: 132.541731 },
    localizedDescriptions: { ja: "窮無烈光（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698023627",
    name: "紀元二千六百年記念",
    category: "sightseeing",
    location: { lat: 33.509511, lng: 132.541833 },
    localizedDescriptions: { ja: "紀元二千六百年記念（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698156598",
    name: "大洲城下台所",
    category: "sightseeing",
    location: { lat: 33.508736, lng: 132.541361 },
    localizedDescriptions: { ja: "大洲城下台所（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698156603",
    name: "近江商人中江藤樹先生",
    category: "sightseeing",
    location: { lat: 33.509291, lng: 132.540279 },
    localizedDescriptions: { ja: "近江商人中江藤樹先生（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698156604",
    name: "重要文化財　大洲城三の丸南隅櫓",
    category: "sightseeing",
    location: { lat: 33.50682, lng: 132.540806 },
    localizedDescriptions: { ja: "重要文化財　大洲城三の丸南隅櫓（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698156605",
    name: "重要文化財　大洲城苧綿櫓",
    category: "sightseeing",
    location: { lat: 33.508559, lng: 132.542526 },
    localizedDescriptions: { ja: "重要文化財　大洲城苧綿櫓（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698156606",
    name: "題認字",
    category: "sightseeing",
    location: { lat: 33.509467, lng: 132.540433 },
    localizedDescriptions: { ja: "題認字（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698448508",
    name: "宇和島城",
    category: "sightseeing",
    location: { lat: 33.219731, lng: 132.564662 },
    localizedDescriptions: { ja: "宇和島城（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698522670",
    name: "中井コッフ歌碑",
    category: "sightseeing",
    location: { lat: 33.220872, lng: 132.563471 },
    localizedDescriptions: { ja: "中井コッフ歌碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698522671",
    name: "児島惟謙先生",
    category: "sightseeing",
    location: { lat: 33.218108, lng: 132.564279 },
    localizedDescriptions: { ja: "児島惟謙先生（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3698522678",
    name: "長門丸跡",
    category: "sightseeing",
    location: { lat: 33.220759, lng: 132.563495 },
    localizedDescriptions: { ja: "長門丸跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3702737277",
    name: "重要文化財 紫竹門東塀",
    category: "sightseeing",
    location: { lat: 33.845242, lng: 132.765747 },
    localizedDescriptions: { ja: "重要文化財 紫竹門東塀（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3771316589",
    name: "積善山",
    category: "sightseeing",
    location: { lat: 34.256728, lng: 133.147339 },
    localizedDescriptions: { ja: "積善山（観光スポット）", en: "Mt. Sekizen (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3771346452",
    name: "三山",
    category: "sightseeing",
    location: { lat: 34.280426, lng: 133.228123 },
    localizedDescriptions: { ja: "三山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3771346453",
    name: "久司山",
    category: "sightseeing",
    location: { lat: 34.244333, lng: 133.206021 },
    localizedDescriptions: { ja: "久司山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3771346454",
    name: "古法皇山",
    category: "sightseeing",
    location: { lat: 34.266812, lng: 133.212132 },
    localizedDescriptions: { ja: "古法皇山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3771346455",
    name: "石灰山",
    category: "sightseeing",
    location: { lat: 34.263361, lng: 133.207442 },
    localizedDescriptions: { ja: "石灰山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3771346456",
    name: "立石山",
    category: "sightseeing",
    location: { lat: 34.280946, lng: 133.172805 },
    localizedDescriptions: { ja: "立石山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-3771348357",
    name: "鉢巻山",
    category: "sightseeing",
    location: { lat: 34.260589, lng: 133.178652 },
    localizedDescriptions: { ja: "鉢巻山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4073547736",
    name: "豊受山",
    category: "sightseeing",
    location: { lat: 33.929199, lng: 133.478937 },
    localizedDescriptions: { ja: "豊受山（観光スポット）", en: "Mt. Toyouke (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4074921491",
    name: "翠波高原展望台",
    category: "sightseeing",
    location: { lat: 33.940407, lng: 133.534883 },
    localizedDescriptions: { ja: "翠波高原展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4075039159",
    name: "翠波峰北峰展望台",
    category: "sightseeing",
    location: { lat: 33.943506, lng: 133.532607 },
    localizedDescriptions: { ja: "翠波峰北峰展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4075039762",
    name: "翠波峰西峰展望台",
    category: "sightseeing",
    location: { lat: 33.942015, lng: 133.536054 },
    localizedDescriptions: { ja: "翠波峰西峰展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4075040504",
    name: "翠波峰東峰展望台",
    category: "sightseeing",
    location: { lat: 33.942399, lng: 133.539646 },
    localizedDescriptions: { ja: "翠波峰東峰展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4079352019",
    name: "関ノ戸峠",
    category: "sightseeing",
    location: { lat: 33.936759, lng: 133.366684 },
    localizedDescriptions: { ja: "関ノ戸峠（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4107819006",
    name: "新宮あじさいの里展望所",
    category: "sightseeing",
    location: { lat: 33.955549, lng: 133.66982 },
    localizedDescriptions: { ja: "新宮あじさいの里展望所（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4163618047",
    name: "宇和島鉄道1号型機関車",
    category: "sightseeing",
    location: { lat: 33.225284, lng: 132.567488 },
    localizedDescriptions: { ja: "宇和島鉄道1号型機関車（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4441621313",
    name: "皿山展望台",
    category: "sightseeing",
    location: { lat: 33.976784, lng: 132.688437 },
    localizedDescriptions: { ja: "皿山展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4472133889",
    name: "遊子水荷浦",
    category: "sightseeing",
    location: { lat: 33.203001, lng: 132.453481 },
    localizedDescriptions: { ja: "遊子水荷浦（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4497671196",
    name: "バンビーズ天山",
    category: "sightseeing",
    location: { lat: 33.824116, lng: 132.780125 },
    localizedDescriptions: { ja: "バンビーズ天山（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "24/7"
  },
  {
    id: "osm-node-4523600452",
    name: "愛媛大学ミュージアム",
    category: "sightseeing",
    location: { lat: 33.849902, lng: 132.771471 },
    localizedDescriptions: { ja: "愛媛大学ミュージアム（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "10:00-16:30",
    website: "https://www.ehime-u.ac.jp/overview/facilities/museum/"
  },
  {
    id: "osm-node-4663300561",
    name: "カレイ山展望台",
    category: "sightseeing",
    location: { lat: 34.184069, lng: 133.070445 },
    localizedDescriptions: { ja: "カレイ山展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4680152767",
    name: "亀老山展望公園",
    category: "sightseeing",
    location: { lat: 34.11993, lng: 133.033502 },
    localizedDescriptions: { ja: "しまなみ海道の来島海峡大橋を一望できる" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4681426532",
    name: "御三戸獄",
    category: "sightseeing",
    location: { lat: 33.613334, lng: 132.977139 },
    localizedDescriptions: { ja: "御三戸獄（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4703659176",
    name: "糸山公園展望台",
    category: "sightseeing",
    location: { lat: 34.113311, lng: 132.976836 },
    localizedDescriptions: { ja: "来島海峡大橋が目の前にあり、見応えある。" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4722056606",
    name: "城山",
    category: "sightseeing",
    location: { lat: 34.175514, lng: 133.323732 },
    localizedDescriptions: { ja: "城山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4727691645",
    name: "金山城",
    category: "sightseeing",
    location: { lat: 33.301123, lng: 132.597163 },
    localizedDescriptions: { ja: "金山城（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4943286722",
    name: "しまなみ海道70km（今治-尾道）6島7橋",
    category: "sightseeing",
    location: { lat: 34.244664, lng: 133.073354 },
    localizedDescriptions: { ja: "しまなみ海道70km（今治-尾道）6島7橋（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4946461825",
    name: "おおず赤煉瓦館",
    category: "sightseeing",
    location: { lat: 33.507816, lng: 132.546929 },
    localizedDescriptions: { ja: "おおず赤煉瓦館（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:00-17:00"
  },
  {
    id: "osm-node-4946461826",
    name: "臥龍山荘",
    category: "sightseeing",
    location: { lat: 33.50631, lng: 132.550087 },
    localizedDescriptions: { ja: "臥龍山荘（観光スポット）", en: "Garyu Sanso (Mountain Retreat) (sightseeing)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:00-17:00"
  },
  {
    id: "osm-node-4946473021",
    name: "思ひ出倉庫",
    category: "sightseeing",
    location: { lat: 33.508007, lng: 132.547471 },
    localizedDescriptions: { ja: "思ひ出倉庫（観光スポット）", en: "Pokopen Yokocho Memory Alley (sightseeing)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Su 10:00-15:30"
  },
  {
    id: "osm-node-4949813622",
    name: "一本榎",
    category: "sightseeing",
    location: { lat: 33.536566, lng: 132.657483 },
    localizedDescriptions: { ja: "一本榎（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4957709721",
    name: "本谷の棚田",
    category: "sightseeing",
    location: { lat: 33.671366, lng: 132.613877 },
    localizedDescriptions: { ja: "本谷の棚田（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4957749321",
    name: "宇和文化会館",
    category: "sightseeing",
    location: { lat: 33.361599, lng: 132.511849 },
    localizedDescriptions: { ja: "宇和文化会館（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4957764221",
    name: "卯之町の町並み",
    category: "sightseeing",
    location: { lat: 33.363184, lng: 132.514605 },
    localizedDescriptions: { ja: "卯之町の町並み（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4967191121",
    name: "頓田川河川敷の桜",
    category: "sightseeing",
    location: { lat: 34.037366, lng: 133.026571 },
    localizedDescriptions: { ja: "頓田川河川敷の桜（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4969407422",
    name: "泉谷の棚田",
    category: "sightseeing",
    location: { lat: 33.51628, lng: 132.715756 },
    localizedDescriptions: { ja: "泉谷の棚田（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4969421721",
    name: "吉田ふれあい国安の郷",
    category: "sightseeing",
    location: { lat: 33.279211, lng: 132.532581 },
    localizedDescriptions: { ja: "吉田ふれあい国安の郷（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:00-17:00"
  },
  {
    id: "osm-node-4987455021",
    name: "民芸伊予かすり会館",
    category: "sightseeing",
    location: { lat: 33.856688, lng: 132.743733 },
    localizedDescriptions: { ja: "民芸伊予かすり会館（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 08:15-16:00"
  },
  {
    id: "osm-node-5009743521",
    name: "野村農業公園ほわいとファーム",
    category: "sightseeing",
    location: { lat: 33.357863, lng: 132.63385 },
    localizedDescriptions: { ja: "野村農業公園ほわいとファーム（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Fr-We 10:00-18:00"
  },
  {
    id: "osm-node-5107737824",
    name: "商店街",
    category: "sightseeing",
    location: { lat: 33.852054, lng: 132.78568 },
    localizedDescriptions: { ja: "商店街（観光スポット）", en: "Shotengai (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5388280722",
    name: "坊ちゃん列車ミュージアム",
    category: "sightseeing",
    location: { lat: 33.835578, lng: 132.764161 },
    localizedDescriptions: { ja: "坊ちゃん列車ミュージアム（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5405045996",
    name: "神南山",
    category: "sightseeing",
    location: { lat: 33.517436, lng: 132.63288 },
    localizedDescriptions: { ja: "神南山（観光スポット）", en: "Mt. Kan-nan (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5479668673",
    name: "伊藤大輔　生誕地",
    category: "sightseeing",
    location: { lat: 33.211787, lng: 132.561676 },
    localizedDescriptions: { ja: "伊藤大輔　生誕地（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5481415912",
    name: "土居通夫　生誕の地",
    category: "sightseeing",
    location: { lat: 33.212083, lng: 132.561449 },
    localizedDescriptions: { ja: "土居通夫　生誕の地（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5481972319",
    name: "植樹記念碑",
    category: "sightseeing",
    location: { lat: 33.226239, lng: 132.559083 },
    localizedDescriptions: { ja: "植樹記念碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5537455925",
    name: "石垣の里 外泊",
    category: "sightseeing",
    location: { lat: 32.937045, lng: 132.478134 },
    localizedDescriptions: { ja: "石垣の里 外泊（観光スポット）", en: "SOTODOMARI, A village known for its beautiful stone walls (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5593308470",
    name: "鹿島展望台",
    category: "sightseeing",
    location: { lat: 33.973782, lng: 132.763796 },
    localizedDescriptions: { ja: "鹿島展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5593381652",
    name: "四国のみち 石碑",
    category: "sightseeing",
    location: { lat: 33.210933, lng: 132.559878 },
    localizedDescriptions: { ja: "四国のみち 石碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5593381653",
    name: "四国のみち 石碑",
    category: "sightseeing",
    location: { lat: 33.210625, lng: 132.56031 },
    localizedDescriptions: { ja: "四国のみち 石碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603123025",
    name: "平和ﾚﾝﾀｶｰ",
    category: "sightseeing",
    location: { lat: 33.830044, lng: 132.706385 },
    localizedDescriptions: { ja: "平和ﾚﾝﾀｶｰ（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603123027",
    name: "四国カルスト",
    category: "sightseeing",
    location: { lat: 33.466859, lng: 132.956701 },
    localizedDescriptions: { ja: "四国カルスト（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603129032",
    name: "道後ミュージック",
    category: "sightseeing",
    location: { lat: 33.852235, lng: 132.784434 },
    localizedDescriptions: { ja: "道後ミュージック（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603129134",
    name: "どーや市場",
    category: "sightseeing",
    location: { lat: 33.459102, lng: 132.418782 },
    localizedDescriptions: { ja: "どーや市場（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603129136",
    name: "秋山兄弟生誕地",
    category: "sightseeing",
    location: { lat: 33.842381, lng: 132.771473 },
    localizedDescriptions: { ja: "秋山兄弟生誕地（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603129138",
    name: "道後ﾊｲｶﾗ通り",
    category: "sightseeing",
    location: { lat: 33.851391, lng: 132.785192 },
    localizedDescriptions: { ja: "道後ﾊｲｶﾗ通り（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603131021",
    name: "テニスコート",
    category: "sightseeing",
    location: { lat: 33.850263, lng: 132.79079 },
    localizedDescriptions: { ja: "テニスコート（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5635161098",
    name: "ぎやまんガラス美術館",
    category: "sightseeing",
    location: { lat: 33.854657, lng: 132.785499 },
    localizedDescriptions: { ja: "ぎやまんガラス美術館（観光スポット）", en: "Giyaman Glass Museum (sightseeing)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Th-Tu 09:00-22:00",
    website: "https://www.dogo-yamanote.com/gardenplace/museum/"
  },
  {
    id: "osm-node-5680623272",
    name: "サイクリストの聖地記念碑",
    category: "sightseeing",
    location: { lat: 34.25539, lng: 133.054682 },
    localizedDescriptions: { ja: "サイクリストの聖地記念碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5697638322",
    name: "振鷺閣",
    category: "sightseeing",
    location: { lat: 33.852104, lng: 132.786432 },
    localizedDescriptions: { ja: "振鷺閣は、松山市の道後温泉本館の屋上にある小さな楼閣と太鼓楼です。白鷺像と伝統的な太鼓が特徴で、温泉の伝説的な起源と地域の伝統を象徴しています。", en: "Shinrokaku (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5701073691",
    name: "垣生城跡",
    category: "sightseeing",
    location: { lat: 33.836439, lng: 132.714891 },
    localizedDescriptions: { ja: "垣生城跡（観光スポット）", en: "Habu-jo Castle Ruins (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5714663324",
    name: "能島城跡",
    category: "sightseeing",
    location: { lat: 34.182965, lng: 133.080999 },
    localizedDescriptions: { ja: "能島城跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6324159602",
    name: "Russia Hei Cemetery ロシア兵墓地",
    category: "sightseeing",
    location: { lat: 33.856631, lng: 132.766597 },
    localizedDescriptions: { ja: "Russia Hei Cemetery ロシア兵墓地（観光スポット）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:00-17:00"
  },
  {
    id: "osm-node-6405001207",
    name: "甘崎城跡",
    category: "sightseeing",
    location: { lat: 34.244706, lng: 133.056486 },
    localizedDescriptions: { ja: "甘崎城跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6458869396",
    name: "御籠島展望所",
    category: "sightseeing",
    location: { lat: 33.343381, lng: 132.01322 },
    localizedDescriptions: { ja: "御籠島展望所（観光スポット）", en: "Mikagojima View Point (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6458869472",
    name: "忠魂碑",
    category: "sightseeing",
    location: { lat: 33.343589, lng: 132.014612 },
    localizedDescriptions: { ja: "忠魂碑（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6571845766",
    name: "鏡山",
    category: "sightseeing",
    location: { lat: 34.263661, lng: 132.971862 },
    localizedDescriptions: { ja: "鏡山（観光スポット）", en: "Mt. Kagami (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6572031570",
    name: "青刈山",
    category: "sightseeing",
    location: { lat: 34.28024, lng: 133.017153 },
    localizedDescriptions: { ja: "青刈山（観光スポット）", en: "Mt. Aogari (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6573167775",
    name: "アテネ陶芸教室",
    category: "sightseeing",
    location: { lat: 33.831006, lng: 132.753409 },
    localizedDescriptions: { ja: "アテネ陶芸教室（観光スポット）", en: "Atene Potteryceramic School (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6618029722",
    name: "横ノ森",
    category: "sightseeing",
    location: { lat: 33.184991, lng: 132.637205 },
    localizedDescriptions: { ja: "横ノ森（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6618029723",
    name: "八面山",
    category: "sightseeing",
    location: { lat: 33.181259, lng: 132.619547 },
    localizedDescriptions: { ja: "八面山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6618029724",
    name: "大久保山",
    category: "sightseeing",
    location: { lat: 33.18476, lng: 132.616061 },
    localizedDescriptions: { ja: "大久保山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6618029725",
    name: "鬼が城山",
    category: "sightseeing",
    location: { lat: 33.190429, lng: 132.609294 },
    localizedDescriptions: { ja: "鬼が城山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6618029726",
    name: "御祝山",
    category: "sightseeing",
    location: { lat: 33.194247, lng: 132.651417 },
    localizedDescriptions: { ja: "御祝山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6847855083",
    name: "津島プレーランド",
    category: "sightseeing",
    location: { lat: 33.124265, lng: 132.502575 },
    localizedDescriptions: { ja: "津島プレーランド（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6868555317",
    name: "松山城跡",
    category: "sightseeing",
    location: { lat: 33.841004, lng: 132.764302 },
    localizedDescriptions: { ja: "松山城跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6897121891",
    name: "ちち山",
    category: "sightseeing",
    location: { lat: 33.831863, lng: 133.284082 },
    localizedDescriptions: { ja: "ちち山（観光スポット）", en: "Mt. Chichi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6979436785",
    name: "開山展望台",
    category: "sightseeing",
    location: { lat: 34.228739, lng: 133.065272 },
    localizedDescriptions: { ja: "開山展望台（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7006600410",
    name: "大頭山",
    category: "sightseeing",
    location: { lat: 34.164198, lng: 133.04754 },
    localizedDescriptions: { ja: "大頭山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7006600411",
    name: "高取山",
    category: "sightseeing",
    location: { lat: 34.160148, lng: 133.077305 },
    localizedDescriptions: { ja: "高取山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7058077370",
    name: "大里山",
    category: "sightseeing",
    location: { lat: 33.970015, lng: 132.60608 },
    localizedDescriptions: { ja: "大里山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7058077372",
    name: "高山",
    category: "sightseeing",
    location: { lat: 33.965005, lng: 132.637123 },
    localizedDescriptions: { ja: "高山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7058077373",
    name: "泰ノ山",
    category: "sightseeing",
    location: { lat: 33.989152, lng: 132.62689 },
    localizedDescriptions: { ja: "泰ノ山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7130251352",
    name: "修行大師",
    category: "sightseeing",
    location: { lat: 33.324621, lng: 132.654991 },
    localizedDescriptions: { ja: "修行大師（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7555880222",
    name: "山下亀三郎翁像",
    category: "sightseeing",
    location: { lat: 33.277797, lng: 132.540999 },
    localizedDescriptions: { ja: "山下亀三郎翁像（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7555880223",
    name: "時観堂跡",
    category: "sightseeing",
    location: { lat: 33.277872, lng: 132.540667 },
    localizedDescriptions: { ja: "時観堂跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990385",
    name: "船ヶ迫岳",
    category: "sightseeing",
    location: { lat: 33.622937, lng: 132.650921 },
    localizedDescriptions: { ja: "船ヶ迫岳（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990386",
    name: "陣が森岳",
    category: "sightseeing",
    location: { lat: 33.62652, lng: 132.680694 },
    localizedDescriptions: { ja: "陣が森岳（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990391",
    name: "黒岩岳",
    category: "sightseeing",
    location: { lat: 33.654504, lng: 132.689492 },
    localizedDescriptions: { ja: "黒岩岳（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990392",
    name: "牛ノ峯",
    category: "sightseeing",
    location: { lat: 33.655022, lng: 132.649237 },
    localizedDescriptions: { ja: "牛ノ峯（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990393",
    name: "黒山",
    category: "sightseeing",
    location: { lat: 33.638954, lng: 132.610635 },
    localizedDescriptions: { ja: "黒山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990394",
    name: "秋葉山",
    category: "sightseeing",
    location: { lat: 33.596632, lng: 132.606225 },
    localizedDescriptions: { ja: "秋葉山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990395",
    name: "足山",
    category: "sightseeing",
    location: { lat: 33.606229, lng: 132.515534 },
    localizedDescriptions: { ja: "足山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990396",
    name: "妙見山",
    category: "sightseeing",
    location: { lat: 33.55917, lng: 132.600056 },
    localizedDescriptions: { ja: "妙見山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990398",
    name: "感応寺山",
    category: "sightseeing",
    location: { lat: 33.561218, lng: 132.579628 },
    localizedDescriptions: { ja: "感応寺山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7601990400",
    name: "滝山",
    category: "sightseeing",
    location: { lat: 33.613779, lng: 132.544759 },
    localizedDescriptions: { ja: "滝山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607816786",
    name: "皿が森",
    category: "sightseeing",
    location: { lat: 33.599474, lng: 132.516693 },
    localizedDescriptions: { ja: "皿が森（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607816794",
    name: "秦皇山",
    category: "sightseeing",
    location: { lat: 33.662157, lng: 132.726924 },
    localizedDescriptions: { ja: "秦皇山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607816795",
    name: "谷上山",
    category: "sightseeing",
    location: { lat: 33.735333, lng: 132.731731 },
    localizedDescriptions: { ja: "谷上山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607816797",
    name: "階上山",
    category: "sightseeing",
    location: { lat: 33.685916, lng: 132.760881 },
    localizedDescriptions: { ja: "階上山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607816803",
    name: "明神山",
    category: "sightseeing",
    location: { lat: 33.69886, lng: 132.683194 },
    localizedDescriptions: { ja: "明神山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607947678",
    name: "三郷の辻",
    category: "sightseeing",
    location: { lat: 33.640723, lng: 132.836775 },
    localizedDescriptions: { ja: "三郷の辻（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607955486",
    name: "コクゾ峰",
    category: "sightseeing",
    location: { lat: 33.629736, lng: 132.778198 },
    localizedDescriptions: { ja: "コクゾ峰（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607955490",
    name: "蒲山",
    category: "sightseeing",
    location: { lat: 33.64559, lng: 132.762727 },
    localizedDescriptions: { ja: "蒲山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607955492",
    name: "笠成山",
    category: "sightseeing",
    location: { lat: 33.651298, lng: 132.791319 },
    localizedDescriptions: { ja: "笠成山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607955500",
    name: "城山",
    category: "sightseeing",
    location: { lat: 33.696744, lng: 132.795364 },
    localizedDescriptions: { ja: "城山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7607955501",
    name: "水梨山",
    category: "sightseeing",
    location: { lat: 33.681229, lng: 132.793647 },
    localizedDescriptions: { ja: "水梨山（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7620921198",
    name: "根太山",
    category: "sightseeing",
    location: { lat: 33.497253, lng: 132.58289 },
    localizedDescriptions: { ja: "根太山（観光スポット）", en: "Mt. Nebuto (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7620921209",
    name: "冨士山",
    category: "sightseeing",
    location: { lat: 33.508916, lng: 132.560532 },
    localizedDescriptions: { ja: "冨士山（観光スポット）", en: "Mt. Tomisu (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7632408843",
    name: "廃レストラン 大野城跡",
    category: "sightseeing",
    location: { lat: 33.921328, lng: 133.426533 },
    localizedDescriptions: { ja: "廃レストラン 大野城跡（観光スポット）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7635368296",
    name: "翠波峰",
    category: "sightseeing",
    location: { lat: 33.942659, lng: 133.536214 },
    localizedDescriptions: { ja: "翠波峰（観光スポット）", en: "Mt. Suiha (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7635368308",
    name: "平石山",
    category: "sightseeing",
    location: { lat: 33.95655, lng: 133.590875 },
    localizedDescriptions: { ja: "平石山（観光スポット）", en: "Mt. Hiraishi (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7635368313",
    name: "峰畑山",
    category: "sightseeing",
    location: { lat: 33.983421, lng: 133.682021 },
    localizedDescriptions: { ja: "峰畑山（観光スポット）", en: "Mt. Minebata (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7635368321",
    name: "城山",
    category: "sightseeing",
    location: { lat: 34.012983, lng: 133.567405 },
    localizedDescriptions: { ja: "城山（観光スポット）", en: "Mt. Shiroyama (sightseeing)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-1423707362",
    name: "乗松巖記念館「エスパス２１」",
    category: "onsen",
    location: { lat: 33.833246, lng: 132.780479 },
    localizedDescriptions: { ja: "乗松巖記念館「エスパス２１」（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5472500516",
    name: "黄金湯",
    category: "onsen",
    location: { lat: 34.063904, lng: 133.004759 },
    localizedDescriptions: { ja: "黄金湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5841776205",
    name: "潮湯（海水温浴施設）",
    category: "onsen",
    location: { lat: 34.27963, lng: 133.210934 },
    localizedDescriptions: { ja: "潮湯（海水温浴施設）（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6026617980",
    name: "別子温泉～天空の湯～",
    category: "onsen",
    location: { lat: 33.901117, lng: 133.309332 },
    localizedDescriptions: { ja: "別子温泉～天空の湯～（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6479541833",
    name: "津島やすらぎの里",
    category: "onsen",
    location: { lat: 33.139696, lng: 132.520381 },
    localizedDescriptions: { ja: "津島やすらぎの里（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6479581996",
    name: "森の国 ぽっぽ温泉",
    category: "onsen",
    location: { lat: 33.228396, lng: 132.708434 },
    localizedDescriptions: { ja: "森の国 ぽっぽ温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6479594254",
    name: "游の里温泉;ユートピア宇和",
    category: "onsen",
    location: { lat: 33.358453, lng: 132.617125 },
    localizedDescriptions: { ja: "游の里温泉;ユートピア宇和（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6481798135",
    name: "ふもと温泉;友愛館",
    category: "onsen",
    location: { lat: 33.714721, lng: 132.949698 },
    localizedDescriptions: { ja: "ふもと温泉;友愛館（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-6566820445",
    name: "伊予の湯治場;喜助の湯",
    category: "onsen",
    location: { lat: 33.841041, lng: 132.752812 },
    localizedDescriptions: { ja: "伊予の湯治場;喜助の湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7714381700",
    name: "おみやげどころ 道後 りらっくまの湯",
    category: "onsen",
    location: { lat: 33.851977, lng: 132.786016 },
    localizedDescriptions: { ja: "おみやげどころ 道後 りらっくまの湯（温泉・入浴）", en: "Rilakkuma Dogo Onsen Gift Shop (onsen)" },
    reviews: [],
    imageUrls: [],
    openingHours: "10:00-18:00",
    website: "http://rilakkumasabo.jp"
  },
  {
    id: "osm-node-7984318585",
    name: "湯之谷温泉",
    category: "onsen",
    location: { lat: 33.892918, lng: 133.163913 },
    localizedDescriptions: { ja: "湯之谷温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8289886846",
    name: "本町温泉",
    category: "onsen",
    location: { lat: 34.073377, lng: 132.998992 },
    localizedDescriptions: { ja: "本町温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8296072674",
    name: "鯉池湯",
    category: "onsen",
    location: { lat: 34.053438, lng: 132.989819 },
    localizedDescriptions: { ja: "鯉池湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8321442525",
    name: "せせらぎ交流館",
    category: "onsen",
    location: { lat: 33.984738, lng: 132.94043 },
    localizedDescriptions: { ja: "せせらぎ交流館（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8396825483",
    name: "宝来温泉",
    category: "onsen",
    location: { lat: 34.063066, lng: 132.996153 },
    localizedDescriptions: { ja: "宝来温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10556681595",
    name: "ナニワサウナ",
    category: "onsen",
    location: { lat: 34.066605, lng: 132.994061 },
    localizedDescriptions: { ja: "ナニワサウナ（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10836417476",
    name: "道後放生園足湯",
    category: "onsen",
    location: { lat: 33.850677, lng: 132.78553 },
    localizedDescriptions: { ja: "道後放生園足湯（温泉・入浴）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 06:00-23:00"
  },
  {
    id: "osm-node-10836417487",
    name: "愛媛道後足湯カフェ 坊っちゃん",
    category: "onsen",
    location: { lat: 33.852324, lng: 132.78604 },
    localizedDescriptions: { ja: "愛媛道後足湯カフェ 坊っちゃん（温泉・入浴）", en: "Ashiyu Cafe Botchan Dogo Ehime (onsen)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10862095036",
    name: "道後温泉第四分湯場",
    category: "onsen",
    location: { lat: 33.850926, lng: 132.784608 },
    localizedDescriptions: { ja: "道後温泉第四分湯場（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-231297989",
    name: "古川温泉;湯楽",
    category: "onsen",
    location: { lat: 33.808879, lng: 132.758076 },
    localizedDescriptions: { ja: "古川温泉;湯楽（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-235751036",
    name: "道後温泉本館",
    category: "onsen",
    location: { lat: 33.852067, lng: 132.786405 },
    localizedDescriptions: { ja: "道後温泉本館（温泉・入浴）", en: "Dōgo Onsen (onsen)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 06:00-23:00",
    website: "https://dogo.jp/onsen/honkan"
  },
  {
    id: "osm-way-290527431",
    name: "ふるさと交流館;さくらの湯",
    category: "onsen",
    location: { lat: 33.8031, lng: 132.914523 },
    localizedDescriptions: { ja: "ふるさと交流館;さくらの湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-340383211",
    name: "媛彦温泉",
    category: "onsen",
    location: { lat: 33.827412, lng: 132.800969 },
    localizedDescriptions: { ja: "媛彦温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-340383390",
    name: "星乃岡温泉",
    category: "onsen",
    location: { lat: 33.817842, lng: 132.786473 },
    localizedDescriptions: { ja: "星乃岡温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-340535881",
    name: "見奈良天然温泉;利楽",
    category: "onsen",
    location: { lat: 33.790704, lng: 132.878766 },
    localizedDescriptions: { ja: "見奈良天然温泉;利楽（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-343102421",
    name: "東道後のそらともり",
    category: "onsen",
    location: { lat: 33.818606, lng: 132.804807 },
    localizedDescriptions: { ja: "東道後のそらともり（温泉・入浴）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su,PH 05:00-01:00"
  },
  {
    id: "osm-way-343102892",
    name: "東道後温泉;久米之癒",
    category: "onsen",
    location: { lat: 33.814046, lng: 132.803062 },
    localizedDescriptions: { ja: "東道後温泉;久米之癒（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-378061657",
    name: "クアハウス今治",
    category: "onsen",
    location: { lat: 33.994087, lng: 133.053337 },
    localizedDescriptions: { ja: "クアハウス今治（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-443587702",
    name: "椿交流館;椿温泉こまつ",
    category: "onsen",
    location: { lat: 33.883169, lng: 133.108527 },
    localizedDescriptions: { ja: "椿交流館;椿温泉こまつ（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-443714705",
    name: "天山トロン温泉",
    category: "onsen",
    location: { lat: 33.823937, lng: 132.781732 },
    localizedDescriptions: { ja: "天山トロン温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-445479530",
    name: "星乃岡温泉;千湯館",
    category: "onsen",
    location: { lat: 33.816975, lng: 132.786088 },
    localizedDescriptions: { ja: "星乃岡温泉;千湯館（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-453018271",
    name: "ゆらり内海",
    category: "onsen",
    location: { lat: 33.040198, lng: 132.488167 },
    localizedDescriptions: { ja: "ゆらり内海（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-617479509",
    name: "少彦名温泉 大洲 臥龍の湯",
    category: "onsen",
    location: { lat: 33.503267, lng: 132.549587 },
    localizedDescriptions: { ja: "少彦名温泉 大洲 臥龍の湯（温泉・入浴）" },
    reviews: [],
    imageUrls: [],
    openingHours: "09:30-21:50; Mo[3] off",
    website: "https://www.garyunoyu.com/"
  },
  {
    id: "osm-way-631599341",
    name: "湯の里小町温泉;しこくや",
    category: "onsen",
    location: { lat: 33.876156, lng: 133.064659 },
    localizedDescriptions: { ja: "湯の里小町温泉;しこくや（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-676620939",
    name: "東予温泉;いやしのリゾート",
    category: "onsen",
    location: { lat: 33.922555, lng: 133.080014 },
    localizedDescriptions: { ja: "東予温泉;いやしのリゾート（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690532724",
    name: "一本松温泉あけぼの荘",
    category: "onsen",
    location: { lat: 32.967904, lng: 132.658354 },
    localizedDescriptions: { ja: "一本松温泉あけぼの荘（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690594335",
    name: "祓川温泉",
    category: "onsen",
    location: { lat: 33.083233, lng: 132.65441 },
    localizedDescriptions: { ja: "祓川温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690598993",
    name: "三間町老人憩の家",
    category: "onsen",
    location: { lat: 33.284289, lng: 132.665655 },
    localizedDescriptions: { ja: "三間町老人憩の家（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690600252",
    name: "宝泉坊温泉",
    category: "onsen",
    location: { lat: 33.364914, lng: 132.791666 },
    localizedDescriptions: { ja: "宝泉坊温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690600253",
    name: "クアテルメ宝泉坊",
    category: "onsen",
    location: { lat: 33.364755, lng: 132.792001 },
    localizedDescriptions: { ja: "クアテルメ宝泉坊（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690605548",
    name: "はま湯",
    category: "onsen",
    location: { lat: 33.313152, lng: 132.443757 },
    localizedDescriptions: { ja: "はま湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690606216",
    name: "八幡浜黒湯温泉 みなと湯",
    category: "onsen",
    location: { lat: 33.463177, lng: 132.422769 },
    localizedDescriptions: { ja: "八幡浜黒湯温泉 みなと湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690606564",
    name: "伊方町健康交流施設;亀ヶ池温泉",
    category: "onsen",
    location: { lat: 33.465176, lng: 132.281033 },
    localizedDescriptions: { ja: "伊方町健康交流施設;亀ヶ池温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690654727",
    name: "長浜なぎさの湯",
    category: "onsen",
    location: { lat: 33.61549, lng: 132.479152 },
    localizedDescriptions: { ja: "長浜なぎさの湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699304464",
    name: "道後さや温泉;ゆらら 家族の湯",
    category: "onsen",
    location: { lat: 33.830595, lng: 132.724476 },
    localizedDescriptions: { ja: "道後さや温泉;ゆらら 家族の湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699304575",
    name: "道後さや温泉;ゆらら",
    category: "onsen",
    location: { lat: 33.83146, lng: 132.724416 },
    localizedDescriptions: { ja: "道後さや温泉;ゆらら（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699306131",
    name: "久万の台温泉",
    category: "onsen",
    location: { lat: 33.856862, lng: 132.744395 },
    localizedDescriptions: { ja: "久万の台温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699306768",
    name: "谷町リゾート;ゆとりあ温泉",
    category: "onsen",
    location: { lat: 33.87844, lng: 132.752365 },
    localizedDescriptions: { ja: "谷町リゾート;ゆとりあ温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699344910",
    name: "南道後温泉;ていれぎの湯",
    category: "onsen",
    location: { lat: 33.780515, lng: 132.818403 },
    localizedDescriptions: { ja: "南道後温泉;ていれぎの湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699356400",
    name: "しまなみ温泉;喜助の湯",
    category: "onsen",
    location: { lat: 34.062939, lng: 132.992459 },
    localizedDescriptions: { ja: "しまなみ温泉;喜助の湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699375326",
    name: "天然温泉;かみとくの湯",
    category: "onsen",
    location: { lat: 34.039777, lng: 133.012028 },
    localizedDescriptions: { ja: "天然温泉;かみとくの湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699378257",
    name: "西条天然温泉;ひうちの湯",
    category: "onsen",
    location: { lat: 33.933172, lng: 133.199439 },
    localizedDescriptions: { ja: "西条天然温泉;ひうちの湯（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699404887",
    name: "マーレ・グラッシア大三島",
    category: "onsen",
    location: { lat: 34.241657, lng: 132.993872 },
    localizedDescriptions: { ja: "マーレ・グラッシア大三島（温泉・入浴）", en: "Mare Gracia Omishima (onsen)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699641186",
    name: "湯ノ浦温泉;四季の湯 ビア工房",
    category: "onsen",
    location: { lat: 33.995249, lng: 133.054792 },
    localizedDescriptions: { ja: "湯ノ浦温泉;四季の湯 ビア工房（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699652272",
    name: "道前渓温泉",
    category: "onsen",
    location: { lat: 33.855522, lng: 133.01173 },
    localizedDescriptions: { ja: "道前渓温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-699672322",
    name: "新居浜温泉;パナス",
    category: "onsen",
    location: { lat: 33.921817, lng: 133.293828 },
    localizedDescriptions: { ja: "新居浜温泉;パナス（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-732001496",
    name: "椿の湯",
    category: "onsen",
    location: { lat: 33.85239, lng: 132.784991 },
    localizedDescriptions: { ja: "椿の湯（温泉・入浴）", en: "Tsubaki-no-yu (onsen)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 06:30-23:00"
  },
  {
    id: "osm-way-894293898",
    name: "しらさぎ温泉",
    category: "onsen",
    location: { lat: 34.052677, lng: 132.997426 },
    localizedDescriptions: { ja: "しらさぎ温泉（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-1023281614",
    name: "広見町老人保養センター清水荘",
    category: "onsen",
    location: { lat: 33.303393, lng: 132.691439 },
    localizedDescriptions: { ja: "広見町老人保養センター清水荘（温泉・入浴）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-1291330158",
    name: "飛鳥乃湯",
    category: "onsen",
    location: { lat: 33.852343, lng: 132.784673 },
    localizedDescriptions: { ja: "飛鳥乃湯（温泉・入浴）", en: "Asuka-no-yu (onsen)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 06:00-23:00"
  },
  {
    id: "osm-node-2312160126",
    name: "母恵夢",
    category: "souvenir",
    location: { lat: 33.845242, lng: 132.758536 },
    localizedDescriptions: { ja: "母恵夢（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-2385770624",
    name: "一六本舗 はなみずき通り店",
    category: "souvenir",
    location: { lat: 33.811305, lng: 132.765404 },
    localizedDescriptions: { ja: "一六本舗 はなみずき通り店（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "08:30-20:00"
  },
  {
    id: "osm-node-2385850163",
    name: "ハタダ はなみずき通り古川店",
    category: "souvenir",
    location: { lat: 33.812961, lng: 132.765808 },
    localizedDescriptions: { ja: "ハタダ はなみずき通り古川店（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "08:30-20:00"
  },
  {
    id: "osm-node-2787110062",
    name: "今治タオル本店",
    category: "souvenir",
    location: { lat: 34.061557, lng: 133.016311 },
    localizedDescriptions: { ja: "今治タオル本店（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    website: "http://www.imabari-texport.com/feel/"
  },
  {
    id: "osm-node-4794242522",
    name: "畑田本舗鴨川店",
    category: "souvenir",
    location: { lat: 33.874157, lng: 132.751859 },
    localizedDescriptions: { ja: "畑田本舗鴨川店（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4847284621",
    name: "一六本舗",
    category: "souvenir",
    location: { lat: 33.838896, lng: 132.769477 },
    localizedDescriptions: { ja: "一六本舗（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-4847284622",
    name: "ﾉﾏﾉﾏ",
    category: "souvenir",
    location: { lat: 33.838142, lng: 132.769457 },
    localizedDescriptions: { ja: "ﾉﾏﾉﾏ（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 10:00-20:00"
  },
  {
    id: "osm-node-4946461821",
    name: "フレスポ大洲(大型購物中心)",
    category: "souvenir",
    location: { lat: 33.531427, lng: 132.577288 },
    localizedDescriptions: { ja: "フレスポ大洲(大型購物中心)（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "24/7"
  },
  {
    id: "osm-node-4947996621",
    name: "大洲まちの駅あさもや",
    category: "souvenir",
    location: { lat: 33.506598, lng: 132.546739 },
    localizedDescriptions: { ja: "大洲まちの駅あさもや（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:00-18:00"
  },
  {
    id: "osm-node-4948031921",
    name: "大森和蝋燭屋",
    category: "souvenir",
    location: { lat: 33.553909, lng: 132.653104 },
    localizedDescriptions: { ja: "大森和蝋燭屋（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "We-Th, Sa-Mo 09:00-12:00, 13:00-17:00"
  },
  {
    id: "osm-node-4949862122",
    name: "森文醸造株式会社-醬油味噌",
    category: "souvenir",
    location: { lat: 33.553634, lng: 132.653872 },
    localizedDescriptions: { ja: "森文醸造株式会社-醬油味噌（みやげ・物産）", en: "Moribun (souvenir)" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 08:00-17:00"
  },
  {
    id: "osm-node-4949865321",
    name: "（株）五十崎社中 工房- 和紙",
    category: "souvenir",
    location: { lat: 33.535263, lng: 132.66623 },
    localizedDescriptions: { ja: "（株）五十崎社中 工房- 和紙（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:00-17:00"
  },
  {
    id: "osm-node-5603123022",
    name: "みかんの木",
    category: "souvenir",
    location: { lat: 33.852026, lng: 132.785484 },
    localizedDescriptions: { ja: "みかんの木（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "8:30-22:00",
    website: "http://dogo.co.jp/mikan.html"
  },
  {
    id: "osm-node-5603129135",
    name: "アゴラマルシェ",
    category: "souvenir",
    location: { lat: 33.458521, lng: 132.418859 },
    localizedDescriptions: { ja: "アゴラマルシェ（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-5603129922",
    name: "十五万石",
    category: "souvenir",
    location: { lat: 33.852135, lng: 132.785388 },
    localizedDescriptions: { ja: "十五万石（みやげ・物産）", en: "Jugomangoku (souvenir)" },
    reviews: [],
    imageUrls: [],
    openingHours: "8:30-22:00",
    website: "http://www.dogo.co.jp/zyugo.html"
  },
  {
    id: "osm-node-5603129923",
    name: "六時屋",
    category: "souvenir",
    location: { lat: 33.851989, lng: 132.785145 },
    localizedDescriptions: { ja: "六時屋（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "9:00-21:00"
  },
  {
    id: "osm-node-5644001885",
    name: "一六本舗",
    category: "souvenir",
    location: { lat: 33.852091, lng: 132.785993 },
    localizedDescriptions: { ja: "一六本舗（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "7:30-22:00"
  },
  {
    id: "osm-node-5644001886",
    name: "田中玉宝堂",
    category: "souvenir",
    location: { lat: 33.852009, lng: 132.785872 },
    localizedDescriptions: { ja: "田中玉宝堂（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "8:30-22:00"
  },
  {
    id: "osm-node-5644001892",
    name: "もち焼せんべい",
    category: "souvenir",
    location: { lat: 33.852014, lng: 132.785663 },
    localizedDescriptions: { ja: "もち焼せんべい（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "9:00-21:30"
  },
  {
    id: "osm-node-5644001893",
    name: "鳩屋",
    category: "souvenir",
    location: { lat: 33.852016, lng: 132.785596 },
    localizedDescriptions: { ja: "鳩屋（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "8:00-21:30"
  },
  {
    id: "osm-node-5644001899",
    name: "どんぐり共和国",
    category: "souvenir",
    location: { lat: 33.852108, lng: 132.785631 },
    localizedDescriptions: { ja: "どんぐり共和国（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "8:30-22:00",
    website: "https://www.dogo.co.jp/donguri"
  },
  {
    id: "osm-node-5644001909",
    name: "寿美屋",
    category: "souvenir",
    location: { lat: 33.851567, lng: 132.785147 },
    localizedDescriptions: { ja: "寿美屋（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "9:00-22:00"
  },
  {
    id: "osm-node-5644001911",
    name: "ひめや",
    category: "souvenir",
    location: { lat: 33.851683, lng: 132.785145 },
    localizedDescriptions: { ja: "ひめや（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "9:00-22:00",
    website: "http://dogo-himeya.com/"
  },
  {
    id: "osm-node-5644001914",
    name: "絣屋本店",
    category: "souvenir",
    location: { lat: 33.851882, lng: 132.78515 },
    localizedDescriptions: { ja: "絣屋本店（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "8:30-22:00"
  },
  {
    id: "osm-node-6648581285",
    name: "ルフランルフラン",
    category: "souvenir",
    location: { lat: 33.806713, lng: 132.765371 },
    localizedDescriptions: { ja: "ルフランルフラン（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Th-Tu 10:00-19:00"
  },
  {
    id: "osm-node-7022891436",
    name: "みねお",
    category: "souvenir",
    location: { lat: 33.457691, lng: 132.431504 },
    localizedDescriptions: { ja: "みねお（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7088257670",
    name: "特産物センター",
    category: "souvenir",
    location: { lat: 34.254606, lng: 133.054338 },
    localizedDescriptions: { ja: "特産物センター（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7090629719",
    name: "おみやげナガノ",
    category: "souvenir",
    location: { lat: 34.249045, lng: 133.004954 },
    localizedDescriptions: { ja: "おみやげナガノ（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7090629765",
    name: "せとうち茶屋",
    category: "souvenir",
    location: { lat: 34.247786, lng: 133.003146 },
    localizedDescriptions: { ja: "せとうち茶屋（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7108240887",
    name: "一六茶寮",
    category: "souvenir",
    location: { lat: 33.852189, lng: 132.786044 },
    localizedDescriptions: { ja: "一六茶寮（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-7553533250",
    name: "駒屋",
    category: "souvenir",
    location: { lat: 33.276814, lng: 132.54141 },
    localizedDescriptions: { ja: "駒屋（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8226878176",
    name: "大和みやげものセンター",
    category: "souvenir",
    location: { lat: 34.069037, lng: 133.005058 },
    localizedDescriptions: { ja: "大和みやげものセンター（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8227646669",
    name: "まちなか広場 ほんからどんどん",
    category: "souvenir",
    location: { lat: 34.067018, lng: 133.001349 },
    localizedDescriptions: { ja: "まちなか広場 ほんからどんどん（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8239106224",
    name: "ハタダ",
    category: "souvenir",
    location: { lat: 32.958799, lng: 132.565948 },
    localizedDescriptions: { ja: "ハタダ（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8301204982",
    name: "ラ・シャンドシエル",
    category: "souvenir",
    location: { lat: 34.047981, lng: 132.992059 },
    localizedDescriptions: { ja: "ラ・シャンドシエル（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-8938554695",
    name: "えひめ愛顔の観光物産館",
    category: "souvenir",
    location: { lat: 33.843226, lng: 132.771235 },
    localizedDescriptions: { ja: "えひめ愛顔の観光物産館（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 9:00-18:00"
  },
  {
    id: "osm-node-10316942401",
    name: "シャトレーゼ",
    category: "souvenir",
    location: { lat: 34.062013, lng: 132.992039 },
    localizedDescriptions: { ja: "シャトレーゼ（みやげ・物産）", en: "Chateraise (souvenir)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10836417482",
    name: "山田屋まんじゅう",
    category: "souvenir",
    location: { lat: 33.852643, lng: 132.78674 },
    localizedDescriptions: { ja: "山田屋まんじゅう（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10836417488",
    name: "10 FACTORY",
    category: "souvenir",
    location: { lat: 33.850867, lng: 132.785135 },
    localizedDescriptions: { ja: "10 FACTORY（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Mo-Su 09:30-19:30"
  },
  {
    id: "osm-node-10836417493",
    name: "菓子屋 艶",
    category: "souvenir",
    location: { lat: 33.850484, lng: 132.78548 },
    localizedDescriptions: { ja: "菓子屋 艶（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10839392511",
    name: "ヒーロー",
    category: "souvenir",
    location: { lat: 33.843001, lng: 132.770818 },
    localizedDescriptions: { ja: "ヒーロー（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10839392523",
    name: "芋ぴっぴ。",
    category: "souvenir",
    location: { lat: 33.843078, lng: 132.771103 },
    localizedDescriptions: { ja: "芋ぴっぴ。（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-10839392527",
    name: "松山チーズケーキラボ",
    category: "souvenir",
    location: { lat: 33.843174, lng: 132.770941 },
    localizedDescriptions: { ja: "松山チーズケーキラボ（みやげ・物産）", en: "Matsuyama Cheese Cake Labo (souvenir)" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-11518918751",
    name: "べニールいまばり",
    category: "souvenir",
    location: { lat: 34.035148, lng: 132.97893 },
    localizedDescriptions: { ja: "べニールいまばり（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-11527277685",
    name: "村や",
    category: "souvenir",
    location: { lat: 34.066498, lng: 132.931628 },
    localizedDescriptions: { ja: "村や（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-11939091174",
    name: "もち吉 宇和島店",
    category: "souvenir",
    location: { lat: 33.22548, lng: 132.564346 },
    localizedDescriptions: { ja: "もち吉 宇和島店（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-11985055506",
    name: "菓子工房ゲーテ 本店",
    category: "souvenir",
    location: { lat: 33.224956, lng: 132.55856 },
    localizedDescriptions: { ja: "菓子工房ゲーテ 本店（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-12002015428",
    name: "カンパチ",
    category: "souvenir",
    location: { lat: 33.843854, lng: 132.771744 },
    localizedDescriptions: { ja: "カンパチ（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-12039264639",
    name: "久遠チョコレート 宇和島店",
    category: "souvenir",
    location: { lat: 33.218525, lng: 132.567125 },
    localizedDescriptions: { ja: "久遠チョコレート 宇和島店（みやげ・物産）" },
    reviews: [],
    imageUrls: [],
    openingHours: "Tu-Su 10:00-18:30",
    website: "https://quon-choco.com/"
  },
  {
    id: "osm-node-12289070264",
    name: "常行菓子舗",
    category: "souvenir",
    location: { lat: 33.334209, lng: 132.798034 },
    localizedDescriptions: { ja: "常行菓子舗（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-12289070919",
    name: "高橋製菓",
    category: "souvenir",
    location: { lat: 33.534874, lng: 132.655301 },
    localizedDescriptions: { ja: "高橋製菓（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-12365027906",
    name: "もち吉 宇和島店",
    category: "souvenir",
    location: { lat: 33.234571, lng: 132.56894 },
    localizedDescriptions: { ja: "もち吉 宇和島店（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-13112198994",
    name: "一六本舗",
    category: "souvenir",
    location: { lat: 33.816522, lng: 132.778015 },
    localizedDescriptions: { ja: "一六本舗（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-13826874101",
    name: "Gifts",
    category: "souvenir",
    location: { lat: 34.248134, lng: 132.996362 },
    localizedDescriptions: { ja: "Gifts（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-node-13904553794",
    name: "ハリカ",
    category: "souvenir",
    location: { lat: 32.955542, lng: 132.585055 },
    localizedDescriptions: { ja: "ハリカ（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-234185188",
    name: "十六番館 一六本舗",
    category: "souvenir",
    location: { lat: 33.816858, lng: 132.777431 },
    localizedDescriptions: { ja: "十六番館 一六本舗（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-378850502",
    name: "もち吉",
    category: "souvenir",
    location: { lat: 33.930906, lng: 133.200464 },
    localizedDescriptions: { ja: "もち吉（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-408757533",
    name: "霧の森菓子工房新宮本店",
    category: "souvenir",
    location: { lat: 33.924493, lng: 133.641266 },
    localizedDescriptions: { ja: "霧の森菓子工房新宮本店（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-585247718",
    name: "渡部みやげ店",
    category: "souvenir",
    location: { lat: 33.973718, lng: 132.766348 },
    localizedDescriptions: { ja: "渡部みやげ店（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  },
  {
    id: "osm-way-690593054",
    name: "フレッシュ一本松",
    category: "souvenir",
    location: { lat: 32.968206, lng: 132.658025 },
    localizedDescriptions: { ja: "フレッシュ一本松（みやげ・物産）" },
    reviews: [],
    imageUrls: []
  }
];

// src/adapters/mock/ehime-food.curated.ts
var AREA = {
  matsuyamaCity: { lat: 33.8416, lng: 132.7657 },
  okaido: { lat: 33.8456, lng: 132.769 },
  dogo: { lat: 33.8515, lng: 132.7861 },
  mitsuhama: { lat: 33.8745, lng: 132.7118 },
  matsuyamaAirport: { lat: 33.8272, lng: 132.6997 },
  imabari: { lat: 34.0658, lng: 132.9975 },
  uwajima: { lat: 33.2233, lng: 132.5606 },
  yawatahama: { lat: 33.4636, lng: 132.4231 }
};
var SEEDS = [
  { id: "gansui-matsuyama", name: "宇和島鯛めし 丸水 松山店", area: "okaido", specialty: "宇和島鯛めし", website: "https://gansui.jp/" },
  { id: "kadoya-okaido", name: "かどや 大街道店", area: "okaido", specialty: "鯛めし・郷土料理" },
  { id: "goshiki-matsuyama", name: "郷土料理 五志喜", area: "matsuyamaCity", specialty: "五色そうめん・鯛めし" },
  { id: "hozumitei-uwajima", name: "ほづみ亭", area: "uwajima", specialty: "宇和島鯛めし" },
  { id: "hinode-mitsuhama", name: "日の出", area: "mitsuhama", specialty: "三津浜焼き" },
  { id: "konaya-mitsuhama", name: "こなや", area: "mitsuhama", specialty: "三津浜焼き" },
  { id: "hakurakuten-imabari", name: "白楽天 今治本店", area: "imabari", specialty: "今治焼豚玉子飯", website: "https://hakurakuten.net/" },
  { id: "shigematsu-imabari", name: "重松飯店", area: "imabari", specialty: "焼豚玉子飯（発祥の店）" },
  { id: "kotori-matsuyama", name: "ことり", area: "matsuyamaCity", specialty: "松山の鍋焼きうどん" },
  { id: "asahi-matsuyama", name: "アサヒ", area: "matsuyamaCity", specialty: "松山の鍋焼きうどん" },
  { id: "tenfactory-matsuyama", name: "10 FACTORY 松山本店", area: "okaido", specialty: "みかんジュース・柑橘スイーツ", website: "https://10-factory.com/" },
  { id: "mikan-tap-airport", name: "みかんジュース蛇口（松山空港）", area: "matsuyamaAirport", specialty: "蛇口からみかんジュース" },
  { id: "yasuoka-kamaboko-uwajima", name: "安岡蒲鉾（じゃこ天）", area: "uwajima", specialty: "じゃこ天・練り物" },
  { id: "takeuchi-matsuyama", name: "たけうち", area: "matsuyamaCity", specialty: "労研饅頭" },
  { id: "champon-yawatahama", name: "八幡浜ちゃんぽんの店", area: "yawatahama", specialty: "八幡浜ちゃんぽん" }
];
var EHIME_FOOD_CURATED = SEEDS.map((s) => ({
  id: `curated-food-${s.id}`,
  name: s.name,
  category: "food",
  location: { ...AREA[s.area] },
  localizedDescriptions: {
    ja: `${s.specialty}の店（愛媛の郷土料理・名物）※位置は目安`,
    en: `Local Ehime specialty: ${s.specialty} (approx. location)`
  },
  reviews: [],
  imageUrls: [],
  ...s.website ? { website: s.website } : {}
}));

// src/adapters/mock/spots.ts
var EHIME_SPOTS2 = [...EHIME_SPOTS, ...EHIME_FOOD_CURATED];

// src/data/templeDetails.ts
var TEMPLE_DETAILS = {
  40: {
    descriptionJa: "平城山薬師院観自在寺は第40番札所で、本尊は薬師如来。第1番霊山寺から最も遠い位置にあることから「四国霊場の裏関所」とも呼ばれます。弘法大師の開創と伝わり、南予・愛南町の巡礼の要所です。",
    descriptionEn: "Temple 40, Kanjizaiji, enshrines Yakushi Nyorai. As the temple farthest from Temple 1, it is known as the 'back checkpoint' of the Shikoku pilgrimage, and is said to have been founded by Kobo Daishi.",
    history: "大同年間に弘法大師が平城天皇の勅願により開創したと伝わります。本尊の薬師如来と脇仏は大師が一本の霊木から刻んだとされ、南予地方の信仰を集めてきました。",
    highlights: ["本堂（本尊・薬師如来）", "大師堂", "山門（四国最南端の霊場入口）", "境内の歴史ある石仏群"],
    photoSpots: ["山門前", "本堂前の参道", "宝篋印塔"]
  },
  41: {
    descriptionJa: "稲荷山護国院龍光寺は第41番札所で、本尊は十一面観世音菩薩。神仏習合の名残から稲荷社を併せ祀り、地元では「三間のお稲荷さん」として親しまれています。",
    descriptionEn: "Temple 41, Ryukoji, enshrines the Eleven-Headed Kannon. A vestige of Shinto-Buddhist syncretism, it stands with an Inari shrine and is fondly known locally as the 'Inari of Mima'.",
    history: "弘法大師が稲荷大明神の化身に出会い、その像を刻んで祀ったのが起こりと伝わります。明治の神仏分離までは稲荷神社と一体で、今も鳥居越しに参道が続きます。",
    highlights: ["本堂", "大師堂", "稲荷社と鳥居", "参道の石段"],
    photoSpots: ["鳥居越しの参道", "本堂前"]
  },
  42: {
    descriptionJa: "一畑山（一如山）毘盧舎那院仏木寺は第42番札所で、本尊は大日如来。牛馬やペットなど動物の守り仏として信仰され、珍しい茅葺きの鐘楼が残ります。",
    descriptionEn: "Temple 42, Butsumokuji, enshrines Dainichi Nyorai. Revered as a guardian of livestock and pets, it is notable for its rare thatched-roof bell tower.",
    history: "弘法大師が牛に導かれて霊木を見つけ、大日如来を刻んで堂を建てたと伝わります。古くから家畜安全の祈願所として、農家や動物を飼う人々の信仰を集めてきました。",
    highlights: ["本堂（本尊・大日如来）", "茅葺きの鐘楼", "大師堂", "家畜・ペット供養"],
    photoSpots: ["茅葺き鐘楼", "山門前"]
  },
  43: {
    descriptionJa: "源光山円手院明石寺は第43番札所で、本尊は千手観世音菩薩。地元では「あげいしさん」と呼ばれ、宇和盆地を見下ろす緑深い境内が印象的です。",
    descriptionEn: "Temple 43, Meisekiji, enshrines the Thousand-Armed Kannon. Known locally as 'Ageishi-san', it sits in a lush precinct overlooking the Uwa basin.",
    history: "古代の修験の地に起こり、のちに弘法大師が中興したと伝わります。歴代領主の帰依を受け、山あいの静かな霊場として巡礼者を迎えてきました。",
    highlights: ["本堂", "大師堂", "苔むした参道", "夫婦杉"],
    photoSpots: ["参道の石段", "本堂前"]
  },
  44: {
    descriptionJa: "菅生山大覚院大寶寺は第44番札所で、本尊は十一面観世音菩薩。八十八ヶ所のほぼ中間に位置する「中札所」として知られ、久万高原の杉木立に包まれています。",
    descriptionEn: "Temple 44, Daihoji, enshrines the Eleven-Headed Kannon. Marking roughly the midpoint of the 88 temples, it stands among the cedar groves of Kuma-kogen.",
    history: "百済からの渡来僧が本尊を安置したのが起こりと伝わり、のちに弘法大師が霊場と定めたとされます。標高の高い山中にあり、四国遍路の折り返し点として大切にされてきました。",
    highlights: ["本堂", "大師堂", "巨杉の参道", "中札所の道標"],
    photoSpots: ["杉並木の参道", "山門"]
  },
  45: {
    descriptionJa: "海岸山岩屋寺は第45番札所で、本尊は不動明王。切り立った岩壁に堂宇が寄り添う修行の霊場で、国の名勝にも指定される景観を誇ります。",
    descriptionEn: "Temple 45, Iwayaji, enshrines Fudo Myoo. A temple of ascetic training built against sheer cliffs, its dramatic scenery is designated a National Place of Scenic Beauty.",
    history: "山全体を本尊とする信仰から始まり、弘法大師が修行したと伝わります。本堂まで急な山道と石段が続き、岩窟や梯子が残る険しい行場として知られます。",
    highlights: ["岩壁に建つ本堂", "大師堂", "せり割行場", "山道の石段"],
    photoSpots: ["岩壁と本堂", "参道からの見上げ"]
  },
  46: {
    descriptionJa: "医王山養珠院浄瑠璃寺は第46番札所で、本尊は薬師如来。松山市郊外の里に佇み、健康や手足の平癒を願う「仏足石」などの縁起物で知られます。",
    descriptionEn: "Temple 46, Joruriji, enshrines Yakushi Nyorai. Set in the outskirts of Matsuyama, it is known for lucky features such as a 'Buddha's footprint' stone for health and healing.",
    history: "行基が薬師如来を刻んで開いたと伝わり、のちに弘法大師が再興したとされます。松山近郊の札所群（46〜53番）の入口として、多くの歩き遍路が最初に訪れます。",
    highlights: ["本堂（本尊・薬師如来）", "大師堂", "仏足石", "説法石"],
    photoSpots: ["本堂前", "境内の大木"]
  },
  47: {
    descriptionJa: "熊野山妙見院八坂寺は第47番札所で、本尊は阿弥陀如来。修験道ゆかりの古刹で、極楽・地獄を描いた天井絵や色鮮やかな本堂が見どころです。",
    descriptionEn: "Temple 47, Yasakaji, enshrines Amida Nyorai. An old temple linked to Shugendo, it features vivid ceiling paintings of paradise and hell and a colorful main hall.",
    history: "修験道の行場として開かれ、熊野権現を勧請したと伝わります。弘法大師が再興し、周辺の霊場とともに松山平野の遍路道を形づくってきました。",
    highlights: ["本堂", "大師堂", "極楽・地獄の天井絵", "閻魔堂"],
    photoSpots: ["本堂の彩色", "山門"]
  },
  48: {
    descriptionJa: "清滝山安養院西林寺は第48番札所で、本尊は十一面観世音菩薩。周囲より低い土地に本堂が建ち、「罪深き者は落ちる」との言い伝えが残ります。",
    descriptionEn: "Temple 48, Sairinji, enshrines the Eleven-Headed Kannon. Its main hall sits on ground lower than its surroundings, giving rise to a legend about the fate of the sinful.",
    history: "行基の開創と伝わり、弘法大師が現在地に移したとされます。近くには大師が湧かせたという「杖の淵」の名水があり、地域の人々に親しまれています。",
    highlights: ["本堂", "大師堂", "低地に建つ伽藍", "杖の淵の名水"],
    photoSpots: ["山門前", "本堂前"]
  },
  49: {
    descriptionJa: "西林山三蔵院浄土寺は第49番札所で、本尊は釈迦如来。踊り念仏で知られる空也上人ゆかりの寺で、上人の姿を刻んだ像が伝わります。",
    descriptionEn: "Temple 49, Jodoji, enshrines Shaka Nyorai. Associated with the wandering monk Kuya, it preserves a statue depicting him.",
    history: "行基の開創と伝わり、平安時代に空也上人が滞在して布教したとされます。上人自作と伝わる空也上人立像は国の重要文化財に指定されています。",
    highlights: ["本堂", "大師堂", "空也上人立像", "古い伽藍"],
    photoSpots: ["本堂前", "山門"]
  },
  50: {
    descriptionJa: "東山瑠璃光院繁多寺は第50番札所で、本尊は薬師如来。松山市街を見下ろす高台にあり、静かな境内から市内の眺望が広がります。",
    descriptionEn: "Temple 50, Hantaji, enshrines Yakushi Nyorai. Set on a rise overlooking Matsuyama, its quiet precinct offers views over the city.",
    history: "行基の開創と伝わり、弘法大師が霊場と定めたとされます。歴代天皇や武将の帰依を受け、時宗の一遍上人も学んだと伝わる由緒ある寺です。",
    highlights: ["本堂", "大師堂", "高台からの眺望", "歓喜天堂"],
    photoSpots: ["境内からの市街展望", "本堂前"]
  },
  51: {
    descriptionJa: "熊野山虚空蔵院石手寺は第51番札所で、本尊は薬師如来。道後温泉に近い名刹で、国宝の仁王門をはじめ数多くの文化財を有し、衛門三郎の伝説でも知られます。",
    descriptionEn: "Temple 51, Ishiteji, enshrines Yakushi Nyorai. A celebrated temple near Dogo Onsen, it boasts many cultural treasures including a National Treasure Nio gate, and is famed for the legend of Emon Saburo.",
    history: "行基の開創と伝わり、四国遍路の元祖とされる衛門三郎の再来伝説にちなんで「石手寺」と改めたとされます。鎌倉時代の仁王門は国宝に指定され、参道は多くの参拝者で賑わいます。",
    highlights: ["国宝・仁王門", "本堂", "三重塔", "衛門三郎伝説", "洞窟のマントラ洞"],
    photoSpots: ["仁王門", "三重塔", "参道"]
  },
  52: {
    descriptionJa: "瀧雲山護持院太山寺は第52番札所で、本尊は十一面観世音菩薩。国宝に指定された壮大な本堂が建ち、深い森に包まれた荘厳な境内が魅力です。",
    descriptionEn: "Temple 52, Taisanji, enshrines the Eleven-Headed Kannon. It features a magnificent main hall designated a National Treasure, set in a solemn, forested precinct.",
    history: "豪商が一夜で本堂を建てたという「一夜建立」の伝説が残ります。現在の本堂は鎌倉時代の再建で国宝に指定され、四国屈指の建築として知られています。",
    highlights: ["国宝・本堂", "大師堂", "仁王門", "深い社叢林"],
    photoSpots: ["国宝本堂", "参道の石段"]
  },
  53: {
    descriptionJa: "須賀山正智院圓明寺は第53番札所で、本尊は阿弥陀如来。松山北部の集落に建ち、隠れキリシタンの遺物とされる石塔が伝わることで知られます。",
    descriptionEn: "Temple 53, Enmyoji, enshrines Amida Nyorai. In a village in northern Matsuyama, it is known for a stone marker said to be a relic of hidden Christians.",
    history: "行基の開創と伝わり、のちに現在地へ移されました。境内にはキリシタン石塔や、アメリカ人巡礼者が最古と確認した銅版の納札が残ることで知られます。",
    highlights: ["本堂", "大師堂", "キリシタン石塔", "左甚五郎作と伝わる龍"],
    photoSpots: ["山門", "本堂前"]
  },
  54: {
    descriptionJa: "近見山宝鐘院延命寺は第54番札所で、本尊は不動明王。今治市郊外に位置し、火災を乗り越えて守られてきた梵鐘「近見二郎」が伝わります。",
    descriptionEn: "Temple 54, Enmeiji, enshrines Fudo Myoo. On the outskirts of Imabari, it preserves the temple bell 'Chikami Jiro', which survived past fires.",
    history: "行基の開創と伝わり、弘法大師が再興したとされます。度重なる火災に遭いながらも再建され、今治平野の札所群の入口として親しまれています。",
    highlights: ["本堂", "大師堂", "梵鐘「近見二郎」", "山門"],
    photoSpots: ["山門前", "本堂前"]
  },
  55: {
    descriptionJa: "別宮山金剛院光明寺（南光坊）は第55番札所で、本尊は大通智勝如来。四国霊場で唯一「坊」の名を持ち、大三島の大山祇神社ゆかりの由緒ある札所です。",
    descriptionEn: "Temple 55, Nankobo, enshrines Daitsuchisho Nyorai. The only temple on the pilgrimage whose name ends in 'bo', it is linked to Oyamazumi Shrine on Omishima.",
    history: "大三島の大山祇神社の別宮に付属する坊として今治に移されたのが起こりと伝わります。四国霊場で唯一「坊」を名乗り、本尊も他にない大通智勝如来を祀ります。",
    highlights: ["本堂（本尊・大通智勝如来）", "大師堂", "山門の四天王像", "別宮大山祇神社"],
    photoSpots: ["山門", "本堂前"]
  },
  56: {
    descriptionJa: "金輪山勅王院泰山寺は第56番札所で、本尊は地蔵菩薩。弘法大師が氾濫する川を鎮めるために堂を建てたと伝わる、治水ゆかりの札所です。",
    descriptionEn: "Temple 56, Taisanji, enshrines Jizo Bosatsu. It is said Kobo Daishi built the hall to quell a flooding river, giving it ties to flood control.",
    history: "弘法大師が氾濫を繰り返す蒼社川を治め、地蔵菩薩を刻んで堂を建てたのが起こりと伝わります。境内には大師手植えと伝わる「不忘の松」があります。",
    highlights: ["本堂", "大師堂", "不忘の松", "石垣の上の境内"],
    photoSpots: ["石段の参道", "本堂前"]
  },
  57: {
    descriptionJa: "府頭山無量寿院栄福寺は第57番札所で、本尊は阿弥陀如来。神仏習合の趣を残す静かな山寺で、病気平癒の信仰が伝わります。",
    descriptionEn: "Temple 57, Eifukuji, enshrines Amida Nyorai. A quiet mountain temple retaining a Shinto-Buddhist atmosphere, it is associated with prayers for healing.",
    history: "弘法大師が海の安全を祈って阿弥陀如来を刻んで祀ったのが起こりと伝わります。歩けなかった少年が参拝して歩けるようになったという逸話が残り、健脚祈願でも知られます。",
    highlights: ["本堂", "大師堂", "犬塚池", "健脚祈願の絵馬"],
    photoSpots: ["本堂前", "境内からの眺め"]
  },
  58: {
    descriptionJa: "作礼山千光院仙遊寺は第58番札所で、本尊は千手観世音菩薩。作礼山の山頂近くに建ち、今治平野やしまなみ海道を望む絶景で知られます。",
    descriptionEn: "Temple 58, Senyuji, enshrines the Thousand-Armed Kannon. Near the summit of Mt. Sarei, it is famed for sweeping views of the Imabari plain and the Shimanami Kaido.",
    history: "海から現れた龍女が刻んだと伝わる本尊を祀り、養老年間に阿坊仙人が長く籠ったことが寺名の由来とされます。山上からの眺望は遍路の疲れを癒す絶景として有名です。",
    highlights: ["本堂", "大師堂", "山頂からの大パノラマ", "弘法大師の加持水"],
    photoSpots: ["山門からの参道", "山頂展望"]
  },
  59: {
    descriptionJa: "金光山最勝院国分寺（伊予国分寺）は第59番札所で、本尊は薬師如来。奈良時代に諸国に建てられた国分寺の一つで、往時をしのぶ礎石が残ります。",
    descriptionEn: "Temple 59, Kokubunji (Iyo Kokubunji), enshrines Yakushi Nyorai. One of the provincial temples founded in the Nara period, it retains foundation stones from ancient times.",
    history: "聖武天皇の勅願により建立された伊予国分寺を起源とし、たびたびの兵火で焼失しながら再建されてきました。境内には七重塔の礎石が残り、古代寺院の規模を今に伝えます。",
    highlights: ["本堂", "大師堂", "七重塔の礎石", "握手大師像"],
    photoSpots: ["礎石跡", "本堂前"]
  },
  60: {
    descriptionJa: "石鈇山福智院横峰寺は第60番札所で、本尊は大日如来。標高約745mの石鎚山中腹に建つ四国屈指の高所札所で、「遍路ころがし」の難所として知られます。",
    descriptionEn: "Temple 60, Yokomineji, enshrines Dainichi Nyorai. Perched around 745 m on the slopes of Mt. Ishizuchi, it is one of the pilgrimage's highest and toughest temples.",
    history: "役行者が石鎚山で修行した際に開いたと伝わり、のちに弘法大師が霊場と定めたとされます。石鎚山信仰の拠点で、急峻な山道は歩き遍路の難所として有名です。",
    highlights: ["本堂", "大師堂", "石鎚山の遥拝", "初夏の石楠花"],
    photoSpots: ["山門", "石楠花と本堂"]
  },
  61: {
    descriptionJa: "栴檀山教王院香園寺は第61番札所で、本尊は大日如来。安産・子育ての「子安大師」で知られ、大聖堂と呼ばれる近代的な大伽藍が特徴です。",
    descriptionEn: "Temple 61, Koonji, enshrines Dainichi Nyorai. Known for the 'Koyasu Daishi' of safe childbirth and child-rearing, it features a modern great hall called the Daiseido.",
    history: "弘法大師が難産の婦人を救い、子安の信仰が広まったと伝わります。本堂と大師堂を一つに納めた鉄筋の大聖堂は他に例のない大空間で、多くの参拝者を収容します。",
    highlights: ["大聖堂（本堂・大師堂）", "子安大師", "近代的な大伽藍"],
    photoSpots: ["大聖堂外観", "堂内の大空間"]
  },
  62: {
    descriptionJa: "天養山観音院宝寿寺は第62番札所で、本尊は十一面観世音菩薩。伊予国一宮ゆかりの札所で、安産の観音として信仰を集めてきました。",
    descriptionEn: "Temple 62, Hojuji, enshrines the Eleven-Headed Kannon. Linked to the first shrine of Iyo Province, it has long been revered as a Kannon of safe childbirth.",
    history: "聖武天皇の勅願で伊予国一宮の別当寺として建てられたのが起こりと伝わります。街道沿いのこぢんまりとした境内に、安産祈願の観音信仰が受け継がれています。",
    highlights: ["本堂", "大師堂", "安産の観音", "街道沿いの境内"],
    photoSpots: ["本堂前", "山門"]
  },
  63: {
    descriptionJa: "密教山胎蔵院吉祥寺は第63番札所で、本尊は毘沙聞天。八十八ヶ所で唯一毘沙聞天を本尊とし、財福・開運の信仰を集めています。",
    descriptionEn: "Temple 63, Kichijoji, enshrines Bishamonten. The only temple among the 88 with Bishamonten as its honzon, it draws prayers for fortune and good luck.",
    history: "弘法大師が光を放つ霊木で毘沙聞天を刻んで祀ったのが起こりと伝わります。境内には目を閉じて願いながら通り抜ける「成就石」があり、願掛けの参拝者が絶えません。",
    highlights: ["本堂（本尊・毘沙聞天）", "大師堂", "成就石", "くぐり吉祥天女"],
    photoSpots: ["成就石", "本堂前"]
  },
  64: {
    descriptionJa: "石鈇山金色院前神寺は第64番札所で、本尊は阿弥陀如来。石鎚山を神体とする石鎚信仰の総本山で、広大で荘厳な境内を誇ります。",
    descriptionEn: "Temple 64, Maegamiji, enshrines Amida Nyorai. The head temple of Mt. Ishizuchi worship, it boasts a vast and solemn precinct.",
    history: "役行者が石鎚山で修行して蔵王権現を感得し、開いたと伝わります。石鎚修験の中心として歴代の武将や庶民の信仰を集め、山麓に広い伽藍を構えます。",
    highlights: ["本堂", "大師堂", "御滝行場不動", "石鎚山信仰"],
    photoSpots: ["参道", "本堂前"]
  },
  65: {
    descriptionJa: "由霊山慈尊院三角寺は第65番札所で、本尊は十一面観世音菩薩。愛媛最後の札所で、桜の名所として知られ、俳人・小林一茶の句碑も残ります。",
    descriptionEn: "Temple 65, Sankakuji, enshrines the Eleven-Headed Kannon. The last temple in Ehime, it is famed for cherry blossoms and preserves a haiku monument to Kobayashi Issa.",
    history: "行基の開創と伝わり、弘法大師が三角形の護摩壇を築いて修法したことが寺名の由来とされます。春には山門を彩る桜が見事で、一茶が句に詠んだ名所として知られます。",
    highlights: ["本堂", "大師堂", "山門の桜", "小林一茶の句碑", "三角の護摩壇跡"],
    photoSpots: ["桜と山門", "本堂前"]
  }
};

// src/data/templeGeo.ts
var TEMPLE_GEO = {
  40: { address: "愛媛県南宇和郡愛南町御荘平城2253-1", lat: 32.964586, lng: 132.564054 },
  41: { address: "愛媛県宇和島市三間町戸雁173", lat: 33.295202, lng: 132.598644 },
  42: { address: "愛媛県宇和島市三間町則1683", lat: 33.31056, lng: 132.581459 },
  43: { address: "愛媛県西予市宇和町明石201", lat: 33.369234, lng: 132.519022 },
  44: { address: "愛媛県上浮穴郡久万高原町菅生2-1173-2", lat: 33.661236, lng: 132.911587 },
  45: { address: "愛媛県上浮穴郡久万高原町七鳥1468", lat: 33.658771, lng: 132.980899 },
  46: { address: "愛媛県松山市浄瑠璃町282", lat: 33.753653, lng: 132.819157 },
  47: { address: "愛媛県松山市浄瑠璃町八坂773", lat: 33.757975, lng: 132.812808 },
  48: { address: "愛媛県松山市高井町1007", lat: 33.793724, lng: 132.813843 },
  49: { address: "愛媛県松山市鷹子町1198", lat: 33.81662, lng: 132.808311 },
  50: { address: "愛媛県松山市畑寺町32", lat: 33.827983, lng: 132.804264 },
  51: { address: "愛媛県松山市石手二丁目9-21", lat: 33.847577, lng: 132.797129 },
  52: { address: "愛媛県松山市太山寺町1730", lat: 33.885004, lng: 132.715021 },
  53: { address: "愛媛県松山市和気町1-182", lat: 33.89168, lng: 132.739789 },
  54: { address: "愛媛県今治市阿方甲636", lat: 34.066841, lng: 132.963997 },
  55: { address: "愛媛県今治市別宮町3-1", lat: 34.068227, lng: 132.995306 },
  56: { address: "愛媛県今治市小泉1-9-18", lat: 34.05041, lng: 132.974748 },
  57: { address: "愛媛県今治市玉川町八幡甲200", lat: 34.029781, lng: 132.978185 },
  58: { address: "愛媛県今治市玉川町別所甲483", lat: 34.013284, lng: 132.97735 },
  59: { address: "愛媛県今治市国分4-1-33", lat: 34.025337, lng: 133.025192 },
  60: { address: "愛媛県西条市小松町石鎚甲2253", lat: 33.837618, lng: 133.111091 },
  61: { address: "愛媛県西条市小松町南川甲19", lat: 33.893603, lng: 133.103411 },
  62: { address: "愛媛県西条市小松町新屋敷甲428", lat: 33.897301, lng: 133.115116 },
  63: { address: "愛媛県西条市氷見乙1048", lat: 33.895773, lng: 133.129151 },
  64: { address: "愛媛県西条市洲之内甲1426", lat: 33.890361, lng: 133.160562 },
  65: { address: "愛媛県四国中央市金田町三角寺甲75", lat: 33.967373, lng: 133.586636 }
};

// src/data/fallbackPools.ts
function hasFiniteLocation(lat, lng) {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}
function templeNameFromDescription(descriptionJa, templeNumber) {
  if (!descriptionJa) return void 0;
  const match = new RegExp(`^(.+?)は第${templeNumber}番札所`).exec(descriptionJa);
  const name = match?.[1]?.trim();
  return name && name.length > 0 ? name : void 0;
}
function buildTemplePoints() {
  const points = [];
  for (const [key, geo] of Object.entries(TEMPLE_GEO)) {
    const templeNumber = Number(key);
    if (!Number.isFinite(templeNumber)) continue;
    if (!hasFiniteLocation(geo.lat, geo.lng)) continue;
    const detail = TEMPLE_DETAILS[templeNumber];
    const templeName = templeNameFromDescription(detail?.descriptionJa, templeNumber);
    const name = templeName ? `第${templeNumber}番札所 ${templeName}` : `第${templeNumber}番札所`;
    const descriptions = {};
    if (detail?.descriptionJa) descriptions.ja = detail.descriptionJa;
    if (detail?.descriptionEn) descriptions.en = detail.descriptionEn;
    points.push({
      id: `temple-${templeNumber}`,
      source: "temple",
      name,
      location: { lat: geo.lat, lng: geo.lng },
      formattedAddress: geo.address,
      descriptions
    });
  }
  return points;
}
function buildSpotPoints() {
  const points = [];
  for (const spot of EHIME_SPOTS2) {
    if (!spot.location || !hasFiniteLocation(spot.location.lat, spot.location.lng)) {
      continue;
    }
    const point = {
      id: spot.id,
      source: "spot",
      name: spot.name,
      location: { lat: spot.location.lat, lng: spot.location.lng },
      // EHIME_SPOTS carries no street address, so keep the prefecture as the
      // coarse but always-true location label.
      formattedAddress: "愛媛県",
      descriptions: { ...spot.localizedDescriptions },
      category: spot.category
    };
    const photoUrl = spot.imageUrls?.[0];
    if (photoUrl) point.photoUrl = photoUrl;
    if (spot.website) point.websiteUri = spot.website;
    points.push(point);
  }
  return points;
}
var TEMPLE_FALLBACK_POINTS = buildTemplePoints();
var SPOT_FALLBACK_POINTS = buildSpotPoints();
var DEFAULT_FALLBACK_POOLS = {
  temples: TEMPLE_FALLBACK_POINTS,
  spots: SPOT_FALLBACK_POINTS
};
export {
  CANDIDATE_BASE_RADIUS_METERS,
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_MINIMUM_COUNT,
  CANDIDATE_RADII_METERS,
  DEFAULT_FALLBACK_POOLS,
  clampCandidateCount,
  finalizeCandidates
};
