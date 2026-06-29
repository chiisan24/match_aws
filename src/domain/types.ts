/**
 * Shared data models for ehime-tourism-app.
 *
 * These types mirror the design document's "Data Models" section exactly and
 * form the contract shared by the domain layer, the AWS_Gateway ports, and both
 * the mock and aws adapters (Req 16.1, 16.4). Type-only module — no runtime code.
 */

// ---------------------------------------------------------------------------
// Language & geography
// ---------------------------------------------------------------------------

/** Supported display languages. `iyo` = 伊予弁 (Iyo dialect). */
export type LangCode =
  | "ja"
  | "en"
  | "zh-Hans"
  | "zh-Hant"
  | "ko"
  | "th"
  | "fr"
  | "de"
  | "es"
  | "pt"
  | "vi"
  | "id"
  | "ar"
  | "ru"
  | "hi"
  | "iyo"; // iyo = 伊予弁

/** The four prefectures of Shikoku. */
export type ShikokuPrefecture = "ehime" | "kagawa" | "tokushima" | "kochi";

/** A geographic coordinate. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Temples & spots
// ---------------------------------------------------------------------------

/** A pilgrimage temple (札所). Ehime covers numbers 40-65. */
export interface Temple {
  id: string;
  number: number; // 札所番号 (>=1, 愛媛は 40-65)
  name: string; // 札所名 (例: 石手寺)
  prefecture: ShikokuPrefecture;
  location: GeoPoint;
  address: string;
  localizedDescriptions: Partial<Record<LangCode, string>>; // MLIT-DB 由来想定
  history?: string;
  highlights: string[]; // 見どころ
  photoSpots: string[];
  parking: boolean;
  restrooms: boolean; // トイレ/休憩所
  imageUrls: string[]; // 当面プレースホルダー (Req 4.7)
}

/** A sightseeing spot or restaurant (観光スポット/飲食店). */
export interface Spot {
  id: string;
  name: string;
  category: "sightseeing" | "food" | "souvenir" | "onsen";
  location: GeoPoint;
  localizedDescriptions: Partial<Record<LangCode, string>>;
  popularityRank?: number;
  reviews: Review[];
  imageUrls: string[]; // プレースホルダー
}

/** A user review attached to a spot. */
export interface Review {
  author: string;
  rating: number;
  text: string;
}

// ---------------------------------------------------------------------------
// AI 画像自動生成 (著作権フリー画像)
// ---------------------------------------------------------------------------

/**
 * A request to generate a royalty-free image for a spot/temple that has no
 * usable photo yet. `id` is the stable subject id and is used as the cache /
 * dedup key (and, on the AWS path, as the S3 object key) so the same subject is
 * only generated once.
 */
export interface ImagePrompt {
  /** Stable id of the subject (spot/temple id). Cache & dedup key. */
  id: string;
  /** Human-readable subject name, e.g. "道後温泉エリア". */
  subject: string;
  /** Optional descriptive context to steer generation (e.g. the ja blurb). */
  description?: string;
  /** Optional category hint used to theme the generated scene. */
  category?: Spot["category"];
}

/**
 * A generated, royalty-free image. `src` is usable directly as an `<img src>`
 * value — either an inline `data:` URL (mock / inline base64) or an `https`
 * URL (e.g. an S3 object produced by the serverless backend).
 */
export interface GeneratedImage {
  /** Image source usable directly in `<img src>`. */
  src: string;
  /** How the image was produced (for UI hints / debugging). */
  source: "ai-mock" | "ai-bedrock";
}

// ---------------------------------------------------------------------------
// Favorites, shiori (itineraries) & visit records
// ---------------------------------------------------------------------------

/** An item saved to favorites (お気に入り). */
export interface Favorite {
  itemId: string;
  itemType: "spot" | "temple";
  addedAt: string;
}

/** A single entry inside a shiori (旅程). */
export interface ShioriItem {
  itemId: string;
  order: number;
  note?: string;
}

/** A shiori (旅程 / itinerary). */
export interface Shiori {
  id: string;
  title: string;
  items: ShioriItem[];
}

/** A digital nokyocho visit record (デジタル納経帳). */
export interface VisitRecord {
  templeId: string;
  visitDate: string; // ISO 日付
  photos: string[]; // MVP: ローカル保存(プレースホルダー), 本番: S3 差し替え (Q6/Req 10.4,10.5)
  memo?: string;
  route?: string;
  impression?: string;
}

// ---------------------------------------------------------------------------
// Progress (巡礼進捗)
// ---------------------------------------------------------------------------

/** Pilgrimage progress state for achievement-rate calculation. */
export interface ProgressState {
  area: ShikokuPrefecture; // 選択中の対象県 (Req 9.6)
  visited: Set<string>; // 訪問済 templeId
  templesByArea: Record<ShikokuPrefecture, string[]>;
  shikokuTotal: number; // 88
}

// ---------------------------------------------------------------------------
// Layered map (重ねるマップ)
// ---------------------------------------------------------------------------

/** Kind of information layer displayed on the map. */
export type LayerKind =
  | "ohenro"
  | "cycling"
  | "gourmet"
  | "disaster"
  | "restroom"
  | "rest_area";

/** A single feature placed on a map layer. */
export interface MapFeature {
  id: string;
  layer: LayerKind;
  location: GeoPoint;
  label: string;
}

/** A geofence around a temple. Default radius 100m. */
export interface Geofence {
  templeId: string;
  center: GeoPoint;
  radiusMeters: number; // 既定 100m
}

// ---------------------------------------------------------------------------
// Pilgrimage plan (今日のお遍路プラン)
// ---------------------------------------------------------------------------

/** Conditions used to generate a same-day pilgrimage plan. */
export interface PlanInput {
  startPoint: GeoPoint | string;
  availableMinutes: number;
  transport: "walk" | "car" | "bike";
  desiredTemples: string[];
  fitnessLevel: "low" | "mid" | "high";
  includeSightseeing: boolean;
}

/** A single stop on a generated plan timeline. */
export interface PlanStop {
  time: string;
  label: string;
  kind: "temple" | "spot" | "meal";
}

/** A generated same-day pilgrimage plan. */
export interface PilgrimagePlan {
  stops: PlanStop[];
}

// ---------------------------------------------------------------------------
// Auth & offline sync
// ---------------------------------------------------------------------------

/** An authenticated user session. `expiresAt` null = session-only (not remembered). */
export interface Session {
  userId: string;
  email: string;
  expiresAt: string | null;
}

/** An entry queued for offline sync (Req 13.5, 13.6). */
export interface OfflineEntry {
  kind: "arrival";
  templeId: string;
  at: string;
}

// ---------------------------------------------------------------------------
// Chat (AI 旅行相談 / プラン生成)
// ---------------------------------------------------------------------------

/** A single turn in a chat conversation. */
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

/**
 * A chat session carried between turns. `preferences` accumulates swipe history
 * so it can be reflected in subsequent suggestion generation (Req 3.3).
 */
export interface ChatSession {
  id: string;
  lang: LangCode;
  messages: ChatMessage[];
  preferences?: SwipePreferences;
}

/** Accumulated swipe-derived preferences fed into AI suggestion generation (Req 3.3). */
export interface SwipePreferences {
  liked: string[]; // itemIds swiped right / up
  disliked: string[]; // itemIds swiped left (興味なし)
}

/**
 * An AI reply. When the conversation reaches a destination-discovery moment,
 * `spotCandidates` carries the candidate set handed to Swipe_Discovery (Req 3.2).
 */
export interface ChatReply {
  message: string;
  spotCandidates?: Spot[];
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Keys used with StoragePort persistence. */
export type StorageKey =
  | "favorites"
  | "shiori"
  | "visitRecords"
  | "progress"
  | "language"
  | "mode"
  | "session"
  | "offlineQueue";

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Returned by subscription APIs; call to stop receiving events. */
export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// i18n label dictionary (言語フォールバック)
// ---------------------------------------------------------------------------

/**
 * A language dictionary keyed by label key, then by language code.
 *
 * Shape: `key -> (LangCode -> string)`. Per-language values are optional so a
 * label may exist only in Japanese (or only in a subset of languages). Used by
 * `resolveLabel` which falls back to the Japanese (`ja`) value, then to the key
 * itself, and never throws / never returns null (Req 1.6, 19.1, 19.3).
 */
export type LangDict = Record<string, Partial<Record<LangCode, string>>>;
