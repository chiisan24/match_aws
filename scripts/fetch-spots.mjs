/**
 * fetch-spots.mjs — build a REAL Ehime spot dataset from OpenStreetMap via the
 * Overpass API, mapped to the app's {@link Spot} shape, and write it to
 * `src/adapters/mock/ehime-spots.generated.ts`.
 *
 * Data source: © OpenStreetMap contributors (ODbL). Attribution is required
 * wherever this data is shown (the map already credits OSM for tiles; the
 * generated file header records the source too).
 *
 * Real names + coordinates come from OSM. OSM has no reviews and rarely has
 * descriptions, so `reviews` is empty and `localizedDescriptions` is a light
 * name-based line — honest about what the source provides.
 *
 * Run: node scripts/fetch-spots.mjs
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, "..", "src", "adapters", "mock", "ehime-spots.generated.ts");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Constrain strictly to the 愛媛県 administrative boundary (admin_level=4),
// so neighbouring prefectures / islands across the sea are excluded.
const query = `
[out:json][timeout:120];
area["name"="愛媛県"]["boundary"="administrative"]["admin_level"="4"]->.ehime;
(
  nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"](area.ehime);
  nwr["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park|gallery|aquarium|artwork)$"]["name"](area.ehime);
  nwr["historic"~"^(castle|monument|ruins|memorial)$"]["name"](area.ehime);
  nwr["natural"~"^(peak|beach)$"]["name"](area.ehime);
  nwr["shop"~"^(gift|souvenir|confectionery)$"]["name"](area.ehime);
  nwr["amenity"="public_bath"]["name"](area.ehime);
  nwr["leisure"="spa"]["name"](area.ehime);
);
out center tags;
`;

/**
 * Per-category caps. Tourism attractions (観光地) are the focus, so sightseeing
 * dominates; ordinary restaurants are kept but secondary.
 */
const CAPS = { sightseeing: 300, onsen: 80, souvenir: 60, food: 120 };

/**
 * 愛媛の郷土料理・名物キーワード。food（飲食店）はこれに名前が一致する店だけを
 * グルメレイヤーに載せる（普通の飲食店は除外）。
 */
const LOCAL_FOOD = /(鯛めし|鯛飯|たいめし|タイメシ|みかん|ミカン|蜜柑|柑橘|ポンジュース|三津浜焼|みつはま|三津浜|焼豚玉子飯|今治焼豚|じゃこ天|じゃこ|鍋焼きうどん|五色そうめん|そうめん|八幡浜ちゃんぽん|ちゃんぽん|さつま汁|削りかまぼこ|かまぼこ|蒲鉾|労研饅頭|労研|母恵夢|タルト|ぽん菓子|芋炊き|郷土料理)/i;

/** Build a searchable haystack from the tags OSM most often carries. */
function foodHaystack(tags) {
  return [
    tags.name,
    tags["name:ja"],
    tags.cuisine,
    tags.description,
    tags["description:ja"],
    tags.brand,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Decide the app category from OSM tags (precedence matters). */
function categorize(tags) {
  const a = tags.amenity;
  const name = tags.name || "";
  if (a === "restaurant" || a === "cafe" || a === "fast_food") return "food";
  if (a === "public_bath" || tags.leisure === "spa" || /温泉|の湯|スパ/.test(name)) return "onsen";
  if (tags.shop === "gift" || tags.shop === "souvenir" || tags.shop === "confectionery") return "souvenir";
  if (tags.tourism || tags.historic || tags.natural) return "sightseeing";
  return null;
}

function coordsOf(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

const CATEGORY_JA = { food: "飲食店", sightseeing: "観光スポット", onsen: "温泉・入浴", souvenir: "みやげ・物産" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass() {
  let lastErr;
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "MatchEhimeApp/1.0 (student contest demo; OSM data fetch)",
          },
          body: "data=" + encodeURIComponent(query),
        });
        if (res.status === 429 || res.status === 504) {
          console.warn(`${url} -> ${res.status}, backing off…`);
          await sleep(4000 * attempt);
          continue;
        }
        if (!res.ok) throw new Error(`${url} -> ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        console.warn("Overpass attempt failed:", String(e).split("\n")[0]);
        await sleep(1500);
      }
    }
  }
  throw lastErr;
}

function esc(s) {
  return String(s)
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .trim();
}

async function run() {
  console.log("Querying Overpass for Ehime POIs…");
  const data = await overpass();
  const elements = Array.isArray(data.elements) ? data.elements : [];
  console.log("Raw elements:", elements.length);

  const seen = new Set();
  const byCat = { food: [], sightseeing: [], onsen: [], souvenir: [] };

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags["name:ja"] || tags.name;
    if (!name) continue;
    const cat = categorize(tags);
    if (!cat) continue;
    // グルメは愛媛の郷土料理・名物の店だけに絞る（普通の飲食店は除外）。
    if (cat === "food" && !LOCAL_FOOD.test(foodHaystack(tags))) continue;
    const loc = coordsOf(el);
    if (!loc) continue;

    // Dedupe by name + rounded coords.
    const key = `${name}@${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (byCat[cat].length >= CAPS[cat]) continue;

    const nameEn = tags["name:en"];
    const website = tags.website || tags["contact:website"] || tags.url || undefined;
    // Prefer a real attraction description from OSM; fall back to name-based.
    const desc = tags["description:ja"] || tags.description || undefined;
    byCat[cat].push({
      id: `osm-${el.type}-${el.id}`,
      name,
      category: cat,
      location: { lat: Number(loc.lat.toFixed(6)), lng: Number(loc.lng.toFixed(6)) },
      ja: desc ? desc : `${name}（${CATEGORY_JA[cat]}）`,
      en: nameEn ? `${nameEn} (${cat})` : undefined,
      openingHours: tags.opening_hours || undefined,
      website: website && /^https?:\/\//.test(website) ? website : undefined,
    });
  }

  const all = [...byCat.food, ...byCat.sightseeing, ...byCat.onsen, ...byCat.souvenir];
  console.log(
    `Kept: food=${byCat.food.length} sightseeing=${byCat.sightseeing.length} onsen=${byCat.onsen.length} souvenir=${byCat.souvenir.length} total=${all.length}`,
  );

  const body = all
    .map((s) => {
      const desc = s.en
        ? `    localizedDescriptions: { ja: "${esc(s.ja)}", en: "${esc(s.en)}" },`
        : `    localizedDescriptions: { ja: "${esc(s.ja)}" },`;
      const lines = [
        "  {",
        `    id: "${esc(s.id)}",`,
        `    name: "${esc(s.name)}",`,
        `    category: "${s.category}",`,
        `    location: { lat: ${s.location.lat}, lng: ${s.location.lng} },`,
        desc,
        "    reviews: [],",
        "    imageUrls: [],",
      ];
      if (s.openingHours) lines.push(`    openingHours: "${esc(s.openingHours)}",`);
      if (s.website) lines.push(`    website: "${esc(s.website)}",`);
      lines.push("  },");
      return lines.join("\n");
    })
    .join("\n");

  const header = `/**
 * ehime-spots.generated.ts — REAL Ehime spots generated from OpenStreetMap.
 *
 * Data © OpenStreetMap contributors, licensed under the Open Database License
 * (ODbL). Attribution must be shown wherever this data is displayed.
 *
 * Generated by scripts/fetch-spots.mjs — DO NOT EDIT BY HAND. Re-run the script
 * to refresh. Names & coordinates are from OSM; OSM provides no reviews and
 * rarely descriptions, so reviews are empty and descriptions are name-based.
 *
 * Generated: ${new Date().toISOString()}
 * Count: ${all.length}
 */

import type { Spot } from "../../ports";

export const EHIME_SPOTS: Spot[] = [
${body}
];
`;

  await writeFile(outFile, header, "utf8");
  console.log("Wrote:", outFile);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
