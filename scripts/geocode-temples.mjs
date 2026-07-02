/**
 * One-off geocoding helper: resolves accurate coordinates for each Ehime
 * pilgrimage temple (札所 40–65). Temples are POIs, not just addresses, so the
 * primary source is OpenStreetMap (Nominatim), which has each temple tagged as
 * "第N番札所 …" with an accurate point. Fallbacks: a plain name+city Nominatim
 * search, then the 国土地理院 (GSI) address geocoder.
 *
 * Prints `number -> { name, address, lat, lng, source }` and flags large moves
 * from the previous approximate seed. Run: `node scripts/geocode-temples.mjs`.
 *
 * Please respect the Nominatim usage policy (≤1 req/sec, descriptive UA).
 */

const TEMPLES = [
  { n: 40, name: "観自在寺", address: "愛媛県南宇和郡愛南町御荘平城2253-1", seed: [32.9633, 132.5717] },
  { n: 41, name: "龍光寺", address: "愛媛県宇和島市三間町戸雁173", seed: [33.2722, 132.5594] },
  { n: 42, name: "仏木寺", address: "愛媛県宇和島市三間町則1683", seed: [33.2856, 132.5469] },
  { n: 43, name: "明石寺", address: "愛媛県西予市宇和町明石201", seed: [33.3589, 132.5106] },
  { n: 44, name: "大寶寺", address: "愛媛県上浮穴郡久万高原町菅生2-1173-2", seed: [33.6553, 132.9039] },
  { n: 45, name: "岩屋寺", address: "愛媛県上浮穴郡久万高原町七鳥1468", seed: [33.6444, 132.9686] },
  { n: 46, name: "浄瑠璃寺", address: "愛媛県松山市浄瑠璃町282", seed: [33.7611, 132.8083] },
  { n: 47, name: "八坂寺", address: "愛媛県松山市浄瑠璃町八坂773", seed: [33.7639, 132.8014] },
  { n: 48, name: "西林寺", address: "愛媛県松山市高井町1007", seed: [33.7806, 132.8064] },
  { n: 49, name: "浄土寺", address: "愛媛県松山市鷹子町1198", seed: [33.8089, 132.8131] },
  { n: 50, name: "繁多寺", address: "愛媛県松山市畑寺町32", seed: [33.8147, 132.8033] },
  { n: 51, name: "石手寺", address: "愛媛県松山市石手二丁目9-21", seed: [33.8489, 132.7958] },
  { n: 52, name: "太山寺", address: "愛媛県松山市太山寺町1730", seed: [33.8806, 132.7308] },
  { n: 53, name: "圓明寺", address: "愛媛県松山市和気町1-182", seed: [33.8856, 132.7339] },
  { n: 54, name: "延命寺", address: "愛媛県今治市阿方甲636", seed: [34.0317, 132.9858] },
  { n: 55, name: "南光坊", address: "愛媛県今治市別宮町3-1", seed: [34.0631, 132.9981] },
  { n: 56, name: "泰山寺", address: "愛媛県今治市小泉1-9-18", seed: [34.0489, 133.0119] },
  { n: 57, name: "栄福寺", address: "愛媛県今治市玉川町八幡甲200", seed: [34.0319, 133.0286] },
  { n: 58, name: "仙遊寺", address: "愛媛県今治市玉川町別所甲483", seed: [34.0392, 133.0506] },
  { n: 59, name: "国分寺", address: "愛媛県今治市国分4-1-33", seed: [34.0436, 133.0258] },
  { n: 60, name: "横峰寺", address: "愛媛県西条市小松町石鎚甲2253", seed: [33.8967, 133.1108] },
  { n: 61, name: "香園寺", address: "愛媛県西条市小松町南川甲19", seed: [33.9081, 133.1417] },
  { n: 62, name: "宝寿寺", address: "愛媛県西条市小松町新屋敷甲428", seed: [33.9106, 133.1497] },
  { n: 63, name: "吉祥寺", address: "愛媛県西条市氷見乙1048", seed: [33.9078, 133.1567] },
  { n: 64, name: "前神寺", address: "愛媛県西条市洲之内甲1426", seed: [33.9097, 133.1842] },
  { n: 65, name: "三角寺", address: "愛媛県四国中央市金田町三角寺甲75", seed: [33.9911, 133.5392] },
];

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const GSI = "https://msearch.gsi.go.jp/address-search/AddressSearch";
const UA = "ehime-tourism-app/1.0 (dev one-off temple geocode)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function distanceKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function nominatim(q) {
  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=jp&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d[0]) return null;
  return { lat: Number(d[0].lat), lng: Number(d[0].lon), title: d[0].display_name };
}

async function gsi(address) {
  const res = await fetch(`${GSI}?q=${encodeURIComponent(address)}`);
  if (!res.ok) return null;
  const d = await res.json();
  const hit = Array.isArray(d) ? d[0] : null;
  if (!hit?.geometry?.coordinates) return null;
  const [lng, lat] = hit.geometry.coordinates;
  return { lat, lng, title: hit.properties?.title ?? "" };
}

const out = {};
for (const t of TEMPLES) {
  let hit = await nominatim(`第${t.n}番札所 ${t.name}`);
  let source = "osm:satsu";
  await sleep(1200);
  if (!hit) {
    hit = await nominatim(`${t.name} ${t.address.replace(/^愛媛県/, "")}`);
    source = "osm:name";
    await sleep(1200);
  }
  if (!hit) {
    hit = await gsi(t.address);
    source = "gsi:address";
    await sleep(300);
  }
  if (!hit) {
    console.log(`${t.n} ${t.name}\tNO RESULT`);
    continue;
  }
  const d = distanceKm(t.seed, [hit.lat, hit.lng]);
  out[t.n] = {
    lat: Number(hit.lat.toFixed(6)),
    lng: Number(hit.lng.toFixed(6)),
    address: t.address,
  };
  console.log(
    `${t.n} ${t.name}\t${hit.lat.toFixed(6)},${hit.lng.toFixed(6)}\t${source}\tΔ${d.toFixed(1)}km\t${hit.title.slice(0, 44)}`,
  );
}

console.log("\n---JSON---");
console.log(JSON.stringify(out));
