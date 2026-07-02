/**
 * Accurate geolocation + official street address for the 26 Ehime pilgrimage
 * temples (札所 40–65), used to place map pins precisely (札所マップ /
 * 重ねるマップ / 次の札所ナビ / 到着シート).
 *
 * Coordinates were resolved from the temples' real locations rather than
 * approximate guesses: primarily OpenStreetMap's "第N番札所 …" points (the
 * actual temple POIs), with the 国土地理院 (GSI) address geocoder as a fallback
 * for a couple of addresses that resolve to an exact 番地. Both are open data.
 * The generation helper lives at `scripts/geocode-temples.mjs` and can be re-run
 * to refresh these values.
 *
 * Keyed by temple number so it can grow to cover the remaining 四国 88 札所.
 */

export interface TempleGeo {
  /** Official street address (都道府県〜番地). */
  address: string;
  /** Latitude (WGS84). */
  lat: number;
  /** Longitude (WGS84). */
  lng: number;
}

export const TEMPLE_GEO: Record<number, TempleGeo> = {
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
  65: { address: "愛媛県四国中央市金田町三角寺甲75", lat: 33.967373, lng: 133.586636 },
};
