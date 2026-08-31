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
 * Restaurants (`food`) keep everything except national chains. The previous
 * policy was the reverse — an allow-list of 郷土料理 keywords — which left the
 * whole prefecture with four restaurants and starved the route builder's 5km
 * food search. See {@link LOCAL_FOOD} and {@link isChainFood}.
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
 * dominates; restaurants are secondary but need real depth, because the route
 * builder searches a 5km radius and a prefecture-wide handful leaves whole towns
 * with nothing to offer at lunchtime.
 */
const CAPS = { sightseeing: 300, onsen: 80, souvenir: 60, food: 400 };

/**
 * 愛媛の郷土料理・名物キーワード。
 *
 * かつては「これに一致する店だけを載せる」許可リストとして使っていたため、
 * 県内の飲食店が4件しか残らず、半径5kmの食事候補が枯れていた。今は
 * **除外条件ではなく優先度**として使う: 一致した店は cap で切られる前に先頭へ
 * 並び、チェーン判定よりも優先して残す（名物店が全国チェーン名を含む場合の救済）。
 */
const LOCAL_FOOD = /(鯛めし|鯛飯|たいめし|タイメシ|みかん|ミカン|蜜柑|柑橘|ポンジュース|三津浜焼|みつはま|三津浜|焼豚玉子飯|今治焼豚|じゃこ天|じゃこ|鍋焼きうどん|五色そうめん|そうめん|八幡浜ちゃんぽん|ちゃんぽん|さつま汁|削りかまぼこ|かまぼこ|蒲鉾|労研饅頭|労研|母恵夢|タルト|ぽん菓子|芋炊き|郷土料理)/i;

/**
 * 愛媛の名物店で、複数店舗を持つために「チェーン」と誤判定されうるもの。
 * 郷土料理キーワードを名前に含まないので LOCAL_FOOD では拾えず、明示的に守る。
 */
const LOCAL_BRANDS = [
  "白楽天",
  "重松飯店",
  "丸水",
  "五志喜",
  "ほづみ亭",
  "10 FACTORY",
  "一六本舗",
  "ハタダ",
  "亀井餅舗",
];

/**
 * 全国チェーン / 大手フランチャイズの店名。
 *
 * 旅行者に薦める価値が薄く、件数だけを食って地元の店を cap から押し出すため
 * 除外する。網羅は目的ではない（取りこぼしても害は小さい）ので、愛媛で実際に
 * 見かける規模のものを挙げている。
 */
const CHAIN_NAMES = [
  // ファストフード
  "マクドナルド", "McDonald", "モスバーガー", "MOS BURGER", "ケンタッキー", "KFC",
  "ロッテリア", "フレッシュネス", "バーガーキング", "サブウェイ", "Subway",
  // 丼・定食・弁当
  "吉野家", "すき家", "松屋", "なか卯", "かつや", "松のや", "てんや", "大戸屋",
  "やよい軒", "ほっともっと", "オリジン弁当",
  // ファミリーレストラン
  "ガスト", "サイゼリヤ", "ジョイフル", "びっくりドンキー", "バーミヤン", "しゃぶ葉",
  "ジョナサン", "デニーズ", "ロイヤルホスト", "ココス", "COCO'S", "和食さと",
  "夢庵", "藍屋", "かっぱ食堂",
  // 麺類
  "丸亀製麺", "はなまるうどん", "ゆで太郎", "小諸そば", "リンガーハット",
  "幸楽苑", "日高屋", "天下一品", "一蘭", "一風堂", "丸源ラーメン", "町田商店",
  "スガキヤ",
  // 寿司
  "くら寿司", "スシロー", "はま寿司", "かっぱ寿司", "銚子丸", "平禄寿司", "魚べい",
  // カレー・中華
  "CoCo壱番屋", "ココイチ", "餃子の王将", "大阪王将", "ぎょうざの満洲",
  // 焼肉・ステーキ
  "牛角", "焼肉きんぐ", "あみやき亭", "安楽亭", "いきなりステーキ", "ペッパーランチ",
  "焼肉ライク",
  // カフェ
  "スターバックス", "STARBUCKS", "ドトール", "DOUTOR", "タリーズ", "TULLY",
  "コメダ", "珈琲館", "サンマルクカフェ", "ベローチェ", "プロント", "エクセルシオール",
  "上島珈琲", "星乃珈琲", "むさしの森珈琲", "カフェ・ド・クリエ", "シャノアール",
  // スイーツ・ドーナツ
  "ミスタードーナツ", "ミスド", "クリスピー", "サーティワン", "シャトレーゼ",
  "不二家", "コールドストーン",
  // ピザ
  "ドミノ・ピザ", "ドミノピザ", "ピザハット", "ピザーラ", "ナポリの窯",
  // 居酒屋
  "鳥貴族", "和民", "ワタミ", "白木屋", "魚民", "笑笑", "千年の宴", "目利きの銀次",
  "磯丸水産", "串カツ田中", "塚田農場", "はなの舞", "山内農場",
  // ベーカリー
  "リトルマーメイド", "ヴィ・ド・フランス", "サンジェルマン",
];

/** Escape a literal so it can sit inside a RegExp alternation safely. */
function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toAlternation(literals) {
  return new RegExp(`(${literals.map(escapeRegExp).join("|")})`, "i");
}

const CHAIN_RE = toAlternation(CHAIN_NAMES);
const LOCAL_BRAND_RE = toAlternation(LOCAL_BRANDS);

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

/** Every name variant OSM might carry, for chain / local-brand matching. */
function nameHaystack(tags) {
  return [tags.name, tags["name:ja"], tags["name:en"], tags.brand]
    .filter(Boolean)
    .join(" ");
}

/** 愛媛の郷土料理・名物の店か。チェーン判定より優先される。 */
function isLocalFood(tags) {
  return LOCAL_FOOD.test(foodHaystack(tags)) || LOCAL_BRAND_RE.test(nameHaystack(tags));
}

/**
 * 全国チェーンの店舗か。
 *
 * `brand:wikidata` / `brand:wikipedia` は OSM ではほぼチェーンにしか付かないので
 * 名前リストより信頼できる一次signal。素の `brand` も併用し、リストは
 * ブランドタグが未整備な店舗の取りこぼしを埋める役。
 */
function isChainFood(tags) {
  if (tags["brand:wikidata"] || tags["brand:wikipedia"]) return true;
  if (tags.brand) return true;
  return CHAIN_RE.test(nameHaystack(tags));
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
  const collected = { food: [], sightseeing: [], onsen: [], souvenir: [] };
  let chainsSkipped = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags["name:ja"] || tags.name;
    if (!name) continue;
    const cat = categorize(tags);
    if (!cat) continue;
    // 全国チェーンは除外し、それ以外の飲食店は残す。郷土料理・名物の店は
    // チェーン判定より優先して必ず残す。
    const local = cat === "food" && isLocalFood(tags);
    if (cat === "food" && !local && isChainFood(tags)) {
      chainsSkipped += 1;
      continue;
    }
    const loc = coordsOf(el);
    if (!loc) continue;

    // Dedupe by name + rounded coords.
    const key = `${name}@${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const nameEn = tags["name:en"];
    const website = tags.website || tags["contact:website"] || tags.url || undefined;
    // Prefer a real attraction description from OSM; fall back to name-based.
    const desc = tags["description:ja"] || tags.description || undefined;
    collected[cat].push({
      id: `osm-${el.type}-${el.id}`,
      name,
      category: cat,
      local,
      location: { lat: Number(loc.lat.toFixed(6)), lng: Number(loc.lng.toFixed(6)) },
      ja: desc ? desc : `${name}（${CATEGORY_JA[cat]}）`,
      en: nameEn ? `${nameEn} (${cat})` : undefined,
      openingHours: tags.opening_hours || undefined,
      website: website && /^https?:\/\//.test(website) ? website : undefined,
    });
  }

  // 名物店を先頭へ寄せてから cap を適用する。cap で切られるのは必ず「郷土料理
  // キーワードに一致しない普通の飲食店」の側になる。同グループ内は名前順に
  // そろえて、Overpass の応答順が変わっても同じファイルが出るようにする。
  // 他カテゴリは並べ替えない: 名前順にすると cap で残る300件が変わり、松山城の
  // ような主要スポットが落ちうる。
  collected.food.sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    if (a.name === b.name) return 0;
    return a.name < b.name ? -1 : 1;
  });

  const byCat = {};
  for (const [cat, list] of Object.entries(collected)) {
    byCat[cat] = list.slice(0, CAPS[cat]);
  }

  const all = [...byCat.food, ...byCat.sightseeing, ...byCat.onsen, ...byCat.souvenir];
  const localFoodKept = byCat.food.filter((s) => s.local).length;
  console.log(
    `Kept: food=${byCat.food.length} (名物 ${localFoodKept}) sightseeing=${byCat.sightseeing.length} onsen=${byCat.onsen.length} souvenir=${byCat.souvenir.length} total=${all.length}`,
  );
  console.log(
    `Food before cap: ${collected.food.length} / chains skipped: ${chainsSkipped}`,
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
 * food: 全国チェーンを除いた飲食店。愛媛の郷土料理・名物の店を先頭に並べてある。
 *
 * Generated: ${new Date().toISOString()}
 * Count: ${all.length} (food ${byCat.food.length} / sightseeing ${byCat.sightseeing.length} / onsen ${byCat.onsen.length} / souvenir ${byCat.souvenir.length})
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
