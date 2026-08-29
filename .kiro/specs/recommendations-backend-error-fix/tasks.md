# Implementation Plan: recommendations-backend-error-fix

## Overview

`/api/recommendations` の失敗経路を「HTTP 502 でエラー画面」から「HTTP 200 で必ず5件の旅程」に置き換える。実装は TypeScript（strict / ESM）、テストは vitest + fast-check。

依存順に4段で進める。

1. **共有基盤** — `src/domain/itineraryContract.ts`（契約の唯一の実装）→ `src/data/recommendationFallbackPlans.ts`（Fallback_Plan_Pool）→ `api/_recommendation-fallback.ts`（Bridge_Module）。`vite.config.ts` の `test.include` 拡張はこの段の最初に済ませ、以降 `api/**/*.test.ts` が実行対象に入る状態にする。
2. **クライアント契約型** — `src/domain/types.ts` / `src/ports/index.ts` の型追加 → 両アダプタ → `AIPlanFirst.tsx`。
3. **サーバー実装** — `api/recommendations.ts` を7つの論理タスクに分ける（型と失敗分類 / `enrichPlans` の部分成功化 / バックオフ再試行 / 衝突判定 / 合成 / キャッシュ二段化と `recommendationsFor` / レートリミット分離 / `handler` の流れ）。各タスク完了時点で `npx tsc --noEmit -p api/tsconfig.json` が通る状態を保つ。`api/tsconfig.json` は `noUnusedLocals` を持たないため、後続タスクで使う関数を先に足しても型検査は通る。
4. **検証** — Correctness Properties 18件と Requirement 9 の6項目を自動テストで固定し、3種の検証コマンド（`npm test` / `npm run typecheck` / `npx tsc --noEmit -p api/tsconfig.json`）で締める。

## Tasks

- [x] 1. テスト実行範囲の拡張と Itinerary_Contract の切り出し

  - [x] 1.1 `vite.config.ts` の `test.include` に `api/**/*.{test,spec}.ts` を追加
    - `include: ["src/**/*.{test,spec}.{ts,tsx}", "api/**/*.{test,spec}.ts"]` に変更する
    - 他の `test` 設定（`globals` / `environment` / `setupFiles` / `passWithNoTests` / `testTimeout`）は変更しない
    - 以降の `api/` テストファイルは先頭に `// @vitest-environment node` を置き、`describe` / `it` / `expect` / `vi` / `beforeEach` を `"vitest"` から明示 import する（`api/tsconfig.json` の `types` は `["node"]` のみ）
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 1.2 `src/domain/itineraryContract.ts` を新規作成
    - `AIPlanFirst.tsx` の `ITINERARY_TIME_PATTERN` / `ITINERARY_KINDS` / `isTourismRecommendations` を判定条件を変えずに移設する
    - `ITINERARY_PLAN_COUNT = 5`、`ItineraryPlan` 型、`itineraryPlanViolations`（理由文字列 `mode` / `stopCount` / `stop[{i}].time` / `stop[{i}].order` / `stop[{i}].kind` / `stop[{i}].title` / `stop[{i}].location`）、`isItineraryPlan` を export する
    - 依存は `./types` の型のみ。DOM / React / `import.meta` / 環境変数を参照しない
    - _Requirements: 2.2, 2.3, 3.2_

  - [ ]* 1.3 `src/domain/itineraryContract.test.ts` で契約の境界を検証
    - Property 7 の述語部を例示で固定する: stops 1件 / 2件 / 4件 / 5件、`time` が同値（`"09:00"` と `"09:00"`）・降順・`"24:00"`、`kind: "onsen"`、`title: "  "`、`lat: NaN` / `lng: Infinity`
    - `isTourismRecommendations` が4件・6件を拒否し5件を受けることを確認する
    - _Requirements: 2.2, 2.3_

- [x] 2. Fallback_Plan_Pool の共有化と Bridge_Module

  - [x] 2.1 `src/data/recommendationFallbackPlans.ts` を新規作成
    - `src/adapters/mock/chat.ts` の `mockRecommendation()` を `fallbackPlan()` として移設し、「未知の spot id」「stops が2〜4件でない」「先頭 stop から 5km 超」でモジュール読み込み時に `throw` する既存の作りを維持する
    - 末尾に `itineraryPlanViolations` による構築時検査を追加する
    - 既存5件（`matsuyama` / `dogo` / `uwajima` / `imabari` / `mitsuhama`）を無変更で移し、`EHIME_FOOD_CURATED` の実在店で `okaido` / `nabeyaki` / `uwajima-jakoten` の3件を追加して計8件の `RECOMMENDATION_FALLBACK_PLANS` を export する
    - 依存は `../adapters/mock/spots` / `../domain/geofence` / `../domain/itineraryContract` / 型のみ
    - _Requirements: 2.3, 3.2_

  - [x] 2.2 `src/data/recommendationFallbackPlans.test.ts` で Fallback_Plan_Pool の契約適合を検証
    - **Property 7: Fallback_Plan_Pool の全プランが契約を満たす**
    - **Validates: Requirements 2.3, 2.8**
    - 全8件に対する全数検査（`itineraryPlanViolations` が空、stops 2〜4件、`time` が `HH:MM` の厳密昇順、`kind` が許容4種、`place.location` が有限数）
    - 先頭 stop の `place.id` と正規化タイトルが8件間で重複しないことも確認する

  - [x] 2.3 `api/_recommendation-fallback.ts` を新規作成
    - `ITINERARY_PLAN_COUNT` / `isItineraryPlan` / `isTourismRecommendations` / `itineraryPlanViolations` / `ItineraryPlan` 型 / `RECOMMENDATION_FALLBACK_PLANS` を `../src/**.js` から再エクスポートするだけの内容にする
    - `api/_fallback-candidates.ts` と同じ underscore ブリッジ規約とヘッダーコメント方針に合わせる
    - 宣言（`function` / `class` / `const` / `let`）を置かない
    - _Requirements: 3.1, 3.3_

  - [ ]* 2.4 `api/shared-module-boundaries.test.ts` で参照規約を検証
    - `node:fs` の `readFileSync` による軽量なソース走査
    - `api/*.ts` のうち `_` 接頭辞でないファイルに `from "../src/` が現れないこと
    - `api/_recommendation-fallback.ts` が export 文のみで構成されること
    - 共有モジュールとその推移的 import（`src/domain/itineraryContract.ts`、`src/data/recommendationFallbackPlans.ts`、`src/adapters/mock/spots.ts`、`ehime-spots.generated.ts`、`ehime-food.curated.ts`、`src/domain/geofence.ts`）に `document` / `window` / `navigator` / `react` / `import.meta` / `process.env` が現れないこと
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. クライアント契約型の拡張とモックアダプタの移設

  - [x] 3.1 `src/domain/types.ts` に縮退応答の型を追加
    - `PlanOrigin = "ai" | "cache" | "fallback"` と `RecommendedPlansResult { plans; degraded }` を追加する
    - `RecommendedPlan` に optional な `origin?: PlanOrigin` を追加する（既存フィクスチャを無変更でコンパイルさせるため）
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 `src/ports/index.ts` の `ChatPort` 契約を更新
    - `generateRecommendedPlans` の戻り値を `Promise<RecommendedPlansResult>` に変更する
    - 型 import 一覧に `RecommendedPlansResult` を追加し、`CandidateSource` / `RouteCandidatesResult` と同じ慣習で `PlanOrigin` / `RecommendedPlansResult` を明示的に再エクスポートする
    - メソッド名は増減させない（`src/app/gateway.ts` のプロトタイプ比較に影響させない）
    - _Requirements: 1.4_

  - [x] 3.3 `src/adapters/mock/chat.ts` を移設先 import に切り替え
    - `mockRecommendation` / `MOCK_RECOMMENDATIONS` を削除し、`RECOMMENDATION_FALLBACK_PLANS` を import する
    - `generateRecommendedPlans` が stops を含めた浅いコピーの先頭 `ITINERARY_PLAN_COUNT` 件と `degraded: false` を返すようにする
    - `mockRouteCandidates` / `mockTourismRoutePlan` / `sendMessage` は無変更。`EHIME_SPOTS` と `haversineDistanceMeters` の import は他用途で残す
    - _Requirements: 1.5, 3.2_

- [x] 4. Checkpoint - 共有モジュールと型変更の整合
  - Ensure all tests pass, ask the user if questions arise.
  - `npm test` と `npm run typecheck` を実行し、`ChatPort` の戻り値変更が全呼び出し元に反映されていることを型エラーの有無で確認する（この時点では UI 側が未対応なので、残る型エラーの箇所を次段の作業対象として記録する）

- [x] 5. Recommendation_API の型・失敗分類・立寄先検証の部分成功

  - [x] 5.1 型の追加と失敗分類の土台
    - `PlanOrigin` / `DegradedCause` / `GenerationOutcome` / `ComposedResult` を定義し、`RecommendationPlan` に `origin?: PlanOrigin` を追加する
    - `ContractViolationError extends Error` を追加し、`text()` / `normalizeKind()` / `normalizeStop()` / `normalizePlan()` の `Error` をメッセージ変更なしで置き換える
    - `./_recommendation-fallback.js` から `ITINERARY_PLAN_COUNT as PLAN_COUNT` / `isItineraryPlan` / `isTourismRecommendations` / `itineraryPlanViolations` / `RECOMMENDATION_FALLBACK_PLANS` を import し、`FALLBACK_PLANS: RecommendationPlan[]` を定義する
    - 型不一致が出た場合はキャストではなく局所変換関数 `toApiPlan(plan: ItineraryPlan): RecommendationPlan` を置く
    - _Requirements: 1.3, 1.8, 5.1_

  - [x] 5.2 `enrichPlans` の部分成功化と `generateRecommendations` の戻り値変更
    - `enrichPlans` を `Promise<PlanEnrichment[]>`（`verified` / `insufficient` の判別共用体）にし、プラン単位の `try/catch` で1件の失敗が他4件を捨てないようにする。`findPlace` / `findPlaceNear` / `largestNearbyCluster` / `rescueStopsNearAnchor` / `createTaskLimiter` は無変更
    - 呼び出し側で `insufficient` を `{ planId, reason }` で1行ずつ `console.warn` し、`itineraryPlanViolations` が非空のプランも `{ planId, violations }` を出して除く
    - `generateRecommendations` の戻り値を `RecommendationPlan[]`（検証済みのみ）に変更する。正規化はプラン単位で非致命化し、`parsed.plans` がちょうど5件でない場合と全プラン正規化失敗の場合のみ `ContractViolationError` を投げる
    - `duplicateReasons` の致命的 throw と「Bedrock returned duplicate recommendation ids」の throw を削除する（重複排除は合成側の責務に移す）
    - 同タスク内で既存 `generateWithRetry` を削除して `recommendationsFor` が `generateRecommendations` を直接呼ぶ形にし、モジュールがコンパイル可能な状態を保つ（`generateWithRetry` は `RecommendationResult` を返す宣言なので放置すると型が破れる。バックオフ付きの置き換えは 6.1）
    - _Requirements: 2.2, 4.1, 4.2, 4.5_

- [x] 6. スロットリング時のバックオフ再試行

  - [x] 6.1 `generateWithBackoff` と再試行タイミングの注入点を実装
    - `BACKOFF_DELAYS_MS = [300, 900]` と `MAX_GENERATION_ATTEMPTS = 3` を追加する。`RETRY_BUDGET_MS = 20_000` は既存定義なので二重宣言せず、コメントを「2回目以降の再試行」に合わせて広げるだけにする
    - `generateWithBackoff` を `recommendationsFor` の呼び出し先に据える（5.2 で削除した `generateWithRetry` の役割を引き継ぐ）
    - `recommendationTiming = { now, sleep }` を named export し、テストから差し替えられるようにする（Vercel は default export のみを読む）
    - `attemptGeneration` で検証件数不足を `cause: "enrichment"`、例外を `ContractViolationError` なら `contract`、それ以外は `bedrock` に分類し、`fatal` を `!isRetryable(error)` で決める。`isRetryable` / `FATAL_BEDROCK_STATUSES` / `FATAL_BEDROCK_ERROR_NAMES` は無変更で流用する
    - `generateWithBackoff` は最大3試行、`enrichment` と `fatal` は即返し、再試行開始判定時点の経過時間が予算超過なら打ち切り、待機前に `{ attempt, elapsedMs, delayMs, cause, detail }` をログに出す。例外は投げず、想定外の例外も `cause: "bedrock"` として縮退応答へ回す
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 7. 合成パイプライン

  - [x] 7.1 衝突判定を「重複」と「除外」に分離
    - `PlanKeys` / `planKeys()` を追加し、`comparisonKey` はそのまま流用する
    - `duplicateReasons` を `collisionReasons(keys, seen, excluded): { duplicate: string[]; excluded: string[] }` に組み替える。重複判定は `id` / `title` / `placeId` の3 signal、Exclusion_List 判定は既存の5 signal（`id` / `title` / `place` / `placeName` / `placeId`）
    - 理由文字列の書式（`id:` / `title:` / `place:` / `placeName:` / `placeId:`）は変更しない
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 4.5_

  - [x] 7.2 `composeRecommendations` を実装して named export
    - 候補を `verified`（`ai`）→ `cached`（`cache`）→ `fallback`（`fallback`）の順に並べ、`isItineraryPlan` で濾す
    - `sweep(false)` → `sweep(true)` の2パスで「非除外優先・件数優先」を実現し、除外で飛ばした候補は `seen` に登録しない
    - 採用後に `ORIGIN_RANK` で安定ソートし、`origin` を全プランに付け、`counts` と `degraded = counts.cache + counts.fallback > 0` を返す
    - `PLAN_COUNT` に届かない場合はそのまま返し、502 判定は呼び出し側に委ねる
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 2.5, 2.6, 2.7, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 7.3 `api/recommendations.compose.test.ts` に採用順のプロパティテストを追加
    - **Property 2: 採用順は Verified → Stale_Cache_Entry → Fallback**
    - **Validates: Requirements 1.2, 4.3**
    - 各出自の在庫件数を fast-check で振り、`origin` の列が非減少かつ同一 `origin` 内で入力順が保たれることを確認する
    - `it` 名に `Feature: recommendations-backend-error-fix, Property 2: ...` を含める

  - [ ]* 7.4 Degraded_Flag の一致をプロパティテストで検証
    - **Property 3: Plan_Origin と Degraded_Flag は常に一致する**
    - **Validates: Requirements 1.3, 1.4, 1.5, 4.6**
    - 全プランが3種の `origin` のいずれかを持ち、`degraded` が「`ai` 以外が1件以上」と厳密一致することを確認する

  - [ ]* 7.5 応答内プランの一意性をプロパティテストで検証
    - **Property 5: 応答内プランの一意性**
    - **Validates: Requirements 2.4, 2.5, 2.6**
    - `id` / 正規化タイトル / 先頭 stop の `place.id` の各集合に重複がないことを確認する

  - [ ]* 7.6 Exclusion_List の件数優先をプロパティテストで検証
    - **Property 6: Exclusion_List は件数を優先して尊重される**
    - **Validates: Requirements 2.7, 4.5**
    - 非除外の適格候補が n 件のとき、除外一致プランの採用数が `max(0, PLAN_COUNT - n)` に等しいことを確認する

  - [ ]* 7.7 検証済みプランの保持をプロパティテストで検証
    - **Property 8: 検証に成功したプランは失われない**
    - **Validates: Requirements 4.1, 4.3, 4.4**
    - 検証成功プランの任意の部分集合（空集合を含む）が `origin: "ai"` として全件応答に含まれることを確認する

- [ ] 8. キャッシュ二段化・レートリミット分離・handler の流れ

  - [x] 8.1 Recommendation_Cache の fresh / stale 二段化と `recommendationsFor` の再構成
    - `CacheEntry { plans; freshUntil; staleUntil }`、`STALE_RETENTION_MS = 24h`、`pruneRecommendationCache` / `freshPlans` / `cachedPlanCandidates` を実装し、TTL 切れの即 `delete` をやめる
    - `recommendationsFor` を `Promise<ComposedResult>` にし、`generateWithBackoff` → `composeRecommendations`（`cached: cachedPlanCandidates(...)` / `fallback: FALLBACK_PLANS`）の順に呼ぶ
    - 縮退または5件未満のとき `{ cause, detail, origins: counts, plans }` を `console.error` に1行出す
    - キャッシュ書き込みは `!bypassCache && !composed.degraded && composed.plans.length === PLAN_COUNT` の3条件すべてを満たすときのみ
    - インフライト共有 `recommendationRequests` の値型を `Promise<ComposedResult>` に変える（キーの組み立ては現状のまま）
    - _Requirements: 1.1, 1.8, 1.9, 4.3, 4.4, 5.5_

  - [x] 8.2 Refresh_Rate_Limiter の判定と予約を分離
    - 既存の `refreshRetryAfterSeconds(req)`（残り秒数の算出と枠の予約を1関数で行っており、失敗直後の 429 の原因）を削除し、`refreshWaitSeconds(req, now)`（読み取り専用。期限切れの刈り取りのみ行い枠を消費しない）と `reserveRefresh(req, now)`（書き込み専用）に分ける
    - `REFRESH_INTERVAL_MS` と `refreshClientKey` は無変更で流用する
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 8.3 `handler` の流れを再構成
    - 405（method）→ 400（`schema` / `count` / `date` / query-body 一致）→ `bypassCache = POST || refresh` の決定 → `exclusions` の解析（違反は `InvalidRequestError` → 400）→ `bypassCache` 時のみ `refreshWaitSeconds > 0` で 429（`Cache-Control: private, no-store` と `Retry-After` 付き）
    - 応答直前に `plans.length !== PLAN_COUNT || !isTourismRecommendations(plans)` の安全網を置き、違反内容をログに出して 502 `{ error, detail }` を返す
    - `Cache-Control` は `result.degraded || bypassCache || !hasDate` のとき `private, no-store`、それ以外は `public, s-maxage=900, stale-while-revalidate=86400`
    - `reserveRefresh` は 200 応答の直前・`bypassCache && !result.degraded` のときだけ呼ぶ（405 / 400 / 429 / 502 は到達しない）
    - 本文は `{ plans: result.plans, degraded: result.degraded }`。`catch` の分岐（`InvalidRequestError` → 400、その他 → 502）は現状のまま
    - _Requirements: 1.6, 1.7, 2.1, 2.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 9. Checkpoint - サーバー実装の型と既存テスト
  - Ensure all tests pass, ask the user if questions arise.
  - `npx tsc --noEmit -p api/tsconfig.json` で Bridge_Module 経由の型互換（`ItineraryPlan` → `RecommendationPlan`）を確認し、`npm test` で既存テストの回帰がないことを確認する

- [ ] 10. サーバー経路の自動検証（`api/recommendations.test.ts`）

  - [ ] 10.1 テストハーネスを作成
    - `// @vitest-environment node` と `"vitest"` からの明示 import
    - `vi.mock("./_bedrock.js")`（`invokeClaude` はスパイ、`extractJson` は同等実装）と `vi.mock("./_google-places.js")`（`searchEhimePlace`）
    - `loadHandler()`: `vi.resetModules()` + 動的 import でモジュールスコープ状態（`recommendationCache` / `recommendationRequests` / `refreshAllowedAt`）を取り直し、`recommendationTiming.sleep` を差し替えて挿入待機時間を `delays` に記録する。リセット専用の export は追加しない
    - `makeReq` / `makeRes`（`Recorded { status, headers, body }`）、`todayJst()`、`bedrockPayload(planCount, stopsPerPlan)`、`failureArb`（`bedrock` / `verifiedIndexes` / `exclusionCount` / `cache`）
    - `cache: "stale"` / `"expired"` の作り分けでは期限が `Date.now()` 依存なので `vi.setSystemTime` を併用する。フェイクタイマーは使わない
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 10.2 生成失敗時も 200 を返すことをプロパティテストで検証
    - **Property 11: 生成が失敗しても応答は 200 になる**
    - **Validates: Requirements 1.1, 5.5, 9.1, 9.2**
    - Req 9.1 の例示: `Bedrock HTTP 500` → 200 / 5件 / `degraded: true` / `origin` が `fallback` のみ / `cache-control: private, no-store`
    - Req 9.2 の例示: 3プラン分の `searchQuery` のみ解決 → 200 / 5件 / `ai` 3件 + `fallback` 2件 / `ai` プランが生成順で先頭

  - [ ] 10.3 200 応答の契約適合をプロパティテストで検証
    - **Property 1: 200 応答は常にちょうど5件で Itinerary_Contract を満たす**
    - **Validates: Requirements 2.1, 2.2, 9.5**
    - `failureArb`（Bedrock の成功／各種失敗、検証成功プラン数 0〜5、Exclusion_List 0〜10件）を fast-check で振り、200 のとき `plans` がちょうど5件かつ `isTourismRecommendations` を満たすことを確認する（最低100試行）

  - [ ] 10.4 Fatal_Failure が再試行されないことをプロパティテストで検証
    - **Property 10: Fatal_Failure は再試行しない**
    - **Validates: Requirements 5.4, 9.6**
    - HTTP 400 / 401 / 403 / 404 と `AccessDeniedException` / `CredentialsProviderError` / `ResourceNotFoundException` / `UnrecognizedClientException` / `ValidationException` について `invokeClaude` の呼び出し回数が1、`delays` が空であることを確認する

  - [ ] 10.5 リフレッシュ枠の消費条件をプロパティテストで検証
    - **Property 13: リフレッシュ枠は ai のみの 200 応答のときだけ消費される**
    - **Validates: Requirements 6.2, 6.3, 6.4, 9.3, 9.4**
    - Req 9.3 の例示: 縮退 POST → 直後の同一 IP POST が 200（429 でない）
    - Req 9.4 の例示: `ai` のみの成功 POST → 直後の同一 IP POST が 429 / `retry-after` が 1〜60
    - 400 / 405 / 429 / 502 の応答後も許可時刻が更新されないことを確認する（IP はテストごとに分ける）

  - [ ]* 10.6 縮退応答が共有もキャッシュもされないことをプロパティテストで検証
    - **Property 4: 縮退応答は共有もキャッシュもされない**
    - **Validates: Requirements 1.7, 1.9**
    - `cache-control` が `private, no-store` であること、および直後の同一鍵の素の GET がキャッシュヒットにならず `invokeClaude` の呼び出しが増えることを確認する（プラン集合の同一性は判定に使わない。Bedrock がなお失敗すれば同じ Stale_Cache_Entry と Fallback から同じ5件が合成され得る）

  - [ ]* 10.7 再試行の待機列・回数・予算をプロパティテストで検証
    - **Property 9: 再試行は待機列・回数・予算に従う**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - `timing.now` を論理時間に差し替え、`delays` が `[300, 900]` の前置列であること、`invokeClaude` の呼び出しが3回以下であること、予算超過後に追加呼び出しがないことを確認する

  - [ ]* 10.8 HTTP 429 の出現条件をプロパティテストで検証
    - **Property 12: HTTP 429 は Intentional_Refresh のみに現れる**
    - **Validates: Requirements 6.1**

  - [ ]* 10.9 要求パラメータ検証をプロパティテストで検証
    - **Property 14: 要求パラメータの検証違反は 400 になる**
    - **Validates: Requirements 6.6, 6.7**
    - 形式違反の `exclude`（非配列、11件以上、非オブジェクト要素、空文字または非文字列の `id` / `title` / `place` / `placeId`）と `schema` / `count` / `date` の違反値で 400 と `error`、枠非消費を確認する

  - [ ]* 10.10 502 経路と 429 応答の例示を追加
    - `RECOMMENDATION_FALLBACK_PLANS` を空配列に `vi.mock` した上で Bedrock 全滅 → 502 / `detail` 非空 / その後の POST が 429 でない
    - 429 応答の `retry-after` と `error` 文言（`Please wait before refreshing recommendations`）
    - _Requirements: 1.6, 6.5_

  - [ ]* 10.11 サーバーログ出力の例示を追加
    - `console.warn` / `console.error` をスパイし、`{ planId, reason }`、`{ attempt, elapsedMs, cause, detail }`、`{ cause, detail, origins, plans }` が出ることを確認する
    - _Requirements: 1.8, 4.2, 5.6_

- [x] 11. AWS_Chat_Adapter の GET / POST 分離

  - [x] 11.1 `src/adapters/aws/chat.ts` の `generateRecommendedPlans` を更新
    - 戻り値を `Promise<RecommendedPlansResult>` にし、`{ plans: data.plans, degraded: data.degraded === true }` を返す（`degraded` を返さない旧デプロイでは `false` に倒れる）
    - `input.refresh` が真のときのみクエリに `&refresh=1` を付け、POST + `Content-Type` + 本文（`lang` / `count` / `schema` / `date` / `exclude`）+ `cache: "no-store"` で呼ぶ。偽のときは `{ method: "GET" }` のみで本文も `refresh` も `exclude` も送らない
    - 件数チェックを共有 `isTourismRecommendations` に置き換える。`RecommendedPlansInput` と `chatErrorMessage` の 429 / 400 分岐は無変更
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [ ]* 11.2 `src/adapters/aws/recommendations.test.ts` に取得モードのプロパティテストを追加
    - **Property 15: HTTP メソッドと送信内容は refresh 指定で決まる**
    - **Validates: Requirements 7.1, 7.2**
    - `fetch` をスパイし、`refresh` の真偽でメソッド・クエリ・本文の有無が決まることを確認する

  - [ ]* 11.3 429 の待機案内秒数をプロパティテストで検証
    - **Property 16: 429 の待機案内秒数**
    - **Validates: Requirements 7.4, 7.5**
    - `Retry-After` が整数秒ならその秒数、欠落・非数値・小数・負値なら 60 が案内文に入ることを確認する

- [x] 12. Plan_First_Screen の取得モードと Degraded_Notice

  - [x] 12.1 `src/i18n/labels.ts` に `planFirst.degradedNotice` を追加
    - 既存の `Object.assign(UI_LABELS, { ... })` の `planFirst.*` 群に ja / en / iyo の3言語を追加する
    - 基盤サービス名（Bedrock / AWS / Claude / Google / Places）と内部エラー表現（`HTTP` / `Exception` / ステータス番号）を含めない
    - _Requirements: 8.6, 8.7_

  - [x] 12.2 `src/ui/styles/screens.css` に `.plan-first__degraded` を追加
    - `.plan-first__promise` の隣接位置に置き、`tokens.css` の teal 系（`--color-teal-50` / `--color-teal-100` / `--color-teal-800`）を使う
    - エラー色（`--color-mikan-*`）は使わない
    - _Requirements: 8.2_

  - [x] 12.3 `AIPlanFirst.tsx` の契約検証共有化と取得モード3分岐
    - ローカルの `isTourismRecommendations` / `ITINERARY_TIME_PATTERN` / `ITINERARY_KINDS` を削除し `../../domain/itineraryContract` から import する
    - `LoadMode = "initial" | "recovery" | "refresh"` を導入し、`recommendations()` の `force: boolean` を置き換える。`requestCache` の値型を `Map<LangCode, Promise<RecommendedPlansResult>>` にする
    - `initial` は sessionStorage 即返し（`{ plans: stored, degraded: false }` に包む）+ 背景 GET 更新、`recovery` / `refresh` は `byLanguage.delete(lang)` で失敗した取得を破棄する
    - `refresh` のときだけ `refresh: true` と `exclude` を渡す。`result.degraded` が偽のときのみ sessionStorage に書く
    - `load(mode, exclude)` を実装し、`useEffect` は `load("initial")`、エラー画面の再試行は `load("recovery")`、一覧上の ↻ は `load("refresh", exclusionsFrom(plans))` にする。↻ の `disabled={refreshing}` / `aria-busy` と、リフレッシュ中も `status === "ready"` を保つ既存構造は変更しない
    - _Requirements: 7.3, 7.6, 7.7, 8.4_

  - [x] 12.4 `AIPlanFirst.tsx` に Degraded_Notice を追加
    - `const [degraded, setDegraded] = useState(false)` を追加し、`load` の成功時に `setDegraded(result.degraded)` する
    - `status === "ready"` のブロック内、`.plan-first__count` の直後に `.plan-first__degraded`（`role="note"`）を条件描画する。`role="alert"` は使わない
    - `.plan-first__refresh-error`（`role="alert"`）と一覧の描画は既存のまま、カードは5件すべて選択可能に保つ
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [ ]* 12.5 `src/ui/screens/AIPlanFirst.degraded.test.tsx` に文言のプロパティテストを追加
    - **Property 17: Degraded_Notice の言語網羅と非漏洩**
    - **Validates: Requirements 8.6, 8.7**
    - `UI_LABELS` の `ja` / `en` / `iyo` に非空文字列が存在し、禁止語（Bedrock / AWS / Claude / Google / Places / `HTTP` / `Exception` / ステータス番号）を含まないことを確認する

  - [ ]* 12.6 縮退応答の非永続化をプロパティテストで検証
    - **Property 18: 縮退応答はセッションストレージに残らない**
    - **Validates: Requirements 8.4**
    - `degraded: true` の応答で `sessionStorage.setItem` が呼ばれないことを確認する

  - [ ]* 12.7 画面挙動の RTL 例示を追加
    - Req 7.3: 1回目 reject → 再試行ボタン → 2回目 resolve で一覧表示。2回目の `generateRecommendedPlans` 引数に `refresh` / `exclude` が無いこと
    - Req 7.6: 未解決 Promise を返すモックで ↻ を押し、カード5件が残り ↻ が `disabled` かつ `aria-busy="true"`
    - Req 7.7: ↻ を reject させ、カード5件が残り `.plan-first__refresh-error` に理由が出る
    - Req 8.1 / 8.2 / 8.3 / 8.5: `degraded: true` で注記あり・`queryAllByRole("alert")` が空・カード5件が enabled、`degraded: false` で注記なし
    - _Requirements: 7.3, 7.6, 7.7, 8.1, 8.2, 8.3, 8.5_

- [ ] 13. 最終検証

  - [ ] 13.1 3種の検証コマンドを実行して型と回帰を確定させる
    - `npm test`（vitest）: 追加テストと既存テスト（`src/adapters/mock/spot.test.ts`、`src/app/modeManager.test.ts`、UI テスト3件）がすべて通ること
    - `npm run typecheck`（root tsconfig / `src` のみ）: `ChatPort.generateRecommendedPlans` の戻り値変更が全呼び出し元に反映されていること
    - `npx tsc --noEmit -p api/tsconfig.json`（`api` は root tsconfig の対象外なので個別実行）: Bridge_Module 経由の型互換を確認すること
    - 検出した不整合はここで修正する
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 13.2 移設の副作用と対象外ファイルの無変更を確認
    - `src/adapters/mock/chat.ts` の `mockRouteCandidates` / `mockTourismRoutePlan` / `sendMessage` に副作用が出ていないこと。`EHIME_SPOTS` と `haversineDistanceMeters` の import が残っていること
    - `api/route-candidates.ts` と `api/_fallback-candidates.ts` が無変更であること（`git diff --stat` で確認）
    - _Requirements: 3.1, 3.3_

- [ ] 14. Final checkpoint - すべての検証が通ることを確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` の付いたサブタスクは任意。MVP を急ぐ場合は省略できる。ただし Requirement 9 の6項目（9.1〜9.6）を固定する 10.2 / 10.3 / 10.4 / 10.5 と、Requirement 2.8 を固定する 2.2 は必須にしてある
- Correctness Properties 18件の割り当て: P1 → 10.3、P2 → 7.3、P3 → 7.4、P4 → 10.6、P5 → 7.5、P6 → 7.6、P7 → 2.2（述語部の境界は 1.3）、P8 → 7.7、P9 → 10.7、P10 → 10.4、P11 → 10.2、P12 → 10.8、P13 → 10.5、P14 → 10.9、P15 → 11.2、P16 → 11.3、P17 → 12.5、P18 → 12.6
- 新規3ファイルは 1.2 / 2.1 / 2.3、変更9ファイルは 1.1（vite.config.ts）/ 3.1（types.ts）/ 3.2（ports）/ 3.3（mock chat）/ 5.1〜8.3（api/recommendations.ts）/ 11.1（aws chat）/ 12.1（labels）/ 12.2（css）/ 12.3・12.4（AIPlanFirst.tsx）でカバーする
- 追加テスト7ファイルは 1.3 / 2.2 / 2.4 / 7.3〜7.7 / 10.1〜10.11 / 11.2・11.3 / 12.5〜12.7 でカバーする
- `api/recommendations.ts` は7タスクに分けてあり、各タスク完了時点で `npx tsc --noEmit -p api/tsconfig.json` が通る。`api/tsconfig.json` は `noUnusedLocals` を持たないため、後続で使う関数を先に追加してもよい
- 検証コマンドは3種類ある。`npm test`（vitest）、`npm run typecheck`（root tsconfig、`src` と `vite.config.ts` のみ）、`npx tsc --noEmit -p api/tsconfig.json`（`api` 配下は root の対象外なので個別実行が必要）
- チェックポイント（4 / 9 / 14）は実装成果物を持たないので依存グラフの wave には載せていない（`.kiro/specs/swipe-candidate-fallback-expansion` と同じ扱い）。順序は「4 は wave 2 の直後、9 は wave 10 の直後、14 は wave 23 の直後」
- `.kiro/specs/plan-filter-sort` への影響（`MOCK_RECOMMENDATIONS` の移設先と戻り値型の変更）は本機能の対象外。design.md 末尾の記載を参照

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "3.1"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.3"] },
    { "id": 3, "tasks": ["5.1", "11.1", "12.1", "12.2"] },
    { "id": 4, "tasks": ["5.2", "11.2", "12.3"] },
    { "id": 5, "tasks": ["6.1", "11.3", "12.4"] },
    { "id": 6, "tasks": ["7.1", "2.4", "12.5"] },
    { "id": 7, "tasks": ["7.2", "12.6"] },
    { "id": 8, "tasks": ["8.1", "7.3"] },
    { "id": 9, "tasks": ["8.2", "7.4"] },
    { "id": 10, "tasks": ["8.3", "7.5"] },
    { "id": 11, "tasks": ["10.1", "7.6", "12.7"] },
    { "id": 12, "tasks": ["10.2", "7.7"] },
    { "id": 13, "tasks": ["10.3"] },
    { "id": 14, "tasks": ["10.4"] },
    { "id": 15, "tasks": ["10.5"] },
    { "id": 16, "tasks": ["10.6"] },
    { "id": 17, "tasks": ["10.7"] },
    { "id": 18, "tasks": ["10.8"] },
    { "id": 19, "tasks": ["10.9"] },
    { "id": 20, "tasks": ["10.10"] },
    { "id": 21, "tasks": ["10.11"] },
    { "id": 22, "tasks": ["13.1"] },
    { "id": 23, "tasks": ["13.2"] }
  ]
}
```
