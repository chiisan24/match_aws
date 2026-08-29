# Design Document

## Overview

`/api/recommendations` の失敗経路を「HTTP 502 でエラー画面」から「HTTP 200 で必ず5件の旅程」に置き換える。中心となる変更は 4 つ。

1. **契約検証の共有化** — `AIPlanFirst.tsx` 内にある `isTourismRecommendations` を `src/domain/itineraryContract.ts` へ切り出し、サーバー（応答送信前の検証）・クライアント（受信時の検証）・テストが同一実装を使う。
2. **Fallback_Plan_Pool の共有化** — `src/adapters/mock/chat.ts` の非 export な `MOCK_RECOMMENDATIONS` を `src/data/recommendationFallbackPlans.ts` へ移し、`api/_recommendation-fallback.ts`（Bridge_Module）経由でサーバーからも参照する。既存 `api/_fallback-candidates.ts` と同じ underscore ブリッジ規約に従う。
3. **合成パイプライン** — Plan_Generator の結果を捨てずに `Verified → Stale_Cache_Entry → Fallback` の順で 5 件に組み立て、各プランに `origin` を付け、非 `ai` が1件でもあれば `degraded: true` を返す。
4. **失敗と待機の分離** — バックオフ再試行（300ms / 900ms・最大3試行・予算 20,000ms・Fatal 即中断）、Recommendation_Cache の fresh / stale 二段化、Refresh_Rate_Limiter の「判定」と「予約」の分離、クライアント側の Recovery_Retry（GET）と Intentional_Refresh（POST）の分離。

推薦プランのデータ契約（ちょうど5件、stops 2〜4件、`time` 昇順、`kind`、`place.location`）は変更しない。`api/route-candidates.ts` とテーマ生成プロンプトの 5km 制約には触れない。

コード例は既存実装と同じ TypeScript（strict、ESM）。`api/` と `src/domain/` のコメントは既存に合わせて英語、`src/data/` と UI 側は日本語を混在させる既存慣習に合わせる。

---

## Architecture

```
                     ┌────────────────────────────────────────────────┐
                     │ src/domain/itineraryContract.ts （新規・純粋）    │
                     │  ITINERARY_PLAN_COUNT / ITINERARY_KINDS        │
                     │  isItineraryPlan / itineraryPlanViolations      │
                     │  isTourismRecommendations                      │
                     └───┬──────────────────────┬─────────────────┬───┘
                         │                      │                 │
                         │   ┌──────────────────┴──────────────┐  │
                         │   │ src/data/recommendationFallback │  │
                         │   │ Plans.ts （新規・純粋）           │  │
                         │   │ RECOMMENDATION_FALLBACK_PLANS   │  │
                         │   └───┬──────────────────────┬──────┘  │
                         │       │                      │         │
        ┌────────────────┴───────┴──────┐   ┌───────────┴─────────┴──────────┐
        │ api/_recommendation-fallback  │   │ src/adapters/mock/chat.ts       │
        │ .ts （新規・再エクスポートのみ） │   │ src/ui/screens/AIPlanFirst.tsx  │
        └────────────────┬──────────────┘   └─────────────────────────────────┘
                         │
        ┌────────────────┴───────────────────────────────────────────────────┐
        │ api/recommendations.ts                                            │
        │  enrichPlans        → 部分成功を返す（throw しない）                  │
        │  attemptGeneration  → 失敗を bedrock / contract / enrichment に分類 │
        │  generateWithBackoff→ 300ms / 900ms・最大3試行・予算 20s・Fatal 即断  │
        │  composeRecommendations → 採用順 + 重複排除 + 除外 + origin 付与     │
        │  recommendationCache → freshUntil / staleUntil の二段保持           │
        │  refreshWaitSeconds（読取） / reserveRefresh（書込）                 │
        └────────────────┬──────────────────────────────────────────────────┘
                         │ { plans: [{ ..., origin }], degraded }
        ┌────────────────┴──────────────┐
        │ src/adapters/aws/chat.ts       │  RecommendedPlansResult を返す
        │ src/ui/screens/AIPlanFirst.tsx │  Recovery_Retry / Intentional_Refresh
        └────────────────────────────────┘
```

### api → src の参照

`api/_fallback-candidates.ts` で確立済みの規約をそのまま踏襲する。`api/recommendations.ts` は `./_recommendation-fallback.js` だけを見て、`../src/**` の import はブリッジ 1 ファイルに閉じる。共有される `src` 側モジュールは **DOM / React / `import.meta` / 環境変数を参照しない**（Requirement 3.2）。

- `src/domain/itineraryContract.ts` の依存は `./types` の型のみ。
- `src/data/recommendationFallbackPlans.ts` の依存は `../adapters/mock/spots`（純粋データ）、`../domain/geofence`（純粋関数）、`../domain/itineraryContract`、型のみ。

### 新規ファイル（3）と変更ファイル（9）

| 種別 | パス | 目的 |
| --- | --- | --- |
| 新規 | `src/domain/itineraryContract.ts` | Itinerary_Contract の唯一の実装 |
| 新規 | `src/data/recommendationFallbackPlans.ts` | Fallback_Plan_Pool |
| 新規 | `api/_recommendation-fallback.ts` | Bridge_Module（再エクスポートのみ） |
| 変更 | `api/recommendations.ts` | 縮退応答・部分成功・バックオフ・キャッシュ・レートリミット |
| 変更 | `src/domain/types.ts` | `PlanOrigin` / `RecommendedPlansResult` / `RecommendedPlan.origin` |
| 変更 | `src/ports/index.ts` | `generateRecommendedPlans` の戻り値と再エクスポート |
| 変更 | `src/adapters/aws/chat.ts` | 戻り値変更・GET/POST 分岐の明示・429 文言 |
| 変更 | `src/adapters/mock/chat.ts` | `MOCK_RECOMMENDATIONS` の移設先を import |
| 変更 | `src/ui/screens/AIPlanFirst.tsx` | 契約検証の共有化・取得モード3分岐・Degraded_Notice |
| 変更 | `src/i18n/labels.ts` | `planFirst.degradedNotice`（ja / en / iyo） |
| 変更 | `src/ui/styles/screens.css` | `.plan-first__degraded` |
| 変更 | `vite.config.ts` | `test.include` に `api/**/*.test.ts` を追加 |

---

## Components and Interfaces

### 1. `src/domain/itineraryContract.ts`（新規・純粋）

`AIPlanFirst.tsx` の `ITINERARY_TIME_PATTERN` / `ITINERARY_KINDS` / `isTourismRecommendations` をそのまま移設する。**判定条件は一切変えない**（クライアントの既存挙動を壊さないため）。サーバー側のログ用に、同じ条件を理由付きで返す関数を追加する。

```ts
/**
 * The single implementation of Itinerary_Contract.
 *
 * Shared by the Vercel function (`api/recommendations.ts` via
 * `api/_recommendation-fallback.ts`), the Plan_First_Screen and the test suite,
 * so a payload that the server accepts can never be rejected by the client.
 * MUST stay free of DOM, React, `import.meta` and environment variables.
 */
import type { RecommendedPlan } from "./types";

/** Required number of recommendations (Plan_Count). */
export const ITINERARY_PLAN_COUNT = 5;
/** 24-hour `HH:MM`. */
export const ITINERARY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const ITINERARY_KINDS = new Set(["sightseeing", "food", "cafe", "custom"]);

/** A `RecommendedPlan` narrowed to the tourism itinerary contract. */
export type ItineraryPlan = RecommendedPlan & { mode: "tourism" };

/** Contract violations of a single plan. Empty means the plan conforms. */
export function itineraryPlanViolations(value: unknown): string[];

/** Type guard form of {@link itineraryPlanViolations}. */
export function isItineraryPlan(value: unknown): value is ItineraryPlan;

/** Exactly {@link ITINERARY_PLAN_COUNT} conforming tourism itineraries. */
export function isTourismRecommendations(value: unknown): value is ItineraryPlan[];
```

`itineraryPlanViolations` が返す理由文字列（サーバーログとテストの失敗メッセージに使う）:

| 条件 | 理由文字列 |
| --- | --- |
| `mode !== "tourism"` | `mode` |
| `stops` が配列でない / 2〜4件でない | `stopCount` |
| `time` が `HH:MM` でない | `stop[{i}].time` |
| `time` が直前以下 | `stop[{i}].order` |
| `kind` が4種以外 | `stop[{i}].kind` |
| `title` が空 | `stop[{i}].title` |
| `place.location.lat/lng` が有限数でない | `stop[{i}].location` |

`isTourismRecommendations` は「配列かつ長さ 5 かつ全要素 `isItineraryPlan`」。既存クライアント実装と論理的に同一。

### 2. `src/data/recommendationFallbackPlans.ts`（新規・純粋）

`src/adapters/mock/chat.ts` の `mockRecommendation()` と `MOCK_RECOMMENDATIONS` をここへ移設し、export する。`mockRecommendation` は「未知の spot id」「stops が2〜4件でない」「先頭 stop から 5km 超」でモジュール読み込み時に `throw` する既存の作りをそのまま維持する（Requirement 2.3 の構築時保証）。

```ts
/**
 * Fallback_Plan_Pool: 収録済み愛媛旅程プラン。
 *
 * Recommendation_API の縮退応答（`api/_recommendation-fallback.ts` 経由）と
 * MockChatAdapter の両方がこの 1 定義を使う。EHIME_SPOTS の実座標だけを使い、
 * ここで組み立てた時点で Itinerary_Contract を満たすことを構築時に検査する。
 *
 * DOM / React / import.meta / 環境変数は参照しない。
 */
import type { RouteCandidateKind } from "../domain/types";
import { type ItineraryPlan, itineraryPlanViolations } from "../domain/itineraryContract";
import { haversineDistanceMeters } from "../domain/geofence";
import { EHIME_SPOTS } from "../adapters/mock/spots";

function fallbackPlan(
  id: string,
  icon: string,
  title: string,
  summary: string,
  imageUrl: string,
  stopSpecs: Array<{ spotId: string; kind: RouteCandidateKind }>,
): ItineraryPlan {
  /* 既存 mockRecommendation と同一。末尾に契約検査を追加。 */
}

/** 収録済みフォールバック旅程。上から順に採用される。 */
export const RECOMMENDATION_FALLBACK_PLANS: ItineraryPlan[] = [ /* 8 件 */ ];
```

**プール件数を 5 → 8 に増やす。** 現行 `MOCK_RECOMMENDATIONS` はちょうど 5 件だが、合成時に「AI が生成した slug が偶然 `matsuyama` 等と衝突」「Exclusion_List が Fallback プランを指す」だけで 5 件に届かなくなり、Requirement 1.6 の 502 に落ちてしまう。既存 5 件（`matsuyama` / `dogo` / `uwajima` / `imabari` / `mitsuhama`）は無変更のまま、`EHIME_FOOD_CURATED` の実在店で 3 件を追加する。

| id | title | stops（spot id / kind） | imageUrl |
| --- | --- | --- | --- |
| `okaido` | 大街道の食べ歩きと柑橘スイーツ | `curated-food-kadoya-okaido` / food、`curated-food-tenfactory-matsuyama` / cafe | `/images/ehime/garden-zashiki.jpg` |
| `nabeyaki` | 松山の鍋焼きうどんとおやつ | `curated-food-kotori-matsuyama` / food、`curated-food-asahi-matsuyama` / food、`curated-food-takeuchi-matsuyama` / cafe | `/images/ehime/michi-no-eki.jpg` |
| `uwajima-jakoten` | 宇和島のじゃこ天と練り物 | `curated-food-yasuoka-kamaboko-uwajima` / food、`curated-food-hozumitei-uwajima` / food | `/images/ehime/sotodomari-village.jpg` |

いずれも `EHIME_FOOD_CURATED` の同一エリア座標なので 5km 制約を満たし、先頭 stop の `place.id` と正規化タイトルは既存 5 件と重複しない。`kind: "cafe"` は Itinerary_Contract の許容 4 種に含まれる。

`src/adapters/mock/chat.ts` 側は次のように縮む。

```ts
import { ITINERARY_PLAN_COUNT } from "../../domain/itineraryContract";
import { RECOMMENDATION_FALLBACK_PLANS } from "../../data/recommendationFallbackPlans";

async generateRecommendedPlans(
  _input: RecommendedPlansInput,
): Promise<RecommendedPlansResult> {
  return {
    plans: RECOMMENDATION_FALLBACK_PLANS.map((plan) => ({
      ...plan,
      stops: plan.stops.map((stop) => ({ ...stop })),
    })).slice(0, ITINERARY_PLAN_COUNT),
    degraded: false,
  };
}
```

`mockRecommendation` / `MOCK_RECOMMENDATIONS` はファイルから削除する（`EHIME_SPOTS` / `haversineDistanceMeters` の import は他の用途で残る）。モックは AI 生成の代役なので `degraded: false`、返す件数は先頭 5 件に固定する。

### 3. `api/_recommendation-fallback.ts`（新規・Bridge_Module）

```ts
/**
 * Bridge module: the second point where `api/` reaches into `src/`
 * (see `api/_fallback-candidates.ts` for the convention and the rationale).
 *
 * Re-exports only. The itinerary contract lives once in
 * `src/domain/itineraryContract.ts` and the fallback itineraries once in
 * `src/data/recommendationFallbackPlans.ts`, so the Vercel function, the mock
 * adapter, the Plan_First_Screen and the test suite share one definition.
 *
 * The shared modules must stay free of DOM, React, `import.meta` and
 * environment variables.
 */
export {
  ITINERARY_PLAN_COUNT,
  isItineraryPlan,
  isTourismRecommendations,
  itineraryPlanViolations,
} from "../src/domain/itineraryContract.js";

export type { ItineraryPlan } from "../src/domain/itineraryContract.js";

export { RECOMMENDATION_FALLBACK_PLANS } from "../src/data/recommendationFallbackPlans.js";
```

`api/recommendations.ts` 側では

```ts
import {
  ITINERARY_PLAN_COUNT as PLAN_COUNT,
  isItineraryPlan,
  isTourismRecommendations,
  itineraryPlanViolations,
  RECOMMENDATION_FALLBACK_PLANS,
} from "./_recommendation-fallback.js";

/** Fallback_Plan_Pool as seen by this handler. */
const FALLBACK_PLANS: RecommendationPlan[] = RECOMMENDATION_FALLBACK_PLANS;
```

型の互換性: `ItineraryPlan` は `mode: "tourism"`、`stops[].place?: RecommendedPlace`、`area?: GeoArea` を持ち、api ローカルの `RecommendationPlan` / `PlanStop` / `EnrichedPlace` と構造的に一致する。検証は `npx tsc --noEmit -p api/tsconfig.json` で行う。もし将来どちらかの型が広がって不一致になった場合は、キャストではなく api 側の局所変換関数 `toApiPlan(plan: ItineraryPlan): RecommendationPlan` を置く（`origin` はここでは付けない）。`isItineraryPlan` / `isTourismRecommendations` は `unknown` を受ける型ガードなので、api ローカル型の値をそのまま渡せる。

### 4. `api/recommendations.ts`

#### 4.1 型の追加

```ts
/** Provenance of a plan in the response. */
type PlanOrigin = "ai" | "cache" | "fallback";

/** Why a response had to be degraded. Logged with the origin breakdown. */
type DegradedCause = "bedrock" | "contract" | "enrichment";

interface RecommendationPlan {
  /* 既存フィールドは変更しない */
  origin?: PlanOrigin;
}

/** Result of one or more generation attempts. */
interface GenerationOutcome {
  /** Verified plans, in the model's original order. */
  verified: RecommendationPlan[];
  /** Absent when {@link verified} reached Plan_Count. */
  cause?: DegradedCause;
  /** Failure summary for the log line and the 502 body. */
  detail?: string;
  /** `true` for a Fatal_Failure, which must not be retried. */
  fatal?: boolean;
}

/** The response payload after synthesis. */
interface ComposedResult {
  plans: RecommendationPlan[];
  degraded: boolean;
  counts: Record<PlanOrigin, number>;
  detail?: string;
}

/** Generation errors that a retry may fix but that Bedrock did not cause. */
class ContractViolationError extends Error {}
```

`text()` / `normalizeKind()` / `normalizeStop()` / `normalizePlan()` が投げる `Error` を `ContractViolationError` に置き換える（メッセージは変更しない）。これで「Bedrock 呼び出し失敗」と「生成結果の契約違反」を分類できる（Requirement 1.8）。

#### 4.2 `enrichPlans` の部分成功化（Requirement 4.1 / 4.2）

`Promise.all` は残すが、プラン単位のマッパーが `throw` せず結果型を返す形にする（`Promise.allSettled` 相当）。`findPlace` / `findPlaceNear` / `largestNearbyCluster` / `rescueStopsNearAnchor` / `createTaskLimiter` の既存ロジックは無変更。

```ts
type PlanEnrichment =
  | { status: "verified"; plan: RecommendationPlan }
  | { status: "insufficient"; planId: string; reason: string };

async function enrichPlans(
  plans: RecommendationPlan[],
  lang: string,
): Promise<PlanEnrichment[]> {
  /* findPlace / findPlaceNear の構築は現状のまま */

  return Promise.all(
    plans.map(async (plan): Promise<PlanEnrichment> => {
      try {
        /* ... 既存の enrich → verifiedStops → largestNearbyCluster ... */
        if (!cluster) {
          return { status: "insufficient", planId: plan.id, reason: "no verified stop" };
        }
        const clusteredStops = cluster.stops.length < 2
          ? await rescueStopsNearAnchor(enrichedStops, cluster, findPlaceNear)
          : cluster.stops;
        if (clusteredStops.length < 2) {
          return {
            status: "insufficient",
            planId: plan.id,
            reason: "fewer than two verified stops within 5km",
          };
        }
        /* ... stops / area / imageUrl の組み立ては既存のまま ... */
        return { status: "verified", plan: { ...plan, stops, area, ...hero } };
      } catch (error) {
        // One plan's lookup must never discard the other four.
        return { status: "insufficient", planId: plan.id, reason: errorDetail(error) };
      }
    }),
  );
}
```

呼び出し側で不足プランを 1 行ずつログに出す（Requirement 4.2）。

```ts
const enrichments = await enrichPlans(normalized, lang);
for (const result of enrichments) {
  if (result.status === "insufficient") {
    console.warn("recommendations plan not verified", {
      planId: result.planId,
      reason: result.reason,
    });
  }
}
const verified = enrichments
  .filter((r): r is Extract<PlanEnrichment, { status: "verified" }> => r.status === "verified")
  .map((r) => r.plan)
  // Requirement 2.2: never let a non-conforming plan reach the response.
  .filter((plan) => {
    const violations = itineraryPlanViolations(plan);
    if (violations.length === 0) return true;
    console.warn("recommendations plan violates contract", {
      planId: plan.id,
      violations,
    });
    return false;
  });
```

`generateRecommendations` は `RecommendationResult` ではなく `RecommendationPlan[]`（検証済みプランのみ）を返す。あわせて 2 点を変える。

- **正規化をプラン単位で非致命化**: `parsed.plans.map(normalizePlan)` を try/catch 付きのループにし、落ちたプランは理由をログに出して残りを保持する。`parsed.plans` がちょうど 5 件でない場合、および全プランが正規化に失敗した場合のみ `ContractViolationError`（= Retryable、Requirement 5.1）。
- **`duplicateReasons` の致命的 throw を削除**: 生成結果内の重複・Exclusion_List 一致は合成側で非致命に扱う（Requirement 4.5）。`comparisonKey` はそのまま、`duplicateReasons` は後述の `collisionReasons` に置き換える。「Bedrock returned duplicate recommendation ids」の throw も削除する（合成の重複排除が同じ結果を保証する）。

#### 4.3 バックオフ再試行（Requirement 5）

```ts
/** Backoff_Delays inserted before the 2nd and 3rd attempt. */
const BACKOFF_DELAYS_MS = [300, 900] as const;
/** Maximum number of generation attempts. */
const MAX_GENERATION_ATTEMPTS = 3;
/**
 * Retry_Budget. Already declared with this value in the module; keep the single
 * declaration and only widen the comment to cover more than one retry.
 */
const RETRY_BUDGET_MS = 20_000;

/**
 * Retry timing indirection. Production waits for real time; the test suite
 * replaces `sleep` (and optionally `now`) so backoff assertions run instantly.
 * Vercel only reads this module's default export, so an extra named export is
 * safe here.
 */
export const recommendationTiming = {
  now: (): number => Date.now(),
  sleep: (ms: number): Promise<void> =>
    new Promise((resolve) => { setTimeout(resolve, ms); }),
};

async function attemptGeneration(
  lang: string,
  exclusions: RecommendationExclusion[],
  retrying: boolean,
): Promise<GenerationOutcome> {
  try {
    const verified = await generateRecommendations(lang, exclusions, retrying);
    if (verified.length === PLAN_COUNT) return { verified };
    return {
      verified,
      cause: "enrichment",
      detail: `only ${verified.length} of ${PLAN_COUNT} plans were verified`,
    };
  } catch (error) {
    return {
      verified: [],
      cause: error instanceof ContractViolationError ? "contract" : "bedrock",
      detail: errorDetail(error),
      fatal: !isRetryable(error),
    };
  }
}

async function generateWithBackoff(
  lang: string,
  exclusions: RecommendationExclusion[],
): Promise<GenerationOutcome> {
  const startedAt = recommendationTiming.now();
  let outcome: GenerationOutcome = { verified: [] };
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    outcome = await attemptGeneration(lang, exclusions, attempt > 1);
    if (!outcome.cause) return outcome;
    // Place_Enricher shortage is not a Retryable_Failure: the verified plans
    // are kept and Requirement 4.3 tops the response up instead.
    if (outcome.cause === "enrichment") return outcome;
    if (outcome.fatal) {
      console.error("recommendations generation failed fatally", {
        attempt,
        cause: outcome.cause,
        detail: outcome.detail,
      });
      return outcome;
    }
    const elapsedMs = recommendationTiming.now() - startedAt;
    const delayMs = BACKOFF_DELAYS_MS[attempt - 1];
    if (attempt === MAX_GENERATION_ATTEMPTS || delayMs === undefined) {
      console.warn("recommendations retries exhausted", {
        attempt, elapsedMs, cause: outcome.cause, detail: outcome.detail,
      });
      return outcome;
    }
    if (elapsedMs > RETRY_BUDGET_MS) {
      console.warn("recommendations retry budget exhausted", {
        attempt, elapsedMs, cause: outcome.cause, detail: outcome.detail,
      });
      return outcome;
    }
    console.warn("recommendations retrying", {
      attempt, elapsedMs, delayMs, cause: outcome.cause, detail: outcome.detail,
    });
    await recommendationTiming.sleep(delayMs);
  }
  return outcome;
}
```

- 既存の `generateWithRetry`（2試行・待機なし・失敗を throw）は `generateWithBackoff` に**置き換えて削除する**。`RETRY_BUDGET_MS = 20_000` も既存定義なので二重宣言せず、コメントだけ「2回目以降の再試行」に合わせて広げる。`BACKOFF_DELAYS_MS` / `MAX_GENERATION_ATTEMPTS` / `recommendationTiming` が新規追加分。
- `isRetryable` / `FATAL_BEDROCK_STATUSES` / `FATAL_BEDROCK_ERROR_NAMES` は無変更で流用する。`ContractViolationError` は status を持たないので `isRetryable` は `true` を返す（Requirement 5.1）。
- 予算判定は「再試行を開始しようとした時点」＝失敗直後・待機前の経過時間で行う。待機は最大 900ms なので 20,000ms の予算に対する誤差は無視できる。
- `generateWithBackoff` は例外を投げない。想定外の例外も `cause: "bedrock"` として `errorDetail` 付きでログに残し、縮退応答へ回す（Requirement 1.1 の「必ず選べる」を優先）。

#### 4.4 合成パイプライン（Requirement 1.2 / 2.4〜2.7 / 4.3〜4.6）

`duplicateReasons` を「1 プランについて、既採用プランおよび Exclusion_List との衝突理由を返す」形に組み替える。理由文字列の書式（`id:` / `title:` / `place:` / `placeName:` / `placeId:`）は現状のまま流用し、ログの読み方を変えない。

```ts
interface PlanKeys {
  id: string;
  title: string;
  place: string;
  placeName: string;
  placeId: string;
}

function planKeys(plan: RecommendationPlan): PlanKeys {
  const searchQuery = plan.stops[0]?.searchQuery ?? "";
  return {
    id: comparisonKey(plan.id),
    title: comparisonKey(plan.title),
    place: comparisonKey(searchQuery),
    // Google's canonical name and id are the only表記揺れ-proof signals.
    placeName: comparisonKey(plan.stops[0]?.place?.name ?? ""),
    placeId: plan.stops[0]?.place?.id ?? "",
  };
}

/**
 * Splits collisions into the two decisions the caller needs: `duplicate`
 * always rejects (Requirements 2.4-2.6), `excluded` only rejects while enough
 * non-excluded candidates remain (Requirement 2.7).
 */
function collisionReasons(
  keys: PlanKeys,
  seen: SeenKeys,
  excluded: ExcludedKeys,
): { duplicate: string[]; excluded: string[] };
```

重複判定に使うのは `id` / `title` / `placeId` の 3 signal（Requirement 2.4 / 2.5 / 2.6）。Exclusion_List 判定は既存 `duplicateReasons` と同じ 5 signal（`id` / `title` / `place` / `placeName` / `placeId`）。

```ts
const ORIGIN_RANK: Record<PlanOrigin, number> = { ai: 0, cache: 1, fallback: 2 };

function composeRecommendations(input: {
  verified: readonly RecommendationPlan[];
  cached: readonly RecommendationPlan[];
  fallback: readonly RecommendationPlan[];
  exclusions: readonly RecommendationExclusion[];
}): ComposedResult {
  const candidates = [
    ...input.verified.map((plan) => ({ plan, origin: "ai" as const })),
    ...input.cached.map((plan) => ({ plan, origin: "cache" as const })),
    ...input.fallback.map((plan) => ({ plan, origin: "fallback" as const })),
  ].filter(({ plan }) => isItineraryPlan(plan));

  const excluded = excludedKeys(input.exclusions);
  const seen = { ids: new Set<string>(), titles: new Set<string>(), placeIds: new Set<string>() };
  const accepted: Array<{ plan: RecommendationPlan; origin: PlanOrigin; order: number }> = [];

  const sweep = (allowExcluded: boolean): void => {
    for (const candidate of candidates) {
      if (accepted.length >= PLAN_COUNT) return;
      const keys = planKeys(candidate.plan);
      const reasons = collisionReasons(keys, seen, excluded);
      if (reasons.duplicate.length > 0) continue;
      if (!allowExcluded && reasons.excluded.length > 0) continue;
      remember(keys, seen);
      accepted.push({ ...candidate, order: accepted.length });
    }
  };
  // Requirement 2.7: prefer candidates the caller did not exclude, then top up
  // with excluded ones only while the response is still short of Plan_Count.
  sweep(false);
  sweep(true);

  // Requirement 1.2: ai → cache → fallback, stable within each origin.
  accepted.sort((a, b) =>
    ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin] || a.order - b.order);

  const plans = accepted.map(({ plan, origin }) => ({ ...plan, origin }));
  const counts = { ai: 0, cache: 0, fallback: 0 } as Record<PlanOrigin, number>;
  for (const { origin } of accepted) counts[origin] += 1;
  return { plans, degraded: counts.cache + counts.fallback > 0, counts };
}
```

- `sweep(false)` で除外一致として飛ばした候補は `seen` に登録しないので、`sweep(true)` で拾い直せる。
- 採否は「非除外優先」で決め、最終的な並びは origin で再ソートするので、Requirement 1.2（出自順）と Requirement 2.7（件数優先）が同時に成り立つ。
- `origin` は縮退応答だけでなく常に付ける。Requirement 1.3 は縮退時のみ要求するが、常に付けたほうが `degraded` フラグとの整合をテストで固定しやすい。
- `plans.length < PLAN_COUNT` のままなら呼び出し側が 502（Requirement 1.6）。

#### 4.5 Recommendation_Cache の fresh / stale 二段化（Requirement 1.9 / Stale_Retention）

現行の「TTL 切れを走査ループで即 `delete`」をやめ、`freshUntil`（15分）と `staleUntil`（24時間）を持つ。刈り取りは `staleUntil` 経過時のみ。

```ts
const CACHE_TTL_MS = 15 * 60 * 1000;
/** Stale_Retention: how long an expired entry may still back a degraded reply. */
const STALE_RETENTION_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  plans: RecommendationPlan[];
  /** Until this instant the entry may be served as-is (Cache_TTL). */
  freshUntil: number;
  /** After this instant the entry is dropped (Stale_Retention). */
  staleUntil: number;
}
const recommendationCache = new Map<string, CacheEntry>();

function pruneRecommendationCache(now: number): void {
  for (const [key, entry] of recommendationCache) {
    if (entry.staleUntil <= now) recommendationCache.delete(key);
  }
}

function freshPlans(cacheKey: string, now: number): RecommendationPlan[] | null {
  const entry = recommendationCache.get(cacheKey);
  return entry && entry.freshUntil > now ? entry.plans : null;
}

/**
 * Retained cache plans usable as degraded filler, this key's entry first and
 * then other keys newest-first. A Stale_Cache_Entry always qualifies; a still
 * fresh entry of another key (or of this key during a refresh, where the fresh
 * entry is deliberately bypassed) is a strictly better filler than a canned
 * fallback, so it is included too.
 */
function cachedPlanCandidates(cacheKey: string, now: number): RecommendationPlan[] {
  return [...recommendationCache.entries()]
    .filter(([, entry]) => entry.staleUntil > now)
    .sort(([keyA, a], [keyB, b]) =>
      Number(keyB === cacheKey) - Number(keyA === cacheKey) || b.freshUntil - a.freshUntil)
    .flatMap(([, entry]) => entry.plans);
}
```

書き込み条件は 3 つすべてを満たすときのみ（Requirement 1.9 と既存の refresh 非キャッシュ方針）。

```ts
if (!bypassCache && !composed.degraded && composed.plans.length === PLAN_COUNT) {
  const storedAt = Date.now();
  recommendationCache.set(cacheKey, {
    plans: composed.plans,
    freshUntil: storedAt + CACHE_TTL_MS,
    staleUntil: storedAt + STALE_RETENTION_MS,
  });
}
```

キャッシュに入るのは `origin: "ai"` のみの結果なので、後に Stale_Cache_Entry として再利用されるときに `cache` へ付け替えても矛盾しない。

#### 4.6 `recommendationsFor` の再構成

```ts
async function recommendationsFor(
  date: string,
  lang: string,
  schema: string,
  bypassCache: boolean,
  exclusions: RecommendationExclusion[],
): Promise<ComposedResult> {
  const now = Date.now();
  const cacheKey = `${schema}:${date}:${lang}`;
  pruneRecommendationCache(now);

  if (!bypassCache) {
    const fresh = freshPlans(cacheKey, now);
    if (fresh) {
      return {
        plans: fresh,
        degraded: false,
        counts: { ai: fresh.length, cache: 0, fallback: 0 },
      };
    }
  }

  const requestKey = bypassCache
    ? `${cacheKey}:refresh:${JSON.stringify(exclusions)}`
    : cacheKey;
  const pending = recommendationRequests.get(requestKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const outcome = await generateWithBackoff(lang, exclusions);
      const composed = composeRecommendations({
        verified: outcome.verified,
        cached: cachedPlanCandidates(cacheKey, Date.now()),
        fallback: FALLBACK_PLANS,
        exclusions,
      });
      if (composed.degraded || composed.plans.length !== PLAN_COUNT) {
        // Requirement 1.8: one line carrying the cause and the origin mix.
        console.error("recommendations degraded", {
          cause: outcome.cause ?? "composition",
          detail: outcome.detail,
          origins: composed.counts,
          plans: composed.plans.length,
        });
      }
      /* キャッシュ書き込み（4.5 の条件） */
      return { ...composed, detail: outcome.detail };
    } finally {
      recommendationRequests.delete(requestKey);
    }
  })();
  recommendationRequests.set(requestKey, request);
  return request;
}
```

インフライト共有（`recommendationRequests`）は現状のまま。共有される値が `ComposedResult` になるため、同一 `requestKey` の同時要求は同じ `degraded` を見る（リフレッシュ枠の予約判断は要求ごとに行われる）。

#### 4.7 Refresh_Rate_Limiter の判定と予約の分離（Requirement 6）

現行の `refreshRetryAfterSeconds(req)` は「残り秒数を返す」と「枠を予約する」を1関数で行っており、これが失敗直後の 429 の原因そのものである。同関数を削除し、次の2関数に分ける。

```ts
/** Read-only check. Never consumes the caller's refresh slot. */
function refreshWaitSeconds(req: VercelRequest, now: number): number {
  for (const [key, allowedAt] of refreshAllowedAt) {
    if (allowedAt <= now) refreshAllowedAt.delete(key);
  }
  const allowedAt = refreshAllowedAt.get(refreshClientKey(req)) ?? 0;
  return allowedAt > now ? Math.ceil((allowedAt - now) / 1000) : 0;
}

/**
 * Consumes the caller's refresh slot. Called only just before answering an
 * Intentional_Refresh with a Plan_Origin `ai`-only response, so a failed or
 * degraded attempt never blocks the next try (Requirements 6.2-6.4).
 */
function reserveRefresh(req: VercelRequest, now: number): void {
  refreshAllowedAt.set(refreshClientKey(req), now + REFRESH_INTERVAL_MS);
}
```

#### 4.8 `handler` の流れ

```
1. method が GET/POST 以外 → 405（予約しない）
2. schema / count / date / query-body 一致 の検証 → 違反は 400（予約しない）
3. refresh = query.refresh === "1"、bypassCache = POST || refresh
4. exclusions = bypassCache ? parseExclusions(body.exclude) : []
     形式違反は InvalidRequestError → catch で 400（予約しない）
5. bypassCache のとき refreshWaitSeconds(req, now) > 0 なら
     Cache-Control: private, no-store / Retry-After / 429（予約しない）
6. result = await recommendationsFor(date, lang, schema, bypassCache, exclusions)
7. result.plans.length !== PLAN_COUNT または !isTourismRecommendations(result.plans)
     → Cache-Control: private, no-store / 502 { error, detail }（予約しない）
8. Cache-Control:
     result.degraded || bypassCache || !hasDate → "private, no-store"
     それ以外 → "public, s-maxage=900, stale-while-revalidate=86400"
9. bypassCache && !result.degraded なら reserveRefresh(req, Date.now())
10. 200 { plans: result.plans, degraded: result.degraded }
```

- 手順 7 が Requirement 2.2 の「応答送信前の検証」。合成側で候補を `isItineraryPlan` で濾しているので通常は成立し、ここは安全網。破れたときは違反内容をログに出して 502 にする。
- 手順 8 で `result.degraded` を最初の条件に置くことで Requirement 1.7 を満たす。`Cache-Control` の設定は `res.status().json()` より前なので順序上の問題はない。
- 手順 9 が Requirement 6.2〜6.4。予約は 200 応答の直前・`ai` のみのときだけ。405 / 400 / 429 / 502 はすべてこの行に到達しない。
- `catch` は現状のまま（`InvalidRequestError` → 400、その他 → 502）。`recommendationsFor` が投げなくなるので、ここに来るのは要求解析の失敗と想定外の例外のみ。

### 5. `src/domain/types.ts` / `src/ports/index.ts`

```ts
/** Provenance of a recommended plan in a Recommendation_API response. */
export type PlanOrigin = "ai" | "cache" | "fallback";

export interface RecommendedPlan {
  /* 既存フィールドは変更しない */
  /** 省略時は AI 生成。縮退応答では "cache" / "fallback" が入る。 */
  origin?: PlanOrigin;
}

/** A recommendation fetch result plus whether AI generation was degraded. */
export interface RecommendedPlansResult {
  plans: RecommendedPlan[];
  /** `true` when at least one plan did not come from AI generation. */
  degraded: boolean;
}
```

`ChatPort.generateRecommendedPlans` の戻り値を `Promise<RecommendedPlansResult>` に変える。`origin` を optional にすることで既存フィクスチャは無変更でコンパイルできる。`degraded` を `plans.some((p) => p.origin !== "ai")` で導出せず応答フィールドとして持つのは、`origin` を返さない旧デプロイに対して安全側（`degraded: false`）に倒れるようにするため。

`src/ports/index.ts` は `export type * from "../domain/types"` を持つので新しい型は自動的に外へ出るが、既存の `CandidateSource` / `RouteCandidatesResult` と同じ慣習に倣い、本機能の契約も明示的に再エクスポートする。`ChatPort` の型 import 一覧にも `RecommendedPlansResult` を追加する。

```ts
// 縮退応答の契約: Plan_First_Screen と両アダプタがゲートウェイ経由で読む。
export type { PlanOrigin, RecommendedPlansResult } from "../domain/types";
```

メソッド名は増減しないので `src/app/gateway.ts` のプロトタイプ比較には影響しない。

### 6. `src/adapters/aws/chat.ts`

```ts
async generateRecommendedPlans(
  input: RecommendedPlansInput,
): Promise<RecommendedPlansResult> {
  /* base / count / date / query の組み立ては現状のまま */

  // Requirement 7.1 / 7.2: Recovery_Retry は GET（refresh 指定も exclude も
  // 送らない）、Intentional_Refresh のみ POST で refresh と exclude を送る。
  const res = await fetch(
    `${base}/recommendations?${query.toString()}${input.refresh ? "&refresh=1" : ""}`,
    input.refresh
      ? { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang: input.lang, count, schema: RECOMMENDATION_SCHEMA,
            date, exclude: input.exclude ?? [] }),
          cache: "no-store" }
      : { method: "GET" },
  );
  /* !res.ok の分岐は現状のまま（chatErrorMessage に Retry-After を渡す） */

  const data = (await res.json()) as RecommendationsApiResponse;
  if (!isTourismRecommendations(data.plans)) {
    console.error("Recommendations backend returned an unexpected shape", {
      plans: Array.isArray(data.plans) ? data.plans.length : null,
    });
    throw new Error("おすすめプランを5件取得できませんでした。");
  }
  return { plans: data.plans, degraded: data.degraded === true };
}
```

- **シグネチャ変更は必要**。`degraded` を画面まで運ぶ必要があるため（Requirement 8.1）。取得モードの区別自体は既存の `input.refresh` で足りるので、`RecommendedPlansInput` は変更しない。
- `refresh=1` をクエリに明示する。現行はサーバー側で `req.method === "POST"` も `bypassCache` に含めているので機能上は同値だが、要求（`refresh` 指定を送る／送らない）と実装を一致させる。
- 件数チェックを共有 `isTourismRecommendations` に置き換える。これでクライアントは「サーバーが契約検証を通した応答」を同一判定で二重確認する。
- `chatErrorMessage` の 429 / 400 分岐は無変更。Requirement 7.4 / 7.5 は既存実装（`/^\d+$/.test(retryAfter) ? retryAfter : "60"`）が既に満たしている。テストで固定する。

### 7. `src/ui/screens/AIPlanFirst.tsx`

#### 7.1 取得モードの 3 分岐（Requirement 7.1 / 7.2 / 7.3）

`recommendations(chat, lang, force, exclude)` の `force` 引数は「キャッシュを捨てる」と「POST + exclude で再生成する」を同時に意味していた。これを 3 値のモードに分ける。

```ts
/**
 * initial  : 初回表示。sessionStorage → 背景 GET 更新。
 * recovery : Recovery_Retry。失敗した取得を捨てて GET で取り直す（exclude なし）。
 * refresh  : Intentional_Refresh。POST + exclude で別の5件を要求する。
 */
type LoadMode = "initial" | "recovery" | "refresh";

function recommendations(
  chat: ChatPort,
  lang: LangCode,
  mode: LoadMode,
  exclude: RecommendationExclusion[] = [],
): Promise<RecommendedPlansResult> {
  const byLanguage = /* 既存の requestCache 取得 */;
  if (mode === "initial") {
    const stored = readStoredRecommendations(lang);
    if (stored) { /* 既存の背景更新（GET）＋ stored 即返し */ }
  } else {
    // Requirement 7.3: 直前の失敗した取得を破棄してから取り直す。
    byLanguage.delete(lang);
  }

  const cached = byLanguage.get(lang);
  if (cached) return cached;

  const request = chat
    .generateRecommendedPlans({
      lang,
      count: 5,
      date: recommendationDate(),
      ...(mode === "refresh" ? { refresh: true } : {}),
      ...(mode === "refresh" && exclude.length > 0 ? { exclude } : {}),
    })
    .then((result) => {
      if (!isTourismRecommendations(result.plans)) {
        throw new Error("Invalid itinerary recommendations payload.");
      }
      // Requirement 8.4: 縮退応答はセッションに残さない。
      if (!result.degraded) writeStoredRecommendations(lang, result.plans);
      return result;
    });
  byLanguage.set(lang, request);
  void request.catch(() => { /* 既存の巻き戻し */ });
  return request;
}
```

`requestCache` の値型は `Map<LangCode, Promise<RecommendedPlansResult>>` になる。`readStoredRecommendations` は保存済み（＝非縮退）の配列を返すので、`initial` の即返しは `{ plans: stored, degraded: false }` に包む。背景更新は `mode: "initial"` と同じ GET なので現状のまま。

ローカルの `isTourismRecommendations` / `ITINERARY_TIME_PATTERN` / `ITINERARY_KINDS` は削除し、`../../domain/itineraryContract` から import する。

#### 7.2 画面の状態と操作

```ts
const [degraded, setDegraded] = useState(false);

const load = useCallback(async (
  mode: LoadMode = "initial",
  exclude: RecommendationExclusion[] = [],
): Promise<void> => {
  const keepList = mode === "refresh";
  if (keepList) { setRefreshing(true); setRefreshError(""); }
  else { setStatus("loading"); setErrorMessage(""); }
  try {
    const result = await recommendations(chat, lang, mode, exclude);
    if (!isTourismRecommendations(result.plans)) throw new Error(t("planFirst.loadError"));
    setPlans(result.plans);
    setDegraded(result.degraded);
    if (!keepList) setSelected(null);
    setStatus("ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : t("planFirst.loadError");
    // Requirement 7.7: リフレッシュ失敗は一覧を保持したまま理由だけ出す。
    if (keepList) setRefreshError(message);
    else { setErrorMessage(message); setStatus("error"); }
  } finally {
    if (keepList) setRefreshing(false);
  }
}, [chat, lang, t]);
```

| 操作 | 変更前 | 変更後 |
| --- | --- | --- |
| 初回表示（`useEffect`） | `load()` | `load("initial")` |
| エラー画面の「もう一度生成」 | `load(true)` → POST + 枠消費 | `load("recovery")` → GET・exclude なし |
| 一覧上の ↻ | `load(true, exclusionsFrom(plans))` | `load("refresh", exclusionsFrom(plans))` |

↻ ボタンの `disabled={refreshing}` / `aria-busy` と、リフレッシュ中も `status === "ready"` のまま一覧を描画し続ける既存構造は変更しない（Requirement 7.6）。

#### 7.3 Degraded_Notice（Requirement 8.1 / 8.2 / 8.5 / 8.7）

既存の告知バナー `.plan-first__promise`（`role="note"`）と同じマークアップ・命名に合わせる。`role="alert"` は使わない。

```tsx
{status === "ready" && (
  <>
    <div className="plan-first__count">{/* 既存 */}</div>
    {degraded ? (
      <p className="plan-first__degraded" role="note">
        <span aria-hidden="true">🕊</span>
        <span>{t("planFirst.degradedNotice")}</span>
      </p>
    ) : null}
    {refreshError ? (
      <p className="plan-first__refresh-error" role="alert">{refreshError}</p>
    ) : null}
    <ul className="plan-first__list" role="list">{/* 既存。全件クリック可能 */}</ul>
  </>
)}
```

カード側は無変更なので 5 件すべて選択可能なまま（Requirement 8.3）。

### 8. i18n と CSS

`src/i18n/labels.ts` の `planFirst.*` 群（`Object.assign(UI_LABELS, { ... })` ブロック）に 1 キーを追加する。

| キー | ja | en | iyo |
| --- | --- | --- | --- |
| `planFirst.degradedNotice` | いまは新しい提案を作れないため、収録済みの旅程を表示しています。時間をおいて再試行すると最新の提案に切り替わります。 | Fresh suggestions are unavailable right now, so saved itineraries are shown. Try again later to see new ideas. | 今は新しい提案が作れんけん、前からある旅程を出しとるよ。ちょっと時間おいて試したら新しいのが出るけん。 |

基盤サービス名（Bedrock / AWS / Claude / Google）と内部エラー内容（HTTP ステータス、例外名）を含めない（Requirement 8.7）。

`src/ui/styles/screens.css` に `.plan-first__promise` の隣接位置へ追加する。

```css
.plan-first__degraded {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-teal-100);
  border-radius: var(--radius-md);
  background: var(--color-teal-50);
  color: var(--color-teal-800);
  font-size: var(--text-xs);
}
```

注記であることを見た目でも示すため、エラー色（`--color-mikan-*`、`.plan-first__refresh-error` と `.plan-first-status--error` が使用）ではなく `tokens.css` の teal 系（`--color-teal-50` / `--color-teal-100` / `--color-teal-800`）を使う。

---

## Data Models

### 応答（200）

```json
{
  "plans": [
    {
      "id": "uwa-sea-and-castle",
      "mode": "tourism",
      "icon": "🏯",
      "title": "宇和島の城下町と味",
      "summary": "...",
      "reason": "...",
      "duration": "約4時間",
      "transport": "車＋徒歩",
      "intensity": "ふつう",
      "origin": "ai",
      "area": { "center": { "lat": 33.22, "lng": 132.56 }, "radiusMeters": 5000 },
      "stops": [
        { "time": "09:00", "kind": "sightseeing", "title": "...", "description": "...",
          "searchQuery": "宇和島城",
          "place": { "id": "ChIJ...", "name": "宇和島城", "formattedAddress": "愛媛県宇和島市...",
                     "location": { "lat": 33.219, "lng": 132.564 } } },
        { "time": "11:30", "kind": "food", "title": "...", "description": "...",
          "searchQuery": "ほづみ亭", "place": { "id": "ChIJ...", "name": "ほづみ亭",
                     "formattedAddress": "愛媛県宇和島市...", "location": { "lat": 33.223, "lng": 132.560 } } }
      ]
    }
  ],
  "degraded": false
}
```

- `plans` は常にちょうど 5 件。`origin` は全プランに付く。
- `degraded` は常に含まれ、`plans.some((p) => p.origin !== "ai")` と一致する。
- 縮退時のヘッダー: `Cache-Control: private, no-store`。

### 応答（429 / 400 / 502）

既存形式のまま。

```
429  Retry-After: {残り秒数}    { "error": "Please wait before refreshing recommendations" }
400                              { "error": "{違反内容}" }
502                              { "error": "AI recommendations backend error", "detail": "..." }
```

### サーバー内部の状態

| 名前 | 型 | 寿命 |
| --- | --- | --- |
| `recommendationCache` | `Map<string, CacheEntry>` | `staleUntil`（24時間）まで保持。`freshUntil`（15分）以内はそのまま配布 |
| `recommendationRequests` | `Map<string, Promise<ComposedResult>>` | 解決まで（インフライト共有） |
| `refreshAllowedAt` | `Map<string, number>` | 許可時刻まで（`refreshWaitSeconds` が期限切れを刈る） |

---

## Error Handling

| 状況 | 分類 | 扱い |
| --- | --- | --- |
| `invokeClaude` が HTTP 429 / 5xx で失敗 | `bedrock`（Retryable） | Backoff_Delays で最大3試行 → なお失敗なら縮退応答 200 |
| `invokeClaude` が HTTP 400/401/403/404、または Fatal 例外名 | `bedrock`（Fatal） | 再試行せず即縮退応答 200。Bedrock 呼び出しは1回のみ |
| `parsed.plans` が5件でない / 全プランの正規化が失敗 | `contract`（Retryable） | 同上（再試行あり） |
| 一部プランの正規化が失敗 | — | 落ちたプランをログに出し、残りを保持して合成へ |
| Places 検証で一部プランが2件未満 | `enrichment` | 再試行せず、検証済みプランを保持して合成へ（Requirement 4.1 / 5.1 の非 Retryable） |
| Places 検証で全滅 | `enrichment` | `cache` + `fallback` のみで5件（Requirement 4.4） |
| 合成後も5件未満 | — | `Cache-Control: private, no-store` + 502 `{ error, detail }`。枠は消費しない |
| 合成結果が Itinerary_Contract を破る（想定外） | — | 違反内容をログに出して 502。安全網 |
| `exclude` の形式違反 | — | `InvalidRequestError` → 400。枠は消費しない |
| `schema` / `count` / `date` の違反 | — | 400。枠は消費しない |
| Refresh_Interval 内の Intentional_Refresh | — | 429 + `Retry-After`。枠は消費しない（読み取りのみ） |
| クライアントが `degraded` を含まない旧応答を受信 | — | `degraded: false` として扱う（注記を出さない安全側） |
| クライアントの契約検証が失敗 | — | 既存どおり `planFirst.loadError` 相当のエラー表示 + 再試行（Recovery_Retry） |

### ログ

| 事象 | レベル | 内容 |
| --- | --- | --- |
| プラン単位の検証不足 | `warn` | `{ planId, reason }`（Requirement 4.2） |
| プラン単位の契約違反 | `warn` | `{ planId, violations }` |
| 再試行 | `warn` | `{ attempt, elapsedMs, delayMs, cause, detail }`（Requirement 5.6） |
| 再試行打ち切り（回数 / 予算） | `warn` | `{ attempt, elapsedMs, cause, detail }` |
| Fatal_Failure | `error` | `{ attempt, cause, detail }` |
| 縮退応答 | `error` | `{ cause, detail, origins: { ai, cache, fallback }, plans }`（Requirement 1.8） |

`Bedrock HTTP {status}: {message}` は `errorDetail` 経由でサーバーログにのみ出る。利用者向け文言には出さない（既存 `chatErrorMessage` の方針を維持、Requirement 8.7）。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 200 応答は常にちょうど5件で Itinerary_Contract を満たす

*For any* 失敗の組み合わせ（Bedrock の成功／各種失敗、生成結果の契約違反、検証成功プラン数 0〜5、Exclusion_List 0〜10件）について、Recommendation_API が HTTP 200 を返すとき、その本文の `plans` はちょうど Plan_Count 件であり、`isTourismRecommendations` を満たす。

**Validates: Requirements 2.1, 2.2, 9.5**

### Property 2: 採用順は Verified → Stale_Cache_Entry → Fallback

*For any* 各出自の在庫件数の組み合わせについて、200 応答の `plans` を並び順に見た `origin` の列は `ai` → `cache` → `fallback` の順で非減少であり、同一 `origin` 内の相対順序は入力順を保つ。

**Validates: Requirements 1.2, 4.3**

### Property 3: Plan_Origin と Degraded_Flag は常に一致する

*For any* 200 応答について、全プランが `ai` / `cache` / `fallback` のいずれかの `origin` を持ち、`degraded` は「`origin` が `ai` でないプランが1件以上存在すること」と厳密に一致する。したがって生成を行った要求では、検証成功プランが Plan_Count 件のときに限り `degraded` は偽である（fresh な Recommendation_Cache のヒットは生成を行わず、格納時に `ai` のみだったプランをそのまま返すため常に偽）。

**Validates: Requirements 1.3, 1.4, 1.5, 4.6**

### Property 4: 縮退応答は共有もキャッシュもされない

*For any* 縮退応答について、応答ヘッダー `Cache-Control` は `private, no-store` であり、当該応答は Recommendation_Cache に格納されない。したがってその直後に同一鍵で行う素の GET はキャッシュヒットにならず、あらためて生成が試行される（`invokeClaude` の呼び出しが増える）。

同一鍵の2回目が結果として同じプラン集合を返すことはあり得る（Bedrock がなお失敗し、同じ Stale_Cache_Entry と Fallback_Plan_Pool から合成されるため）。プロパティが禁じるのは「縮退応答がキャッシュ経路に載って生成を省略させること」であり、プラン集合の同一性そのものではない。

**Validates: Requirements 1.7, 1.9**

### Property 5: 応答内プランの一意性

*For any* 200 応答について、`plans` の `id` の集合、正規化後のタイトルの集合、先頭 stop の `place.id` の集合はいずれも重複を含まない。

**Validates: Requirements 2.4, 2.5, 2.6**

### Property 6: Exclusion_List は件数を優先して尊重される

*For any* Exclusion_List と候補集合について、除外に一致しない適格候補が n 件あるとき、200 応答に含まれる「除外に一致するプラン」の件数は `max(0, Plan_Count − n)` に等しい。除外にも既採用プランにも一致しない候補が、Plan_Count に達していない状態で捨てられることはない。

**Validates: Requirements 2.7, 4.5**

### Property 7: Fallback_Plan_Pool の全プランが契約を満たす

*For any* `RECOMMENDATION_FALLBACK_PLANS` の要素について、`itineraryPlanViolations` は空であり、stops は2件以上4件以下、各 stop の `time` は 24時間制 `HH:MM` で厳密昇順、`kind` は `sightseeing` / `food` / `cafe` / `custom` のいずれか、`place.location.lat` / `lng` は有限数である。

**Validates: Requirements 2.3, 2.8**

### Property 8: 検証に成功したプランは失われない

*For any* 検証成功プランの部分集合（空集合を含む）について、その全プランが 200 応答に `origin: "ai"` として含まれる。

**Validates: Requirements 4.1, 4.3, 4.4**

### Property 9: 再試行は待機列・回数・予算に従う

*For any* Retryable_Failure の並びについて、Plan_Generator が挿入した待機時間の列は Backoff_Delays（300ms, 900ms）の前置列であり、Bedrock_Client の呼び出し回数は3回以下、かつ再試行開始判定時点の経過時間が Retry_Budget を超えた後に追加の呼び出しは発生しない。

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 10: Fatal_Failure は再試行しない

*For any* Fatal_Failure（HTTP 400 / 401 / 403 / 404、および `AccessDeniedException` / `CredentialsProviderError` / `ResourceNotFoundException` / `UnrecognizedClientException` / `ValidationException`）について、Plan_Generator は Bedrock_Client をちょうど1回だけ呼び出し、待機を挿入しない。

**Validates: Requirements 5.4, 9.6**

### Property 11: 生成が失敗しても応答は 200 になる

*For any* Plan_Generator の失敗（Bedrock 呼び出し失敗、生成結果の契約違反、立寄先検証の不足のいずれか、または組み合わせ）について、Fallback_Plan_Pool の在庫が Plan_Count 以上ある限り Recommendation_API は HTTP 200 を返し、502 を返さない。

**Validates: Requirements 1.1, 5.5, 9.1, 9.2**

### Property 12: HTTP 429 は Intentional_Refresh のみに現れる

*For any* 要求の列について、HTTP メソッドが GET かつ `refresh` 指定を持たない要求が HTTP 429 を返すことはない。

**Validates: Requirements 6.1**

### Property 13: リフレッシュ枠は ai のみの 200 応答のときだけ消費される

*For any* 要求の列について、当該クライアントの次回リフレッシュ許可時刻が更新されるのは、Intentional_Refresh に対して `origin` が `ai` のみの HTTP 200 応答を返した直後だけである。縮退応答、および HTTP 400 / 405 / 429 / 502 の応答では更新されない。

**Validates: Requirements 6.2, 6.3, 6.4, 9.3, 9.4**

### Property 14: 要求パラメータの検証違反は 400 になる

*For any* 形式違反の `exclude`（非配列、11件以上、非オブジェクト要素、空文字または非文字列の `id` / `title` / `place` / `placeId`）および `schema` / `count` / `date` の違反値について、Recommendation_API は HTTP 400 と違反内容を含む `error` を返し、リフレッシュ枠を消費しない。

**Validates: Requirements 6.6, 6.7**

### Property 15: HTTP メソッドと送信内容は refresh 指定で決まる

*For any* `RecommendedPlansInput` について、`refresh` が真のときのみ AWS_Chat_Adapter は POST で `refresh` 指定と `exclude` を送り、`refresh` が偽のときは GET で本文を持たず `refresh` 指定も `exclude` も送らない。

**Validates: Requirements 7.1, 7.2**

### Property 16: 429 の待機案内秒数

*For any* `Retry-After` ヘッダー値について、整数秒として解釈できる場合は案内文にその秒数が含まれ、解釈できない場合（欠落、非数値、小数、負値）は Refresh_Interval の秒数（60）が含まれる。

**Validates: Requirements 7.4, 7.5**

### Property 17: Degraded_Notice の言語網羅と非漏洩

*For any* 本機能で追加した `planFirst.degradedNotice` について、`UI_LABELS` に `ja` / `en` / `iyo` の非空文字列が存在し、いずれの文言も基盤サービス名（Bedrock / AWS / Claude / Google / Places）および内部エラー表現（`HTTP`、`Exception`、ステータス番号）を含まない。

**Validates: Requirements 8.6, 8.7**

### Property 18: 縮退応答はセッションストレージに残らない

*For any* `degraded` が真の応答について、Plan_First_Screen は当該プラン集合をセッションストレージに書き込まない。

**Validates: Requirements 8.4**

---

## Testing Strategy

Vitest + fast-check（既存例: `src/adapters/mock/spot.test.ts`）。プロパティテストは **最低 100 試行**（fast-check 既定 100 なので `fc.assert` 既定で足る）。各プロパティテストの `it` 名または直前コメントに `Feature: recommendations-backend-error-fix, Property {n}: {要約}` を書く。

### `vite.config.ts` の変更

現行の `test.include` は `src/**/*.{test,spec}.{ts,tsx}` のみで、`api/` 配下のテストが実行されない。ハンドラのテストをハンドラの隣に置きたいので include を広げる。

```ts
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  include: ["src/**/*.{test,spec}.{ts,tsx}", "api/**/*.{test,spec}.ts"],
  passWithNoTests: true,
  testTimeout: 20000,
},
```

`api/` のテストファイルは次の 2 点を守る。

- 先頭に `// @vitest-environment node` を置く（DOM は不要。既定の jsdom でも動くが、サーバー経路のテストであることを明示する）。
- `describe` / `it` / `expect` / `vi` / `beforeEach` を `"vitest"` から**明示 import** する。`api/tsconfig.json` の `types` は `["node"]` のみで `vitest/globals` を持たないため、明示 import がないと `npx tsc --noEmit -p api/tsconfig.json` が落ちる。root `tsconfig.json` は `include: ["src", "vite.config.ts"]` なので `npm run build` の型検査には影響しない。

### 追加テストファイル

| ファイル | 対象 | 種別 |
| --- | --- | --- |
| `src/domain/itineraryContract.test.ts` | Property 7 の述語部、契約の境界（stops 1/2/4/5件、時刻同値・降順、未知 `kind`、空 `title`、`NaN`/`Infinity` 座標） | プロパティ + 例示 |
| `src/data/recommendationFallbackPlans.test.ts` | Property 7 | プロパティ（全数） |
| `api/recommendations.compose.test.ts` | Property 2, 3, 5, 6, 8 | プロパティ |
| `api/recommendations.test.ts` | Property 1, 4, 9, 10, 11, 12, 13, 14、および Req 1.6 / 1.8 / 4.2 / 5.6 / 6.5 / 9.1〜9.4 の例示 | プロパティ + 例示 |
| `api/shared-module-boundaries.test.ts` | Req 3.1 / 3.2 / 3.3 | 例示（ソース走査） |
| `src/adapters/aws/recommendations.test.ts` | Property 15, 16 | プロパティ |
| `src/ui/screens/AIPlanFirst.degraded.test.tsx` | Property 17, 18、および Req 7.3 / 7.6 / 7.7 / 8.1 / 8.2 / 8.3 / 8.5 の例示 | プロパティ + 例示（RTL） |

`api/recommendations.compose.test.ts` を分けるのは、合成規則（Property 2/3/5/6/8）が `invokeClaude` を経由しない純粋な入出力として検査できるため。そのために `composeRecommendations` を named export する（`recommendationTiming` と同様、Vercel は default export のみを見る）。

### `invokeClaude` / `searchEhimePlace` のモック

`vi.mock` はホイストされるので、動的 import に対しても有効。

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

const invokeClaude = vi.fn();
const searchEhimePlace = vi.fn();

vi.mock("./_bedrock.js", () => ({
  invokeClaude: (...args: unknown[]) => invokeClaude(...args),
  // extractJson は実装をそのまま使いたいので再実装せず再エクスポートする
  extractJson: <T,>(text: string): T | null => {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end < start) return null;
    try { return JSON.parse(text.slice(start, end + 1)) as T; } catch { return null; }
  },
}));

vi.mock("./_google-places.js", () => ({
  searchEhimePlace: (...args: unknown[]) => searchEhimePlace(...args),
}));
```

- Bedrock 失敗は `invokeClaude.mockRejectedValue(new Error("Bedrock HTTP 500: throttled"))`。Fatal は `Bedrock HTTP 400: ...` および `Object.assign(new Error("x"), { name: "ValidationException" })`。
- 部分検証は `searchEhimePlace.mockImplementation((query) => allowed.has(query) ? Promise.resolve(place(query)) : Promise.resolve(null))`。
- 生成成功のプロンプト応答は「5件の妥当な JSON」を返すヘルパー `bedrockPayload(planCount, stopsPerPlan)` で組み立てる。

### モジュールレベル状態のリセット

`recommendationCache` / `recommendationRequests` / `refreshAllowedAt` はモジュールスコープなので、テスト間で `vi.resetModules()` + 動的 import により**新しいモジュールインスタンス**を取り直す。リセット専用の export は追加しない。

```ts
async function loadHandler() {
  vi.resetModules();
  const mod = await import("./recommendations.js");
  // Backoff を実時間で待たない。挿入された待機時間は delays に記録する。
  const delays: number[] = [];
  mod.recommendationTiming.sleep = async (ms: number) => { delays.push(ms); };
  return { handler: mod.default, timing: mod.recommendationTiming, delays };
}

beforeEach(() => {
  vi.clearAllMocks();
  invokeClaude.mockReset();
  searchEhimePlace.mockReset();
});
```

Retry_Budget の検査（Property 9）は `timing.now` を差し替えて論理時間を進める。

```ts
let clock = 0;
timing.now = () => clock;
timing.sleep = async (ms) => { delays.push(ms); clock += ms; };
invokeClaude.mockImplementation(async () => { clock += stepMs; throw new Error("Bedrock HTTP 503"); });
```

`vitest` のフェイクタイマーは使わない。`await` を挟む生成経路とタイマー進行の同期が煩雑になるため、注入可能な `sleep` / `now` の方が意図を直接検査できる。

### VercelRequest / VercelResponse のスタブ

`handler` を直接呼ぶための最小スタブ。`res` は記録専用。

```ts
type Recorded = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

function makeReq(init: {
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string>;
  body?: unknown;
  ip?: string;
}): VercelRequest {
  return {
    method: init.method ?? "GET",
    query: init.query ?? {},
    body: init.body,
    headers: { "x-forwarded-for": init.ip ?? "203.0.113.1" },
  } as unknown as VercelRequest;
}

function makeRes(): { res: VercelResponse; recorded: Recorded } {
  const recorded: Recorded = { status: 0, headers: {}, body: undefined };
  const res = {
    setHeader(name: string, value: string | number) {
      recorded.headers[name.toLowerCase()] = String(value);
      return res;
    },
    status(code: number) { recorded.status = code; return res; },
    json(payload: unknown) { recorded.body = payload; return res; },
  } as unknown as VercelResponse;
  return { res, recorded };
}
```

日付は `japanDate()` と一致させる必要があるので、テスト側にも同じ算出のヘルパー `todayJst()` を置き、クエリ `{ schema: "itinerary-v1", count: "5", date: todayJst(), lang: "ja" }` を組む。クライアント識別は `x-forwarded-for` で行うため、レートリミットの独立性が必要なテストでは別 IP を渡す。

### ジェネレータ

```ts
/** 失敗モードの組み合わせ。100試行で全経路を踏む。 */
const failureArb = fc.record({
  bedrock: fc.constantFrom(
    "ok", "http429", "http500", "http400", "validationException", "badJson", "fourPlans",
  ),
  /** 検証に成功させる生成プランの添字集合。 */
  verifiedIndexes: fc.subarray([0, 1, 2, 3, 4]),
  /** Exclusion_List に載せる Fallback / 生成プランの件数。 */
  exclusionCount: fc.integer({ min: 0, max: 8 }),
  /** 事前に温めておくキャッシュの状態。 */
  cache: fc.constantFrom("empty", "fresh", "stale", "expired"),
});
```

`cache: "stale"` は「生成成功で 1 回 GET → `timing.now` を 15分以上 24時間未満だけ進める」で作る。`"expired"` は 24時間超。キャッシュの経過時間は `Date.now()` 依存なので、この分岐だけは `vi.setSystemTime` を併用する（`recommendationCache` の期限は `Date.now()` で書き込むため）。

### 例示・エッジケース

- **Req 9.1**: `invokeClaude` が `Bedrock HTTP 500` → 200 / 5件 / `degraded: true` / `origin` が `fallback` のみ / `cache-control: private, no-store`。
- **Req 9.2**: 3プラン分の `searchQuery` のみ解決 → 200 / 5件 / `ai` 3件 + `fallback` 2件 / `ai` プランは生成された順に先頭。
- **Req 9.3**: 縮退 POST → 直後の同一 IP POST が 200（429 でない）。
- **Req 9.4**: 成功 POST（`ai` のみ）→ 直後の同一 IP POST が 429 / `retry-after` が 1〜60。
- **Req 9.6**: `ValidationException` → `invokeClaude` の呼び出し回数が 1、`delays` が空。
- **Req 1.6**: `RECOMMENDATION_FALLBACK_PLANS` を空配列に `vi.mock` した上で Bedrock 全滅 → 502 / `detail` 非空 / その後の POST が 429 でない。
- **Req 1.8 / 4.2 / 5.6**: `console.warn` / `console.error` をスパイし、`planId` + `reason`、`attempt` + `elapsedMs`、`origins` の内訳が出ることを確認。
- **Req 6.5**: 429 応答の `retry-after` と `error` 文言。
- **Req 7.3**: RTL。1回目 reject → エラー画面の再試行ボタン → 2回目 resolve で一覧表示。`generateRecommendedPlans` の 2回目の引数に `refresh` / `exclude` が無いこと。
- **Req 7.6**: RTL。未解決 Promise を返すモックで ↻ を押し、カード5件が残り ↻ が `disabled` かつ `aria-busy="true"`。
- **Req 7.7**: RTL。↻ を reject させ、カード5件が残り `.plan-first__refresh-error` に理由が出る。
- **Req 8.1 / 8.2 / 8.3 / 8.5**: RTL。`degraded: true` で注記あり・`queryAllByRole("alert")` が空・カード5件が enabled、`degraded: false` で注記なし。
- 契約境界: stops 1件 / 5件、`time` が `"09:00"` と `"09:00"`（同値）、`"24:00"`、`kind: "onsen"`、`title: "  "`、`lat: NaN` / `lng: Infinity`。

### ソース走査テスト（Req 3.1 / 3.2 / 3.3）

```ts
// api/shared-module-boundaries.test.ts
// 1. api/*.ts のうち `_` 接頭辞でないファイルに `from "../src/` が無い
// 2. api/_recommendation-fallback.ts が export 文だけで構成される
//    （`function` / `class` / `const` / `let` の宣言を含まない）
// 3. src/domain/itineraryContract.ts と src/data/recommendationFallbackPlans.ts に
//    document / window / navigator / react / import.meta / process.env が現れない
```

`node:fs` の `readFileSync` で読むだけの軽量な検査。共有モジュールの推移的 import（`src/adapters/mock/spots.ts` → `ehime-spots.generated.ts` / `ehime-food.curated.ts`、`src/domain/geofence.ts`）も同じ禁止語チェックの対象に含める。

### 回帰の確認手順

1. `npm test` — 追加テストと既存テスト（`src/adapters/mock/spot.test.ts`、`src/app/modeManager.test.ts`、UI テスト3件）がすべて通ること。
2. `npm run typecheck` — `ChatPort.generateRecommendedPlans` の戻り値変更が全呼び出し元に反映されていること（型エラーが変更漏れの検出器になる）。
3. `npx tsc --noEmit -p api/tsconfig.json` — `api/` は root `tsconfig.json` の対象外なので個別に実行し、Bridge_Module 経由の型互換（`ItineraryPlan` → `RecommendationPlan`）を確認する。
4. `MOCK_RECOMMENDATIONS` の移設で `src/adapters/mock/chat.ts` の他の機能（`mockRouteCandidates` / `mockTourismRoutePlan` / `sendMessage`）に副作用が出ていないこと。`EHIME_SPOTS` と `haversineDistanceMeters` の import は残る。
5. `api/route-candidates.ts` と `api/_fallback-candidates.ts` は無変更であること（本機能の対象外）。

### 未実装スペックとの関係

`.kiro/specs/plan-filter-sort` は `MOCK_RECOMMENDATIONS` への `durationMinutes` / `transportMode` / `intensityLevel` 付与と `generateRecommendedPlans` への `input.filter` 追加を設計している（未実装）。本機能で `MOCK_RECOMMENDATIONS` が `src/data/recommendationFallbackPlans.ts` の `RECOMMENDATION_FALLBACK_PLANS` へ移り、戻り値が `RecommendedPlansResult` になるため、当該スペックを実装する際は移設後の場所と戻り値型に合わせる必要がある。本機能側では対応しない。
