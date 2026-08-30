/**
 * 一時調査スクリプト（使い捨て。確認後に削除する）。
 *
 * Google Places API (New) の Nearby Search で「休憩に寄れる場所」を取れるかを
 * 実際のキーで確かめる。目的は2つ。
 *   1. includedTypes に指定できる型名を確定する（無効な型は 400 で弾かれる）
 *   2. 面河渓のような山間部で実際に件数が出るかを見る
 *
 * 鍵の値は一切出力しない。出力は型名 / HTTP ステータス / 件数 / 施設名のみ。
 */
import { readFileSync } from "node:fs";

function loadKey() {
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index === -1) continue;
    if (line.slice(0, index).trim() !== "GOOGLE_MAPS_API_KEY") continue;
    return line.slice(index + 1).trim();
  }
  throw new Error("GOOGLE_MAPS_API_KEY not found in .env.local");
}

const KEY = loadKey();

/** 面河渓のあたり（502 を踏んだエリア）と、対照として松山市中心部。 */
const AREAS = [
  { label: "面河渓 (山間部)", lat: 33.6800, lng: 133.0500, radius: 10000 },
  { label: "松山市中心部", lat: 33.8416, lng: 132.7657, radius: 3000 },
];

const TYPE_CANDIDATES = [
  "park",
  "national_park",
  "garden",
  "plaza",
  "picnic_ground",
  "community_center",
  "rest_stop",
  "tourist_information_center",
  "public_bath",
  "convenience_store",
];

async function nearby(types, area) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.types,places.location",
    },
    body: JSON.stringify({
      includedTypes: types,
      languageCode: "ja",
      regionCode: "JP",
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude: area.lat, longitude: area.lng },
          radius: area.radius,
        },
      },
    }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: res.status, body };
}

// 1. 型名の有効性を1件ずつ確かめる（無効なら 400 とメッセージが返る）。
console.log("=== includedTypes validity (probe area: 松山) ===");
const valid = [];
for (const type of TYPE_CANDIDATES) {
  const { status, body } = await nearby([type], AREAS[1]);
  if (status === 200) {
    valid.push(type);
    console.log(`  ${type.padEnd(28)} OK   results=${(body.places ?? []).length}`);
  } else {
    const message = body?.error?.message ?? body?.raw ?? "";
    console.log(`  ${type.padEnd(28)} ${status}  ${String(message).slice(0, 120)}`);
  }
}

// 2. 有効な型をまとめて、各エリアで何件取れるかを見る。
console.log("\n=== combined search with valid types ===");
for (const area of AREAS) {
  const { status, body } = await nearby(valid, area);
  const places = body.places ?? [];
  console.log(`\n[${area.label}] radius=${area.radius}m status=${status} count=${places.length}`);
  for (const place of places.slice(0, 12)) {
    console.log(`   - ${place.displayName?.text ?? "(no name)"}  types=${(place.types ?? []).slice(0, 3).join("/")}`);
  }
}
