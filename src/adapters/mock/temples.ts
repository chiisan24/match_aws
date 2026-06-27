/**
 * Fixed mock dataset of the 26 Ehime pilgrimage temples (札所 40–65).
 *
 * Data is realistic-but-clearly-mock: temple numbers (40–65) and names are
 * factual place identifiers, coordinates are approximate Ehime locations, and
 * the descriptions are short development-only placeholders (NOT verbatim
 * copies of any copyrighted source — paraphrased per design research notes).
 * `parking` / `restrooms` are dummy facility flags (Q2), and `imageUrls` point
 * at local placeholder assets (Req 4.7).
 */

import type { Temple } from "../../ports";

/** Compact seed row; expanded into a full {@link Temple} below. */
interface TempleSeed {
  number: number;
  name: string;
  city: string;
  lat: number;
  lng: number;
  parking: boolean;
  restrooms: boolean;
}

// Numbers 40–65 are the Ehime札所 of the 四国八十八ヶ所. Coordinates are
// approximate and intended for mock rendering only.
const SEEDS: TempleSeed[] = [
  { number: 40, name: "観自在寺", city: "愛南町", lat: 32.9633, lng: 132.5717, parking: true, restrooms: true },
  { number: 41, name: "龍光寺", city: "宇和島市", lat: 33.2722, lng: 132.5594, parking: true, restrooms: true },
  { number: 42, name: "仏木寺", city: "宇和島市", lat: 33.2856, lng: 132.5469, parking: true, restrooms: false },
  { number: 43, name: "明石寺", city: "西予市", lat: 33.3589, lng: 132.5106, parking: true, restrooms: true },
  { number: 44, name: "大寶寺", city: "久万高原町", lat: 33.6553, lng: 132.9039, parking: true, restrooms: true },
  { number: 45, name: "岩屋寺", city: "久万高原町", lat: 33.6444, lng: 132.9686, parking: false, restrooms: true },
  { number: 46, name: "浄瑠璃寺", city: "松山市", lat: 33.7611, lng: 132.8083, parking: true, restrooms: true },
  { number: 47, name: "八坂寺", city: "松山市", lat: 33.7639, lng: 132.8014, parking: true, restrooms: false },
  { number: 48, name: "西林寺", city: "松山市", lat: 33.7806, lng: 132.8064, parking: true, restrooms: true },
  { number: 49, name: "浄土寺", city: "松山市", lat: 33.8089, lng: 132.8131, parking: false, restrooms: true },
  { number: 50, name: "繁多寺", city: "松山市", lat: 33.8147, lng: 132.8033, parking: true, restrooms: true },
  { number: 51, name: "石手寺", city: "松山市", lat: 33.8489, lng: 132.7958, parking: true, restrooms: true },
  { number: 52, name: "太山寺", city: "松山市", lat: 33.8806, lng: 132.7308, parking: true, restrooms: true },
  { number: 53, name: "圓明寺", city: "松山市", lat: 33.8856, lng: 132.7339, parking: true, restrooms: false },
  { number: 54, name: "延命寺", city: "今治市", lat: 34.0317, lng: 132.9858, parking: true, restrooms: true },
  { number: 55, name: "南光坊", city: "今治市", lat: 34.0631, lng: 132.9981, parking: true, restrooms: true },
  { number: 56, name: "泰山寺", city: "今治市", lat: 34.0489, lng: 133.0119, parking: true, restrooms: false },
  { number: 57, name: "栄福寺", city: "今治市", lat: 34.0319, lng: 133.0286, parking: false, restrooms: true },
  { number: 58, name: "仙遊寺", city: "今治市", lat: 34.0392, lng: 133.0506, parking: true, restrooms: true },
  { number: 59, name: "国分寺", city: "今治市", lat: 34.0436, lng: 133.0258, parking: true, restrooms: true },
  { number: 60, name: "横峰寺", city: "西条市", lat: 33.8967, lng: 133.1108, parking: false, restrooms: true },
  { number: 61, name: "香園寺", city: "西条市", lat: 33.9081, lng: 133.1417, parking: true, restrooms: true },
  { number: 62, name: "宝寿寺", city: "西条市", lat: 33.9106, lng: 133.1497, parking: true, restrooms: false },
  { number: 63, name: "吉祥寺", city: "西条市", lat: 33.9078, lng: 133.1567, parking: true, restrooms: true },
  { number: 64, name: "前神寺", city: "西条市", lat: 33.9097, lng: 133.1842, parking: true, restrooms: true },
  { number: 65, name: "三角寺", city: "四国中央市", lat: 33.9911, lng: 133.5392, parking: true, restrooms: true },
];

function toTemple(seed: TempleSeed): Temple {
  const { number, name, city, lat, lng, parking, restrooms } = seed;
  return {
    id: `ehime-${number}`,
    number,
    name,
    prefecture: "ehime",
    location: { lat, lng },
    address: `愛媛県${city}（モックデータ）`,
    localizedDescriptions: {
      ja: `${name}は四国八十八ヶ所霊場の第${number}番札所で、愛媛県${city}にあります。これは開発用のモック解説文です。`,
      en: `${name} is temple No. ${number} of the Shikoku 88-temple pilgrimage, located in ${city}, Ehime. This is mock placeholder text for development.`,
    },
    history: `第${number}番札所「${name}」の縁起（モック）。本番では出典付きの解説に差し替えます。`,
    highlights: ["本堂", "大師堂", "山門"],
    photoSpots: ["山門前", "本堂前"],
    parking,
    restrooms,
    imageUrls: [`/images/placeholder/temple-${number}.svg`],
  };
}

/** The fixed list of 26 Ehime temples (numbers 40–65), in ascending order. */
export const EHIME_TEMPLES: Temple[] = SEEDS.map(toTemple);
