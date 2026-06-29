/**
 * AWS_Gateway ports — abstract interfaces for AI chat, map/location, storage,
 * auth and translation. Mock and AWS adapters share these exact contracts
 * (Req 16.1, 16.4). Signatures mirror the design's "AWS_Gateway ポート" section.
 */

import type {
  ChatReply,
  ChatSession,
  GeneratedImage,
  GeoPoint,
  Geofence,
  ImagePrompt,
  LangCode,
  OfflineEntry,
  PilgrimagePlan,
  PlanInput,
  Session,
  ShikokuPrefecture,
  StorageKey,
  Temple,
  Unsubscribe,
} from "../domain/types";

// Re-export the shared data models so adapters and app code can import the
// gateway contract from a single entry point.
export type * from "../domain/types";

/** AI チャット相談・プラン生成 (Req 3, 12). */
export interface ChatPort {
  sendMessage(session: ChatSession, message: string): Promise<ChatReply>;
  generatePilgrimagePlan(input: PlanInput): Promise<PilgrimagePlan>;
}

/** 地図/現在地・ジオフェンス (Req 8, 13). */
export interface MapLocationPort {
  getTemples(area: ShikokuPrefecture): Promise<Temple[]>;
  getCurrentLocation(): Promise<GeoPoint | null>;
  // ジオフェンス進入イベント購読 (Req 13)
  watchGeofences(
    fences: Geofence[],
    onEnter: (templeId: string) => void,
  ): Unsubscribe;
}

/** データ永続化・オフライン同期キュー (Req 6.4, 10.5, 13.5, 13.6). */
export interface StoragePort {
  load<T>(key: StorageKey): Promise<T | null>;
  save<T>(key: StorageKey, value: T): Promise<void>;
  // オフライン同期キュー (Req 13.5, 13.6)
  enqueueOffline(entry: OfflineEntry): Promise<void>;
  flushOffline(): Promise<OfflineEntry[]>;
}

/** メール認証 (Req 15). */
export interface AuthPort {
  login(
    email: string,
    password: string,
    remember: boolean,
  ): Promise<Session | null>;
  logout(): Promise<void>;
  currentSession(): Promise<Session | null>;
}

/** 多言語翻訳 (Req 19). */
export interface TranslatePort {
  translate(text: string, target: LangCode): Promise<string>;
}

/**
 * AI 画像自動生成 (著作権フリー画像)。スポット/札所に使える写真が無いとき、
 * 生成 AI で著作権フリーの画像を作って表示するためのポート。
 *
 * - mock アダプタ: 自前生成の SVG（カテゴリ別テーマ）を data URL で返す。
 *   外部依存なし・完全にロイヤリティフリーなので Vercel の既定構成でも動く。
 * - aws アダプタ: サーバレス API 経由で Amazon Bedrock (Titan Image Generator)
 *   を呼び、生成画像を返す（生成結果は S3 にキャッシュする想定 — Req 16.3）。
 *
 * 生成できない/未設定のときは `null` を返し、UI はプレースホルダーへ退避する
 * (Req 4.7)。
 */
export interface ImagePort {
  generateImage(prompt: ImagePrompt): Promise<GeneratedImage | null>;
}

/**
 * The AWS_Gateway aggregate — bundles the five ports the application depends on
 * (Req 16.1). `createGateway(env)` returns one of these, backed by either the
 * mock adapters (default / no AWS env) or the aws adapters (env present).
 *
 * Both adapter families produce a value of this exact type, so any drift
 * between the mock and aws implementations and the shared port contracts is a
 * compile error (Req 16.4, 16.5) — this is the type-level half of the contract
 * verification.
 */
export interface AwsGateway {
  readonly chat: ChatPort;
  readonly map: MapLocationPort;
  readonly storage: StoragePort;
  readonly auth: AuthPort;
  readonly translate: TranslatePort;
  readonly image: ImagePort;
}

/** The set of port names that make up an {@link AwsGateway}. */
export const GATEWAY_PORT_NAMES = [
  "chat",
  "map",
  "storage",
  "auth",
  "translate",
  "image",
] as const satisfies ReadonlyArray<keyof AwsGateway>;
