# Implementation Plan: swipe-candidate-fallback-expansion

## Overview

候補確定ロジックを純粋な共有ドメインモジュール `src/domain/candidateFallback.ts` に切り出し、サーバー（`api/route-candidates.ts`）・モックアダプタ（`src/adapters/mock/chat.ts`）・クライアント最終ガード（`TourismRouteBuilder.tsx`）の 3 箇所が同一の補完・半径拡大規則を使う構成に変更する。

実装順は依存関係に従う: 共有ドメイン型 → ドメインロジック → データプール → api 橋渡し・API 変更 → ポート型・アダプタ → UI → i18n/CSS → テスト・回帰確認。

言語は既存実装と同じ TypeScript（strict、ESM）。テストは Vitest + fast-check。

## Tasks

- [ ] 1. 共有ドメインの型とロジックを追加する
  - [ ] 1.1 `src/domain/types.ts` に候補判別属性と結果型を追加する
    - `CandidateSource`（`"primary" | "temple" | "spot"`）を追加
    - `RouteCandidate` に **optional** な `source?: CandidateSource` を追加（既存フィクスチャを壊さないため必須にしない）
    - `RouteCandidatesResult`（`candidates` / `appliedRadiusMeters` / `minimumCount`）を追加
    - _Requirements: 2.6, 3.6_
    - _Properties: 8_

  - [ ] 1.2 `src/domain/candidateFallback.ts` に定数と型を定義する
    - `CANDIDATE_MINIMUM_COUNT = 5`、`CANDIDATE_MAXIMUM_COUNT = 8`、`CANDIDATE_BASE_RADIUS_METERS = 5_000`、`CANDIDATE_RADII_METERS = [5_000, 10_000, 20_000]`
    - `FallbackPoint` / `FallbackPools` / `FinalizeContext` / `FinalizeResult` を定義
    - 依存は `./types` の型と `./geofence` の `haversineDistanceMeters` のみに限定（DOM / React / import.meta / 環境変数に依存しない）
    - _Requirements: 1.1, 1.3, 3.1_
    - _Properties: 1, 9_

  - [ ] 1.3 `clampCandidateCount` を実装する
    - 非数値・NaN・負数は `fallback` へ、範囲内整数は恒等、結果は下限以上 `CANDIDATE_MAXIMUM_COUNT` 以下
    - _Requirements: 1.6_
    - _Properties: 4_

  - [ ] 1.4 `centerDistanceLabel` を実装する
    - 1,000m 未満は `routeBuilder.distanceMeters` と整数メートル値、1,000m 以上は `routeBuilder.distanceKilometers` と小数第 1 位のキロメートル値を返す
    - 表示は呼び出し側の `t()` に委ねる（キーと差し込み値のみ返す）
    - _Requirements: 5.3_
    - _Properties: 12_

  - [ ] 1.5 `finalizeCandidates` の Primary 採用と重複排除を実装する
    - `usedPlaceIds` を初期 `seen` 集合とし、`place.id` の重複を排除して Primary を順序保持で採用
    - `maximumCount` で打ち切り、Primary は Fallback より前に並べる
    - `kind !== "sightseeing"` の場合は Fallback を追加せず `appliedRadiusMeters = baseRadiusMeters` で即返す
    - _Requirements: 1.3, 1.4, 1.5, 8.3, 8.4_
    - _Properties: 2, 3, 14_

  - [ ] 1.6 `finalizeCandidates` の Fallback 補完と半径段階拡大を実装する
    - `CANDIDATE_RADII_METERS` のうち `baseRadiusMeters` 以上のものを昇順に適用
    - プールは `temples` + `spots` から、`seen` 未登録・`sightseeing` かつ `category === "food"` を除外・中心距離が半径以内のものに限定
    - 中心距離昇順（同距離は `id` 昇順）で決定的にソートし、`result.length < min(maximumCount, minimum)` の間だけ採用
    - `minimum` に達したら拡大を停止し、20,000m でも不足なら集まった分をそのまま返す（例外を投げない）
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_
    - _Properties: 1, 5, 6, 9, 10_

  - [ ] 1.7 `FallbackPoint` → `RouteCandidate` 変換と既定説明文を実装する
    - `id = "{kind}:{source}:{point.id}"`、`description` は `descriptions[lang] ?? descriptions.ja ?? defaultDescription(point)`
    - `defaultDescription` は札所なら「第{n}番札所 …をお参りできます。」相当、Spot なら「{name}を楽しめるスポットです。」を返し、必ず非空にする
    - `source` に `"temple"` / `"spot"` を付与し、`photoUrl` / `websiteUri` は存在時のみ展開
    - _Requirements: 2.4, 2.5, 2.6_
    - _Properties: 7, 8_

- [ ] 2. Fallback データプールを構築する
  - [ ] 2.1 `src/data/fallbackPools.ts` を新規作成する
    - `TEMPLE_GEO` + `TEMPLE_DETAILS` から `TEMPLE_FALLBACK_POINTS`（`id = "temple-{n}"`、`name = "第{n}番札所 {寺名}"`、`descriptions = { ja, en }`、`formattedAddress = TEMPLE_GEO[n].address`）を生成
    - `EHIME_SPOTS` から `SPOT_FALLBACK_POINTS`（`id` / `name` / `location` / `localizedDescriptions` / `category` / `imageUrls[0]` / `website`、`formattedAddress = "愛媛県"`）を生成
    - 緯度経度が有限数でない地点はプールから除外
    - `DEFAULT_FALLBACK_POOLS` を公開。モジュールトップで 1 回だけ構築（I/O なし）
    - _Requirements: 2.1, 2.4, 2.5_
    - _Properties: 7_

- [ ] 3. サーバー側の候補確定を共有ロジックに置き換える
  - [ ] 3.1 `api/_fallback-candidates.ts` を新規作成する
    - `../src/domain/candidateFallback.js` から定数・`clampCandidateCount`・`finalizeCandidates`・型を再エクスポート
    - `../src/data/fallbackPools.js` から `DEFAULT_FALLBACK_POOLS` を再エクスポート
    - src への import はこのファイルのみに閉じる（`_aws.ts` / `_google-places.ts` の `_` プレフィックス慣習に倣う）
    - _Requirements: 8.3_
    - _Properties: 13_

  - [ ] 3.2 `api/route-candidates.ts` を共有ロジックに接続する
    - ローカル `RouteCandidate` に `source?: CandidateSource` を追加して構造的に一致させる
    - `count` クランプを `sightseeing` は `clampCandidateCount(input.count, 6, 5)`（5〜8）、`food` / `cafe` / `custom` は従来の 3〜8（cafe 既定 4）に分岐
    - `parseArea` の 5,000m クランプは維持し、Places 検証の距離判定も基準半径のまま据え置く
    - `generateCandidates` は検証済み Primary を `finalizeCandidates` に渡し `FinalizeResult` を返す。キャッシュは `FinalizeResult` 全体を保持
    - 応答を `{ candidates, appliedRadiusMeters, minimumCount }` に拡張。拡大後も 0 件なら従来どおり 502
    - Bedrock 失敗 / JSON 不正は Fallback を走らせず 502（原因をログに残す）
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 3.5, 3.6, 8.1, 8.3, 8.4_
    - _Properties: 1, 4, 9, 13, 14_

- [ ] 4. ポートとアダプタを結果オブジェクトに移行する
  - [ ] 4.1 `ChatPort.generateRouteCandidates` の戻り値を `RouteCandidatesResult` に変更する
    - `src/ports/index.ts` のシグネチャを更新し、`CandidateSource` / `RouteCandidatesResult` の再エクスポートを追加
    - _Requirements: 3.6, 4.1_
    - _Properties: 11_

  - [ ] 4.2 `src/adapters/aws/chat.ts` で応答フィールドを検証・補完する
    - `appliedRadiusMeters` / `minimumCount` を検証し、欠落・不正時は `input.area.radiusMeters` と `CANDIDATE_MINIMUM_COUNT` で補う
    - _Requirements: 4.1_
    - _Properties: 11_

  - [ ] 4.3 `mockRouteCandidates` を共有ロジックに合わせる
    - `slice(0, count ?? 6)` を `clampCandidateCount(input.count, kind === "cafe" ? 4 : 6, kind === "sightseeing" ? CANDIDATE_MINIMUM_COUNT : 3)` に置換
    - Primary を `finalizeCandidates`（`baseRadiusMeters = Math.min(CANDIDATE_BASE_RADIUS_METERS, input.area.radiusMeters)`、`usedPlaceIds = input.route.map(...)`、`maximumCount = CANDIDATE_MAXIMUM_COUNT`、`DEFAULT_FALLBACK_POOLS`）に通して `RouteCandidatesResult` を返す
    - `food` / `cafe` / `custom` の既存フィルタは変更しない。`MOCK_RECOMMENDATIONS` と `mockRecommendation` は無変更
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.2, 8.3, 8.4_
    - _Properties: 8, 13, 14, 16_

- [ ] 5. チェックポイント - 型と既存テストの健全性を確認する
  - `npm run typecheck` と `node node_modules/typescript/bin/tsc --noEmit -p api/tsconfig.json` を実行し、ポート戻り値変更による型崩れをすべて解消する
  - `npm test` を実行し、既存テストのスタブ（`generateRouteCandidates` の戻り値）を新しい結果オブジェクトに更新する
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. クライアント最終ガードと候補カード表示を実装する
  - [ ] 6.1 `TourismRouteBuilder` の `loadCandidates` に最終ガードを組み込む
    - `effectiveArea` state（`GeoArea | null`）を追加し、`appliedRadiusMeters` を反映
    - 再フィルタ閾値を `Math.max(area.radiusMeters, result.appliedRadiusMeters)` に変更
    - フィルタ後件数が `result.minimumCount` 未満なら `finalizeCandidates` をクライアント側で実行して `CANDIDATE_MAXIMUM_COUNT` を上限に補完
    - 補完後も 0 件なら `routeBuilder.loadError` で従来のエラー状態＋再試行操作を表示
    - 要求 `area.radiusMeters` は基準 5,000m のまま、`count` は `kind === "cafe" ? 4 : 6` を維持
    - `initialRouteFromTheme` の 5km 判定と `area` メモは変更しない
    - `RoutePreview` には `effectiveArea ?? area` を渡す
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.1, 8.3_
    - _Properties: 1, 11_

  - [ ] 6.2 候補カードに札所タグと中心距離を表示する
    - `source === "temple"` のとき既存 `Tag`（`tone="moss"`、`leading="🛕"`）で `routeBuilder.templeTag` を表示
    - `centerDistanceLabel` の結果を `.route-builder-card__distance` に表示（`area.center` からの距離を `BinarySwipeDeck` に props で渡す）
    - _Requirements: 5.1, 5.2, 5.3, 7.5_
    - _Properties: 12_

  - [ ] 6.3 候補不足の注記を表示する
    - `candidates.length < minimumCount` のとき進捗表示の下に `role="status"` で `routeBuilder.shortageNotice` を表示し、確定件数を `{count}` に差し込む
    - _Requirements: 5.4, 5.5, 7.5_
    - _Properties: 15_

- [ ] 7. i18n とスタイルを追加する
  - [ ] 7.1 `src/i18n/labels.ts` に `routeBuilder.*` キーを追加する
    - `templeTag` / `distanceMeters` / `distanceKilometers` / `shortageNotice` を ja / en / iyo の 3 言語すべてで追加
    - 差し込みは既存 `routeBuilder.progress` と同じ `String.replace("{...}", ...)` 方式に揃える
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
    - _Properties: 15_

  - [ ] 7.2 `src/ui/styles/screens.css` にカード距離と注記のスタイルを追加する
    - `.route-builder-card__distance` と `.route-builder-swipe__notice` を既存 `route-builder-*` 命名に合わせて追加
    - _Requirements: 5.2, 5.4_

- [ ] 8. プロパティテストとサンプルテストを追加する
  - [ ]* 8.1 `src/domain/candidateFallback.test.ts` にジェネレータと件数・順序系プロパティを実装する
    - `ehimeCenterArb`（愛媛陸域を 8:1 で重み付け、遠方定数で在庫ゼロを踏む）、`primaryArb`（0〜10 件）、`routeArb` を定義
    - **Property 1: 候補件数は下限と上限に収まる**
    - **Property 2: Primary 候補は失われない**
    - **Property 3: 候補集合の一意性とルート除外**
    - 各テストに `Feature: swipe-candidate-fallback-expansion, Property {n}: {要約}` をタグとして記述、試行回数は fast-check 既定 100 回
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.4, 8.3**

  - [ ]* 8.2 `src/domain/candidateFallback.test.ts` にクランプと距離書式のプロパティを追加する
    - **Property 4: count クランプの境界**（NaN・undefined・負数・範囲内整数の恒等性）
    - **Property 12: 距離表示の書式**（999m / 1,000m / 1,050m の境界も例示で確認）
    - **Validates: Requirements 1.6, 5.3**

  - [ ]* 8.3 `src/domain/candidateFallback.test.ts` に補完選定と半径拡大のプロパティを追加する
    - **Property 5: Fallback は中心距離の昇順**
    - **Property 6: sightseeing は飲食カテゴリを補完しない**
    - **Property 9: 適用半径は下限を満たす最小の段階半径**
    - **Property 10: 拡大後も不足なら例外を投げない**（愛媛外・海上の中心座標を含む）
    - **Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4**

  - [ ]* 8.4 `src/domain/candidateFallback.test.ts` に構造・判別属性のプロパティを追加する
    - **Property 7: Fallback は Primary と同一構造で非空**（`TEMPLE_DETAILS` 未収載番号の既定説明文も例示で確認）
    - **Property 8: Fallback 判別属性の排他性**
    - 人工の小さな `FallbackPools` を注入して枯渇ケース（既存ルートに札所・Spot が含まれる）も検証
    - **Validates: Requirements 2.4, 2.5, 2.6, 6.3**

  - [ ]* 8.5 `src/data/fallbackPools.test.ts` にデータ側の全数検査を実装する
    - **Property 7: Fallback は Primary と同一構造で非空**（`id` / `name` / `descriptions.ja` の非空、`location` の有限性）
    - 札所 40〜65 の網羅と `id` の一意性を全数で確認
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 8.6 `src/adapters/mock/routeCandidates.test.ts` にモック整合のプロパティを実装する
    - **Property 13: モックと API の候補確定規則の一致**（同一 Primary 件数での件数・適用半径・判別属性）
    - **Property 14: 非 sightseeing の既存挙動維持**（Fallback 不混入、`appliedRadiusMeters` が基準半径、`food` / `cafe` は全候補 `category === "food"`）
    - **Property 8: Fallback 判別属性の排他性**（モック経路）
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 8.3, 8.4**

  - [ ]* 8.7 `src/i18n/routeBuilderLabels.test.ts` に i18n キーの全数検査を実装する
    - **Property 15: i18n 追加キーの言語網羅**（追加 4 キー × ja / en / iyo が非空）
    - 既存ラベルテストがあればそこに追記する
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [ ]* 8.8 `src/ui/screens/TourismRouteBuilder.fallback.test.tsx` に RTL の例示テストを実装する
    - 下限未満応答でクライアント補完が働くこと、`appliedRadiusMeters` 以内の候補が除去されないこと（Property 11）
    - 札所タグ・中心距離・Shortage_Notice（`role="status"`、件数差し込み）が i18n 経由で表示されること
    - 補完後 0 件でエラー状態と再試行操作が出ること、要求半径が 5,000m であること
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4, 5.5, 7.5**

  - [ ]* 8.9 `api/route-candidates.test.ts` に API の例示テストを実装する
    - Bedrock / Google Places をスタブし、Places 全滅 → Fallback で 200、ローカルも 0 件 → 502 を確認
    - 応答に `appliedRadiusMeters` と `minimumCount` が含まれること、`count` が 5〜8 に丸められることを確認
    - **Validates: Requirements 1.6, 3.5, 3.6**

- [ ] 9. 既存不変条件の回帰確認
  - [ ]* 9.1 `src/adapters/mock/routeCandidates.test.ts` にモック推薦の全数検査を追加する
    - **Property 16: モック推薦の既存不変条件**（立寄先 2〜4 件、すべて中心から 5,000m 以内、`source` 属性を持たない）
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ] 9.2 推薦系の既存不変条件を壊していないことを確認する
    - `api/recommendations.ts` の探索半径 5,000m と `mockRecommendation` のランタイム検証（2〜4 件・5km）が無変更であることを差分で確認
    - 推薦系の既存テストを一切変更せずに `npm test` が通ることを確認（変更が漏れていれば既存テストが落ちる）
    - 半径拡大と Fallback がスワイプ候補生成のみに閉じていることをコード上で確認
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
    - _Properties: 14, 16_

- [ ] 10. 最終チェックポイント - 型チェックと全テスト
  - `npm run typecheck` を実行して root 側の型を検証する
  - `node node_modules/typescript/bin/tsc --noEmit -p api/tsconfig.json` を実行して `api/` 側の型を個別に検証する（root `tsconfig.json` の対象外のため必須）
  - `npm test` を実行して全テストが通ることを確認する
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 付きサブタスクは任意。MVP を急ぐ場合はスキップできる
- 各タスクは要求番号（`_Requirements:_`）と設計のプロパティ番号（`_Properties:_`）を参照し、追跡できるようにしている
- ポート戻り値の変更（`RouteCandidatesResult`）は型エラーとして検出されるため、`npm run typecheck` を変更完了の判定に使う
- `api/` は root `tsconfig.json` の対象外なので、`tsc -p api/tsconfig.json` の個別実行が必要
- プロパティテストは Vitest + fast-check（既存例: `src/adapters/mock/spot.test.ts`）、試行回数は fast-check 既定の 100 回
- `RouteCandidate.source` を optional にすることで既存フィクスチャを壊さない

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "7.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "7.1"] },
    { "id": 3, "tasks": ["1.4", "4.1"] },
    { "id": 4, "tasks": ["1.5", "3.1", "4.2"] },
    { "id": 5, "tasks": ["1.6", "3.2", "4.3"] },
    { "id": 6, "tasks": ["1.7", "6.1"] },
    { "id": 7, "tasks": ["6.2", "8.1", "8.5", "8.7"] },
    { "id": 8, "tasks": ["6.3", "8.2", "8.6", "8.9"] },
    { "id": 9, "tasks": ["8.3", "8.8", "9.1"] },
    { "id": 10, "tasks": ["8.4", "9.2"] }
  ]
}
```
