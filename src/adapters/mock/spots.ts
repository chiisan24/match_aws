/**
 * Fixed mock sightseeing/food spots for Ehime.
 *
 * Used by the mock {@link ChatPort} to hand back swipe candidates at
 * destination-discovery moments (Req 3.2). Dummy data only (Q3) — no scraped
 * or third-party content. Images are local placeholders (Req 4.7).
 */

import type { Spot } from "../../ports";

export const EHIME_SPOTS: Spot[] = [
  {
    id: "spot-dogo-onsen",
    name: "道後温泉エリア",
    category: "onsen",
    location: { lat: 33.852, lng: 132.7866 },
    localizedDescriptions: {
      ja: "松山を代表する温泉街（モック紹介文）。レトロな街並みと足湯が楽しめます。",
      en: "Matsuyama's iconic hot-spring district (mock blurb). Retro streets and foot baths.",
    },
    popularityRank: 1,
    reviews: [
      { author: "mock_user_a", rating: 5, text: "夜の雰囲気が最高でした（モック口コミ）。" },
    ],
    imageUrls: ["/images/placeholder/spot-dogo.svg"],
  },
  {
    id: "spot-matsuyama-castle",
    name: "松山城",
    category: "sightseeing",
    location: { lat: 33.8457, lng: 132.7657 },
    localizedDescriptions: {
      ja: "市街を見下ろす城（モック紹介文）。ロープウェイで気軽に登れます。",
      en: "Hilltop castle overlooking the city (mock blurb). Easy access by ropeway.",
    },
    popularityRank: 2,
    reviews: [
      { author: "mock_user_b", rating: 4, text: "眺めが良かったです（モック口コミ）。" },
    ],
    imageUrls: ["/images/placeholder/spot-castle.svg"],
  },
  {
    id: "spot-mikan-sweets",
    name: "みかんスイーツ店",
    category: "food",
    location: { lat: 33.8392, lng: 132.7656 },
    localizedDescriptions: {
      ja: "愛媛みかんを使ったスイーツ店（モック紹介文）。",
      en: "Sweets shop featuring Ehime mikan oranges (mock blurb).",
    },
    popularityRank: 3,
    reviews: [
      { author: "mock_user_c", rating: 5, text: "みかんジュースが濃厚（モック口コミ）。" },
    ],
    imageUrls: ["/images/placeholder/spot-mikan.svg"],
  },
  {
    id: "spot-shimanami",
    name: "しまなみ海道",
    category: "sightseeing",
    location: { lat: 34.1086, lng: 133.0027 },
    localizedDescriptions: {
      ja: "瀬戸内をつなぐサイクリングルート（モック紹介文）。",
      en: "Cycling route across the Seto Inland Sea (mock blurb).",
    },
    popularityRank: 4,
    reviews: [
      { author: "mock_user_d", rating: 5, text: "サイクリングが気持ちいい（モック口コミ）。" },
    ],
    imageUrls: ["/images/placeholder/spot-shimanami.svg"],
  },
];
