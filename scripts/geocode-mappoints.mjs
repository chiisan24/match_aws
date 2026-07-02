/**
 * One-off geocoder for the 重ねるマップ non-temple layers (道の駅・休憩所・
 * サイクリング拠点・グルメ). Resolves real POIs / areas to accurate coordinates
 * via OpenStreetMap (Nominatim), with the 国土地理院 (GSI) geocoder as fallback.
 *
 * Gourmet follows "案A": area × local specialty (no specific private shops), so
 * each gourmet entry geocodes a well-known landmark/area, not a business.
 *
 * Output: JSON grouped by layer, pasted into `src/data/mapPoints.ts`.
 * Run: `node scripts/geocode-mappoints.mjs` (respects Nominatim ≤1 req/s).
 */

const UA = "ehime-tourism-app/1.0 (dev one-off mappoints geocode)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const GSI = "https://msearch.gsi.go.jp/address-search/AddressSearch";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** query: OSM search term; label: UI label; id: stable id. */
const REST_AREA = [
  { id: "michi-mikame", query: "道の駅 みかめ 西予市", label: "道の駅 みかめ" },
  { id: "michi-kisaiya", query: "道の駅 きさいや広場 宇和島市", label: "道の駅 きさいや広場" },
  { id: "michi-mima", query: "道の駅 みま 宇和島市", label: "道の駅 みま" },
  { id: "michi-karari", query: "道の駅 内子フレッシュパークからり", label: "道の駅 内子フレッシュパークからり" },
  { id: "michi-sansan", query: "道の駅 天空の郷さんさん 久万高原町", label: "道の駅 天空の郷さんさん" },
  { id: "michi-oda", query: "道の駅 小田の郷せせらぎ", label: "道の駅 小田の郷せせらぎ" },
  { id: "michi-kazahaya", query: "道の駅 風早の郷風和里 松山市", label: "道の駅 風早の郷風和里" },
  { id: "michi-yunoura", query: "道の駅 今治湯ノ浦温泉", label: "道の駅 今治湯ノ浦温泉" },
  { id: "michi-yoshiumi", query: "道の駅 よしうみいきいき館 今治市", label: "道の駅 よしうみいきいき館" },
  { id: "michi-tatara", query: "道の駅 多々羅しまなみ公園 今治市", label: "道の駅 多々羅しまなみ公園" },
  { id: "michi-komatsu", query: "道の駅 小松オアシス 西条市", label: "道の駅 小松オアシス" },
  { id: "michi-kirinomori", query: "道の駅 霧の森 四国中央市", label: "道の駅 霧の森" },
];

const CYCLING = [
  { id: "cyc-sunrise-itoyama", query: "サンライズ糸山 今治市", label: "サンライズ糸山（サイクリング拠点）" },
  { id: "cyc-imabari-sta", query: "今治駅 愛媛県", label: "今治駅 レンタサイクル" },
  { id: "cyc-kurushima", query: "来島海峡大橋", label: "来島海峡大橋 ビュースポット" },
  { id: "cyc-kirosan", query: "亀老山展望公園 今治市", label: "亀老山展望公園" },
  { id: "cyc-yoshiumi", query: "道の駅 よしうみいきいき館 今治市", label: "よしうみいきいき館（サイクルオアシス）" },
  { id: "cyc-hakata", query: "伯方S・Cパーク 今治市", label: "伯方S・Cパーク" },
  { id: "cyc-tatara", query: "多々羅しまなみ公園 今治市", label: "多々羅しまなみ公園" },
];

const RESTROOM = [
  { id: "wc-matsuyama-sta", query: "松山駅 愛媛県", label: "松山駅周辺 公衆トイレ" },
  { id: "wc-dogo", query: "道後温泉駅 松山市", label: "道後温泉周辺 公衆トイレ" },
  { id: "wc-imabari-sta", query: "今治駅 愛媛県", label: "今治駅周辺 公衆トイレ" },
];

// 案A: エリア×名物（特定店舗ではなく、名物とエリアを紹介）
const GOURMET = [
  { id: "gourmet-uwajima", query: "宇和島市役所", label: "宇和島鯛めし・じゃこ天（宇和島エリア）" },
  { id: "gourmet-yawatahama", query: "八幡浜港 愛媛県", label: "八幡浜ちゃんぽん（八幡浜エリア）" },
  { id: "gourmet-ozu", query: "大洲市役所", label: "大洲いもたき（大洲エリア）" },
  { id: "gourmet-dogo", query: "道後温泉本館 松山市", label: "鍋焼きうどん・みかん・坊っちゃん団子（道後・松山）" },
  { id: "gourmet-matsuyama", query: "松山市役所", label: "鯛そうめん・松山鮓（松山エリア）" },
  { id: "gourmet-imabari", query: "今治市役所", label: "焼豚玉子飯・せんざんき（今治エリア）" },
  { id: "gourmet-niihama", query: "新居浜市役所", label: "ざんき・いもたき（新居浜エリア）" },
  { id: "gourmet-saijo", query: "西条市役所", label: "うちぬきの水と地魚（西条エリア）" },
];

async function nominatim(q) {
  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=jp&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d[0]) return null;
  return { lat: Number(d[0].lat), lng: Number(d[0].lon), title: d[0].display_name };
}

async function gsi(q) {
  const res = await fetch(`${GSI}?q=${encodeURIComponent(q)}`);
  if (!res.ok) return null;
  const d = await res.json();
  const hit = Array.isArray(d) ? d[0] : null;
  if (!hit?.geometry?.coordinates) return null;
  const [lng, lat] = hit.geometry.coordinates;
  return { lat, lng, title: hit.properties?.title ?? "" };
}

async function resolveList(name, list) {
  const out = [];
  for (const item of list) {
    let hit = await nominatim(item.query);
    let src = "osm";
    await sleep(1200);
    if (!hit) {
      hit = await gsi(item.query.replace(/\s+愛媛県$/, ""));
      src = "gsi";
      await sleep(300);
    }
    if (!hit) {
      console.log(`[${name}] ${item.id}\tNO RESULT (${item.query})`);
      continue;
    }
    out.push({
      id: item.id,
      lat: Number(hit.lat.toFixed(6)),
      lng: Number(hit.lng.toFixed(6)),
      label: item.label,
    });
    console.log(`[${name}] ${item.id}\t${hit.lat.toFixed(5)},${hit.lng.toFixed(5)}\t${src}\t${hit.title.slice(0, 40)}`);
  }
  return out;
}

const result = {
  rest_area: await resolveList("rest_area", REST_AREA),
  cycling: await resolveList("cycling", CYCLING),
  restroom: await resolveList("restroom", RESTROOM),
  gourmet: await resolveList("gourmet", GOURMET),
};

console.log("\n---JSON---");
console.log(JSON.stringify(result, null, 2));
