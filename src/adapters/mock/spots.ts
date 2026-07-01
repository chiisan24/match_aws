/**
 * Fixed mock sightseeing/food spots for Ehime.
 *
 * Used by the mock {@link ChatPort} to hand back swipe candidates at
 * destination-discovery moments (Req 3.2). Dummy data only (Q3) — no scraped
 * or third-party content; all descriptions/reviews below are paraphrased mock
 * blurbs written for development. Images reference real Ehime photos dropped
 * into `public/images/ehime/<name>.jpg`; until those files exist the UI falls
 * back to the on-brand {@link PlaceholderImage} via each image's onError
 * (Req 4.7). The catalogue is intentionally broad so the swipe deck shows that
 * 愛媛は道後温泉だけじゃない — castles, islands, mountains, karst, lighthouses and
 * craft villages all appear.
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
    imageUrls: ["/images/ehime/onsen-bath.jpg"],
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
    imageUrls: ["/images/ehime/matsuyama-castle.jpg"],
  },
  {
    id: "spot-mikan-sweets",
    name: "道の駅・みかん物産",
    category: "souvenir",
    location: { lat: 33.8392, lng: 132.7656 },
    localizedDescriptions: {
      ja: "愛媛みかんの加工品やスイーツが並ぶ道の駅（モック紹介文）。地元のおみやげ探しに。",
      en: "Roadside station stocked with Ehime mikan goods and sweets (mock blurb). Great for local souvenirs.",
    },
    popularityRank: 3,
    reviews: [
      { author: "mock_user_c", rating: 5, text: "みかんジュースが濃厚（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/michi-no-eki.jpg"],
  },
  {
    id: "spot-shimanami",
    name: "しまなみ海道",
    category: "sightseeing",
    location: { lat: 34.1086, lng: 133.0027 },
    localizedDescriptions: {
      ja: "瀬戸内をつなぐサイクリングルート（モック紹介文）。来島海峡大橋の眺めが見どころ。",
      en: "Cycling route across the Seto Inland Sea (mock blurb). The Kurushima-Kaikyo bridges are the highlight.",
    },
    popularityRank: 4,
    reviews: [
      { author: "mock_user_d", rating: 5, text: "サイクリングが気持ちいい（モック口コミ）。" },
    ],
    imageUrls: [
      "/images/ehime/kurushima-bridge.jpg",
      "/images/ehime/kurushima-bridge-aerial.jpg",
    ],
  },
  {
    id: "spot-imabari-castle",
    name: "今治城",
    category: "sightseeing",
    location: { lat: 34.066, lng: 133.004 },
    localizedDescriptions: {
      ja: "海水を引き込んだ堀をもつ海城（モック紹介文）。瀬戸内の水運を見張った城です。",
      en: "A sea castle with a moat fed by seawater (mock blurb). It once watched over Seto Inland Sea trade.",
    },
    popularityRank: 5,
    reviews: [
      { author: "mock_user_e", rating: 4, text: "堀に海の魚がいて驚きました（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/imabari-castle.jpg"],
  },
  {
    id: "spot-uwajima-castle",
    name: "宇和島城",
    category: "sightseeing",
    location: { lat: 33.219, lng: 132.566 },
    localizedDescriptions: {
      ja: "現存天守が残る南予の城（モック紹介文）。小高い丘の上から城下町を望めます。",
      en: "A southern-Ehime castle with an original keep still standing (mock blurb). Views over the old town from a low hill.",
    },
    popularityRank: 6,
    reviews: [
      { author: "mock_user_f", rating: 4, text: "石垣と天守の組み合わせが良い（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/uwajima-castle.jpg"],
  },
  {
    id: "spot-uchiko-townscape",
    name: "内子の町並み",
    category: "sightseeing",
    location: { lat: 33.533, lng: 132.655 },
    localizedDescriptions: {
      ja: "木蝋で栄えた商家の町並みが残る地区（モック紹介文）。白壁の通りを散策できます。",
      en: "A preserved merchant townscape that prospered from wax-making (mock blurb). Stroll the white-walled streets.",
    },
    popularityRank: 7,
    reviews: [
      { author: "mock_user_g", rating: 5, text: "古い建物が落ち着きます（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/uchiko-townscape.jpg"],
  },
  {
    id: "spot-dogo-onsen-station",
    name: "道後温泉駅",
    category: "sightseeing",
    location: { lat: 33.851, lng: 132.787 },
    localizedDescriptions: {
      ja: "レトロな外観の路面電車の駅（モック紹介文）。坊っちゃん列車の発着点としても親しまれています。",
      en: "A retro-styled tram station (mock blurb). Beloved as a stop for the Botchan steam-style train.",
    },
    popularityRank: 8,
    reviews: [
      { author: "mock_user_h", rating: 4, text: "写真映えする駅舎でした（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/dogo-onsen-station.jpg"],
  },
  {
    id: "spot-tobe-zoo",
    name: "とべ動物園",
    category: "sightseeing",
    location: { lat: 33.749, lng: 132.789 },
    localizedDescriptions: {
      ja: "幅広い動物に出会える県立の動物園（モック紹介文）。ホッキョクグマが人気です。",
      en: "A prefectural zoo with a wide range of animals (mock blurb). The polar bears are a favourite.",
    },
    popularityRank: 9,
    reviews: [
      { author: "mock_user_i", rating: 5, text: "家族で一日楽しめました（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/tobe-zoo-polarbear.jpg"],
  },
  {
    id: "spot-shikoku-karst",
    name: "四国カルスト（放牧の牛）",
    category: "sightseeing",
    location: { lat: 33.45, lng: 132.92 },
    localizedDescriptions: {
      ja: "標高の高い草原に牛が放牧されるカルスト台地（モック紹介文）。爽快な高原ドライブが楽しめます。",
      en: "A high-altitude karst plateau where cattle graze on grassland (mock blurb). A breezy highland drive.",
    },
    popularityRank: 10,
    reviews: [
      { author: "mock_user_j", rating: 5, text: "牛とのんびり過ごせました（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/cattle-karst.jpg"],
  },
  {
    id: "spot-ishizuchi-range",
    name: "石鎚山系",
    category: "sightseeing",
    location: { lat: 33.768, lng: 133.115 },
    localizedDescriptions: {
      ja: "西日本最高峰を擁する山並み（モック紹介文）。稜線の眺めと紅葉が見どころです。",
      en: "A mountain range home to western Japan's highest peak (mock blurb). Ridgeline views and autumn colour.",
    },
    popularityRank: 11,
    reviews: [
      { author: "mock_user_k", rating: 5, text: "稜線の景色が最高（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/mountain-ridge.jpg"],
  },
  {
    id: "spot-omishima-museum",
    name: "大三島美術館",
    category: "sightseeing",
    location: { lat: 34.25, lng: 133.07 },
    localizedDescriptions: {
      ja: "しまなみの島にある美術館（モック紹介文）。静かな空間で作品を鑑賞できます。",
      en: "An art museum on an island along the Shimanami route (mock blurb). Enjoy the works in a quiet space.",
    },
    popularityRank: 12,
    reviews: [
      { author: "mock_user_l", rating: 4, text: "建築も含めて見ごたえあり（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/omishima-museum.jpg"],
  },
  {
    id: "spot-sadamisaki-lighthouse",
    name: "佐田岬の灯台",
    category: "sightseeing",
    location: { lat: 33.35, lng: 132.02 },
    localizedDescriptions: {
      ja: "四国最西端に立つ白い灯台（モック紹介文）。細長い岬の先で海を望めます。",
      en: "A white lighthouse at the westernmost tip of Shikoku (mock blurb). Ocean views from the end of a long cape.",
    },
    popularityRank: 13,
    reviews: [
      { author: "mock_user_m", rating: 4, text: "風が強いけど絶景でした（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/lighthouse.jpg"],
  },
  {
    id: "spot-sotodomari",
    name: "外泊 石垣の里",
    category: "sightseeing",
    location: { lat: 32.93, lng: 132.49 },
    localizedDescriptions: {
      ja: "斜面に石垣が積まれた漁村集落（モック紹介文）。家々を風から守る石垣の景観が独特です。",
      en: "A fishing hamlet of stacked stone walls on a slope (mock blurb). The walls that shield homes from wind are striking.",
    },
    popularityRank: 14,
    reviews: [
      { author: "mock_user_n", rating: 4, text: "迷路のような路地が楽しい（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/sotodomari-village.jpg"],
  },
  {
    id: "spot-tobeyaki",
    name: "砥部焼の里",
    category: "souvenir",
    location: { lat: 33.745, lng: 132.79 },
    localizedDescriptions: {
      ja: "白磁に藍の絵付けで知られる砥部焼の産地（モック紹介文）。窯元やお店で器を選べます。",
      en: "Home of Tobe-yaki porcelain, known for indigo painting on white (mock blurb). Browse kilns and shops for tableware.",
    },
    popularityRank: 15,
    reviews: [
      { author: "mock_user_o", rating: 5, text: "普段使いの器を買えました（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/tobeyaki-shop.jpg"],
  },
  {
    id: "spot-namegawa-autumn",
    name: "滑床渓谷の紅葉",
    category: "sightseeing",
    location: { lat: 33.30, lng: 132.66 },
    localizedDescriptions: {
      ja: "なめらかな岩肌を水が流れる渓谷（モック紹介文）。秋は橋の周りの紅葉が見事です。",
      en: "A gorge where water glides over smooth rock (mock blurb). In autumn the foliage around the bridge is superb.",
    },
    popularityRank: 16,
    reviews: [
      { author: "mock_user_p", rating: 5, text: "紅葉と渓流の組み合わせが綺麗（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/autumn-bridge.jpg"],
  },
  {
    id: "spot-seaside-station",
    name: "海辺の駅（下灘など）",
    category: "sightseeing",
    location: { lat: 33.66, lng: 132.62 },
    localizedDescriptions: {
      ja: "ホームのすぐ先に海が広がる無人駅（モック紹介文）。夕暮れ時の景色が人気です。",
      en: "An unmanned station with the sea spreading out just beyond the platform (mock blurb). The sunset view is a favourite.",
    },
    popularityRank: 17,
    reviews: [
      { author: "mock_user_q", rating: 5, text: "海とホームの眺めが最高でした（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/seaside-station.jpg"],
  },
  {
    id: "spot-seaside-rails",
    name: "海辺の線路（干潮の軌道跡）",
    category: "sightseeing",
    location: { lat: 33.95, lng: 132.7 },
    localizedDescriptions: {
      ja: "海沿いに延びる線路と干潮の風景（モック紹介文）。潮が引くと現れる軌道跡が印象的です。",
      en: "Rails stretching along the shore with a low-tide scene (mock blurb). The track bed revealed at ebb tide is striking.",
    },
    popularityRank: 18,
    reviews: [
      { author: "mock_user_r", rating: 4, text: "潮の引いた時間がねらい目です（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/seaside-rails.jpg"],
  },
  {
    id: "spot-garden-zashiki",
    name: "庭園と座敷（紅葉）",
    category: "sightseeing",
    location: { lat: 33.84, lng: 132.78 },
    localizedDescriptions: {
      ja: "座敷から庭園を望む和の空間（モック紹介文）。秋は紅葉が額縁のように楽しめます。",
      en: "A Japanese space where the garden is viewed from a tatami room (mock blurb). In autumn the foliage frames the scene.",
    },
    popularityRank: 19,
    reviews: [
      { author: "mock_user_s", rating: 5, text: "座敷から眺める紅葉が見事でした（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/garden-zashiki.jpg"],
  },
  {
    id: "spot-fujiwara-bridge",
    name: "藤原大橋（山あいのアーチ橋）",
    category: "sightseeing",
    location: { lat: 33.62, lng: 132.92 },
    localizedDescriptions: {
      ja: "山あいの谷に架かるアーチ橋（モック紹介文）。緑に映える曲線が見どころです。",
      en: "An arch bridge spanning a valley in the mountains (mock blurb). Its curve set against the greenery is the highlight.",
    },
    popularityRank: 20,
    reviews: [
      { author: "mock_user_t", rating: 4, text: "山と橋のコントラストが綺麗でした（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/fujiwara-bridge.jpg"],
  },
  {
    id: "spot-imabari-shipyard",
    name: "今治の造船所",
    category: "sightseeing",
    location: { lat: 34.06, lng: 133.0 },
    localizedDescriptions: {
      ja: "瀬戸内の海運を支える造船の町の風景（モック紹介文）。大きな船とクレーンが迫力です。",
      en: "A shipbuilding-town scene that supports Seto Inland Sea shipping (mock blurb). The large vessels and cranes are impressive.",
    },
    popularityRank: 21,
    reviews: [
      { author: "mock_user_u", rating: 4, text: "船の大きさに圧倒されました（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/shipyard.jpg"],
  },
  {
    id: "spot-rice-straw",
    name: "稲わらの田園風景（にお積み）",
    category: "sightseeing",
    location: { lat: 33.78, lng: 132.78 },
    localizedDescriptions: {
      ja: "稲刈り後の田にわらを積んだ里の風景（モック紹介文）。のどかな秋の田園が広がります。",
      en: "A countryside scene with straw stacked in harvested rice fields (mock blurb). A peaceful expanse of autumn farmland.",
    },
    popularityRank: 22,
    reviews: [
      { author: "mock_user_v", rating: 4, text: "懐かしい田園風景に癒やされました（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/rice-straw.jpg"],
  },
  {
    id: "spot-setouchi-shrine",
    name: "瀬戸内の古社",
    category: "sightseeing",
    location: { lat: 34.25, lng: 133.06 },
    localizedDescriptions: {
      ja: "狛犬が迎える島の古い神社（モック紹介文）。静かな境内で旅の安全を祈れます。",
      en: "An old island shrine welcomed by guardian lion-dogs (mock blurb). Pray for safe travels in the quiet precinct.",
    },
    popularityRank: 23,
    reviews: [
      { author: "mock_user_w", rating: 5, text: "厳かな雰囲気が良かったです（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/shrine.jpg"],
  },
  {
    id: "spot-brick-studio",
    name: "煉瓦の手しごと工房",
    category: "souvenir",
    location: { lat: 33.64, lng: 132.9 },
    localizedDescriptions: {
      ja: "煉瓦造りの建物で手しごとに触れられる工房（モック紹介文）。手づくりの品をおみやげに選べます。",
      en: "A brick-built studio where you can experience handcrafts (mock blurb). Pick up handmade pieces as souvenirs.",
    },
    popularityRank: 24,
    reviews: [
      { author: "mock_user_x", rating: 5, text: "作り手の温もりが感じられました（モック口コミ）。" },
    ],
    imageUrls: ["/images/ehime/brick-studio.jpg"],
  },
  {
    id: "spot-museum-corridor",
    name: "美術館の階段と回廊（建築の見どころ）",
    category: "sightseeing",
    location: { lat: 33.84, lng: 132.77 },
    localizedDescriptions: {
      ja: "光と影が美しい階段と回廊をもつ美術館（モック紹介文）。建築そのものが見どころです。",
      en: "A museum with stairs and corridors of beautiful light and shadow (mock blurb). The architecture itself is the highlight.",
    },
    popularityRank: 25,
    reviews: [
      { author: "mock_user_y", rating: 5, text: "建築のディテールに見入ってしまいました（モック口コミ）。" },
    ],
    imageUrls: [
      "/images/ehime/museum-corridor.jpg",
      "/images/ehime/museum-stairs.jpg",
    ],
  },
];
