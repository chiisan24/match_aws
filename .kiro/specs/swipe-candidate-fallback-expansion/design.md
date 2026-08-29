# Design Document

## Overview

スワイプ候補（TourismRouteBuilder）が 5km 圏内制約で 1 件しか出ない問題に対し、**候補確定ロジックを純粋な共有ドメインモジュールへ切り出し**、サーバー（`api/route-candidates.ts`）・モックアダプタ（`src/adapters/mock/chat.ts`）・クライアント最終ガード（`TourismRouteBuilder`）の 3 箇所が同一の補完・半径拡大規則を使う構成にする。

補完元はローカルデータ（`TEMPLE_GEO` + `TEMPLE_DETAILS`、`EHIME_SPOTS`）。半径は 5,000m → 10,000m → 20,000m の順に、下限 5 件を満たすまで段階拡大する。テーマ推薦（`api/recommendations.ts` / `MOCK_RECOMMENDATIONS`）の 5km 制約には一切触れない。

コード例は既存実装と同じ TypeScript（strict、ESM）で示す。

---

## Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │ src/domain/candidateFallback.ts  （純粋関数）  │
                  │  - CANDIDATE_RADII / MINIMUM / MAXIMUM        │
                  │  - clampCandidateCount()                     │
                  │  - finalizeCandidates(primary, ctx, pools)   │
                  │  - centerDistanceLabel()                     │
                  └───────────────┬──────────────────────────────┘
                                  │ pools 注入
                  ┌───────────────┴──────────────────────────────┐
                  │ src/data/fallbackPools.ts                    │
                  │  TEMPLE_GEO+TEMPLE_DETAILS → templePoints    │
                  │  EHIME_SPOTS               → spotPoints      │
                  └───┬──────────────────┬───────────────────┬───┘
                      │                  │                   │
   api/_fallback-candidates.ts   mock/chat.ts        TourismRouteBuilder.tsx
   （Vercel 関数用の薄い橋渡し）   （mockRouteCandidates）  （応答後の最終ガード）
                      │                  │                   │
              api/route-candidates.ts    │        src/adapters/aws/chat.ts 経由
```

- **1 実装 3 利用**: 補完・半径拡大・重複排除・件数クランプは `finalizeCandidates` だけに存在する。API/モック/UI は「Primary 候補の作り方」だけが異なる。
- **データ注入**: ドメイン層がアダプタ層（`adapters/mock/spots.ts`）を直接 import しないよう、データセットの束ね役を `src/data/fallbackPools.ts` に置き、`finalizeCandidates` は `FallbackPools` を引数で受け取る。テストでは小さな人工プールを注入できる。

### api → src の共有可否（実測結果）

`api/tsconfig.json` は `include: ["**/*.ts"]` だが、**import 先は型検査対象に自動で含まれる**。実際に検証用ファイル `api/_probe-import.ts` を置いて確認した:

- `import { TEMPLE_GEO } from "../src/data/templeGeo.js"` → `tsc -p api/tsconfig.json` は **成功**（終了コード 0）
- `import { EHIME_SPOTS } from "../src/adapters/mock/spots.js"` → **成功**（`src/ports` 経由の型もエラーなし）

（検証ファイルは削除済み。`moduleResolution: "Bundler"` のため `.js` 指定でも `.ts` に解決される。）

したがって api から src の純粋モジュールを import できる。ただし Vercel 関数のバンドルは実デプロイでしか完全には確認できないため、**接点を 1 ファイルに閉じる**方針を取る:

- `api/_fallback-candidates.ts` を新設し（既存 `api/_aws.ts` / `api/_google-places.ts` の `_` プレフィックス慣習に倣う）、`../src/domain/candidateFallback.js` と `../src/data/fallbackPools.js` の import はこのファイルのみに置く。`api/route-candidates.ts` は `./_fallback-candidates.js` だけを見る。
- 共有される src 側モジュールに課す制約: **DOM / React / import.meta / 環境変数に依存しない**、値の import は型のみか純粋データのみ。`src/domain/candidateFallback.ts` は `src/domain/geofence.ts` と型のみに依存する。
- 万一デプロイ時にバンドル解決が失敗した場合の退避策: `api/_fallback-candidates.ts` 内に `src/data/*` から生成した静的コピーを持たせる（スクリプト `scripts/` で再生成）。この場合も**アルゴリズム本体は共有のまま**にし、データだけを複製する。

---

## Components and Interfaces

### 1. `src/domain/candidateFallback.ts`（新規・純粋）

```ts
import type { GeoPoint, RouteCandidate, RouteCandidateKind } from "./types";
import { haversineDistanceMeters } from "./geofence";

/** スワイプ候補の下限・上限件数（Minimum_Count / Maximum_Count）。 */
export const CANDIDATE_MINIMUM_COUNT = 5;
export const CANDIDATE_MAXIMUM_COUNT = 8;
/** 基準半径と段階拡大半径。昇順であることが前提。 */
export const CANDIDATE_BASE_RADIUS_METERS = 5_000;
export const CANDIDATE_RADII_METERS = [5_000, 10_000, 20_000] as const;

/** Fallback 判別属性。UI のタグ表示と回帰テストで使う。 */
export type CandidateSource = "primary" | "temple" | "spot";

/** 補完元 1 件。Spot / 札所を共通形に正規化したもの。 */
export interface FallbackPoint {
  /** `place.id` に使う安定 ID（札所は `temple-49`、Spot は Spot.id）。 */
  id: string;
  source: Exclude<CandidateSource, "primary">;
  name: string;
  location: GeoPoint;
  formattedAddress: string;
  /** 言語コード → 説明。未収載言語は ja にフォールバック。 */
  descriptions: Partial<Record<string, string>>;
  /** Spot 由来のみ。sightseeing の food 除外判定に使う。 */
  category?: "sightseeing" | "food" | "souvenir" | "onsen";
  photoUrl?: string;
  websiteUri?: string;
}

export interface FallbackPools {
  temples: FallbackPoint[];
  spots: FallbackPoint[];
}

export interface FinalizeContext {
  kind: RouteCandidateKind;
  lang: string;
  center: GeoPoint;
  /** 要求された基準半径（通常 5,000m）。 */
  baseRadiusMeters: number;
  /** ルートに既に含まれる placeId。 */
  usedPlaceIds: readonly string[];
  /** 上限件数（clampCandidateCount 済み）。 */
  maximumCount: number;
  /** 下限件数。既定は CANDIDATE_MINIMUM_COUNT。 */
  minimumCount?: number;
}

export interface FinalizeResult {
  candidates: RouteCandidate[];
  /** 候補確定時に実際に適用された半径。 */
  appliedRadiusMeters: number;
  /** 判定に使った下限件数。 */
  minimumCount: number;
}

/** count を下限〜上限に丸める。非数値は既定値へ。 */
export function clampCandidateCount(
  value: unknown,
  fallback: number,
  minimum?: number,
): number;

/**
 * Primary 候補に Fallback を足し、半径を段階拡大して下限件数を目指す。
 * kind が sightseeing 以外のときは Fallback を追加せず、重複排除と
 * 上限クランプのみ行う（Req 8.4）。
 */
export function finalizeCandidates(
  primary: readonly RouteCandidate[],
  context: FinalizeContext,
  pools: FallbackPools,
): FinalizeResult;

/** 距離表示用の i18n キーと差し込み値を返す（表示は呼び出し側で t()）。 */
export function centerDistanceLabel(meters: number): {
  key: "routeBuilder.distanceMeters" | "routeBuilder.distanceKilometers";
  value: string;
};
```

#### `finalizeCandidates` のアルゴリズム

```
1. seen ← usedPlaceIds の集合
   result ← primary を順に走査し、place.id が seen に無いものだけ採用（source: "primary"）
            採用時に seen へ追加。maximumCount で打ち切り。
2. kind !== "sightseeing" ならここで
   { candidates: result, appliedRadiusMeters: baseRadiusMeters, minimumCount } を返す。
3. minimum ← minimumCount ?? CANDIDATE_MINIMUM_COUNT
   applied ← baseRadiusMeters
   radii ← CANDIDATE_RADII_METERS のうち baseRadiusMeters 以上のもの（昇順）
4. radii を順に r について:
     applied ← r
     pool ← [...pools.temples, ...pools.spots]
       ・ seen に無い
       ・ Spot 由来かつ category === "food" は除外（Req 2.3）
       ・ haversineDistanceMeters(center, location) <= r
     pool を距離昇順（同距離は id 昇順で決定的）にソート
     pool を先頭から result.length < min(maximum, minimum) の間だけ採用し seen へ追加
     result.length >= minimum なら break（それ以上拡大しない：Req 3.3）
5. { candidates: result, appliedRadiusMeters: applied, minimumCount: minimum } を返す。
```

- **補完の停止点は `minimum`**（`maximum` ではない）。Primary が 6 件あれば補完 0 件、Primary 1 件なら 4 件補完して 5 件。上限 8 は Primary 側のクランプで担保する（Req 1.3）。
- 20,000m まで適用しても不足する場合は集まった分をそのまま返す（Req 3.4）。0 件も返り得る。
- ソートが決定的なのでキャッシュキーが同じなら結果も同じ。

#### Fallback → RouteCandidate 変換

```ts
function toCandidate(point: FallbackPoint, kind: RouteCandidateKind, lang: string): RouteCandidate {
  return {
    id: `${kind}:${point.source}:${point.id}`,
    kind,
    title: point.name,
    description: point.descriptions[lang] ?? point.descriptions.ja ?? defaultDescription(point),
    searchQuery: point.name,
    source: point.source,
    place: {
      id: point.id,
      name: point.name,
      formattedAddress: point.formattedAddress,
      location: point.location,
      ...(point.photoUrl ? { photoUrl: point.photoUrl } : {}),
      ...(point.websiteUri ? { websiteUri: point.websiteUri } : {}),
    },
  };
}
```

`defaultDescription` は札所なら「第49番札所 浄土寺をお参りできます。」相当、Spot なら既存モックと同じ「{name}を楽しめるスポットです。」を返す（Req 2.5）。`TEMPLE_DETAILS` に説明がない札所番号でも必ず非空になる。

### 2. `src/data/fallbackPools.ts`（新規）

```ts
import { TEMPLE_GEO } from "./templeGeo";
import { TEMPLE_DETAILS } from "./templeDetails";
import { EHIME_SPOTS } from "../adapters/mock/spots";
import type { FallbackPoint, FallbackPools } from "../domain/candidateFallback";

export const TEMPLE_FALLBACK_POINTS: FallbackPoint[] = /* TEMPLE_GEO 40〜65 を正規化 */;
export const SPOT_FALLBACK_POINTS: FallbackPoint[] = /* EHIME_SPOTS を正規化 */;
export const DEFAULT_FALLBACK_POOLS: FallbackPools = {
  temples: TEMPLE_FALLBACK_POINTS,
  spots: SPOT_FALLBACK_POINTS,
};
```

- 札所: `id = "temple-{n}"`、`name = "第{n}番札所 {寺名}"`（寺名は `TEMPLE_DETAILS[n].descriptionJa` 先頭の正式名、無い番号は「第{n}番札所」）、`descriptions = { ja: descriptionJa, en: descriptionEn }`、`formattedAddress = TEMPLE_GEO[n].address`。
- Spot: `EHIME_SPOTS` の `id / name / location / localizedDescriptions / category / imageUrls[0] / website` をそのまま写す。`formattedAddress` は既存モックと同じ `"愛媛県"`。
- モジュールトップで 1 回だけ構築（配列生成のみ、I/O なし）。

### 3. `api/_fallback-candidates.ts`（新規・橋渡し）

```ts
export {
  CANDIDATE_MINIMUM_COUNT,
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_BASE_RADIUS_METERS,
  CANDIDATE_RADII_METERS,
  clampCandidateCount,
  finalizeCandidates,
  type CandidateSource,
  type FinalizeResult,
} from "../src/domain/candidateFallback.js";
export { DEFAULT_FALLBACK_POOLS } from "../src/data/fallbackPools.js";
```

`api/route-candidates.ts` 側のローカル `RouteCandidate` インターフェースには `source?: CandidateSource` を追加し、`src/domain/types.ts` の定義と形を揃える（api は型を共有せず構造的に一致させる既存方針を維持）。

### 4. `api/route-candidates.ts` の変更

| 箇所 | 変更前 | 変更後 |
| --- | --- | --- |
| `parseArea` | `Math.min(5_000, ...)` | `baseRadiusMeters` として 5,000m クランプは維持（要求は 5km が上限）。拡大は `finalizeCandidates` 内で 20,000m まで行う |
| `count` クランプ | `Math.min(8, Math.max(3, ...))` | `sightseeing` は `clampCandidateCount(input.count, 6, 5)` で **5〜8**、`food/cafe/custom` は従来どおり **3〜8**（cafe 既定 4 を維持：Req 8.4） |
| `generateCandidates` | Bedrock → Places 検証 → 距離除外で終了 | 検証済み Primary を `finalizeCandidates` に渡し、`FinalizeResult` を返す |
| Places 検証の距離判定 | `> area.radiusMeters` で除外 | 同じ（Primary は基準半径内に限る。拡大はローカルデータのみ：Req 8.3） |
| キャッシュ | `candidates` のみ保持 | `FinalizeResult` 全体を保持 |
| 応答 | `{ candidates }` | `{ candidates, appliedRadiusMeters, minimumCount }` |
| 0 件時 | 502 | 同じ（拡大後も 0 件なら 502：Req 3.5） |

`sightseeing` 以外の kind は `finalizeCandidates` を通しても Fallback が付かないため、既存挙動と同一の出力になる（Req 8.4）。

### 5. `ChatPort.generateRouteCandidates` の戻り値

適用半径をクライアントへ渡す必要があるため、ポートの戻り値を結果オブジェクトに変更する。

```ts
// src/domain/types.ts
export interface RouteCandidatesResult {
  candidates: RouteCandidate[];
  /** 候補確定時に実際に適用された半径（メートル）。 */
  appliedRadiusMeters: number;
  /** サーバー／モックが用いた下限件数。 */
  minimumCount: number;
}

// src/ports/index.ts
generateRouteCandidates(input: RouteCandidatesInput): Promise<RouteCandidatesResult>;
```

影響: `src/adapters/aws/chat.ts`（応答の `appliedRadiusMeters` / `minimumCount` を検証し、欠落時は `input.area.radiusMeters` / `CANDIDATE_MINIMUM_COUNT` で補う）、`src/adapters/mock/chat.ts`、`TourismRouteBuilder.tsx`、既存テストのスタブ。

### 6. `src/adapters/mock/chat.ts` の変更

```ts
function mockRouteCandidates(input: RouteCandidatesInput): RouteCandidatesResult {
  // 既存のプール構築（used 除外・半径フィルタ・kind 別絞り込み）はそのまま。
  const primary = pool
    .slice(0, clampCandidateCount(input.count, input.kind === "cafe" ? 4 : 6,
      input.kind === "sightseeing" ? CANDIDATE_MINIMUM_COUNT : 3))
    .map(toPrimaryCandidate);           // source は付けない（= "primary" 相当）
  return finalizeCandidates(primary, {
    kind: input.kind,
    lang: input.lang,
    center: input.area.center,
    baseRadiusMeters: Math.min(CANDIDATE_BASE_RADIUS_METERS, input.area.radiusMeters),
    usedPlaceIds: input.route.map((stop) => stop.placeId),
    maximumCount: CANDIDATE_MAXIMUM_COUNT,
  }, DEFAULT_FALLBACK_POOLS);
}
```

- `slice(0, count ?? 6)` は `clampCandidateCount` に置換。
- `food` / `cafe` / `custom` の既存フィルタは変更なし。`finalizeCandidates` が非 sightseeing で Fallback を足さないため挙動は同一（Req 6.4 / 8.4）。
- `MOCK_RECOMMENDATIONS` と `mockRecommendation` は無変更（Req 8.2）。

### 7. `src/ui/screens/TourismRouteBuilder.tsx` の変更

| 箇所 | 変更内容 |
| --- | --- |
| `initialRouteFromTheme`（73 行付近） | **変更なし**。テーマ立寄先の 5km 判定は維持（Req 8.1/8.3） |
| `area` メモ（328 行付近） | **変更なし**。要求は常に基準 5,000m（Req 4.4） |
| 新規 state | `const [effectiveArea, setEffectiveArea] = useState<GeoArea | null>(null)` — 応答の `appliedRadiusMeters` を反映 |
| `loadCandidates`（367-371 行付近） | 再フィルタの閾値を `area.radiusMeters` → `result.appliedRadiusMeters` に変更（Req 4.1）。フィルタ後件数が `minimumCount` 未満なら `finalizeCandidates` をクライアント側でも実行して補完（Req 4.2）。それでも 0 件なら従来どおり `loadError`（Req 4.3） |
| `count` 送信 | `kind === "cafe" ? 4 : 6` を維持（sightseeing は 6 のままで下限 5 を満たす） |
| `BinarySwipeDeck` | 候補カードに距離表示と札所タグを追加。`area.center` からの距離を props で受け取る |
| 不足注記 | `candidates.length < minimumCount` のとき Shortage_Notice を進捗表示の下に `role="status"` で表示（Req 5.4/5.5） |
| `RoutePreview` の `area` | `effectiveArea ?? area` を渡し、拡大圏の立寄先がマップ範囲外にならないようにする |

`loadCandidates` の要点:

```ts
const result = await chat.generateRouteCandidates({ ...request });
const appliedRadius = Math.max(area.radiusMeters, result.appliedRadiusMeters);
const bounded = result.candidates.filter(
  (candidate) => haversineDistanceMeters(area.center, candidate.place.location) <= appliedRadius,
);
const guarded = bounded.length >= result.minimumCount
  ? { candidates: bounded, appliedRadiusMeters: appliedRadius, minimumCount: result.minimumCount }
  : finalizeCandidates(bounded, {
      kind, lang, center: area.center,
      baseRadiusMeters: area.radiusMeters,
      usedPlaceIds: routeContext.map((stop) => stop.placeId),
      maximumCount: CANDIDATE_MAXIMUM_COUNT,
      minimumCount: result.minimumCount,
    }, DEFAULT_FALLBACK_POOLS);
if (guarded.candidates.length === 0) throw new Error(t("routeBuilder.loadError"));
setCandidates(guarded.candidates);
setEffectiveArea({ center: area.center, radiusMeters: guarded.appliedRadiusMeters });
```

カード表示（既存 `Tag` は `src/ui/components/Tag.tsx`、`tone: "teal" | "accent" | "moss" | "outline"` と `leading` を持つ）:

```tsx
<div className="route-builder-card__title-row">
  <h2>{current.title}</h2>
  <Tag tone={current.kind === "food" || current.kind === "cafe" ? "accent" : "teal"}>
    {t(`routeBuilder.kind.${current.kind}`)}
  </Tag>
  {current.source === "temple" ? (
    <Tag tone="moss" leading="🛕">{t("routeBuilder.templeTag")}</Tag>
  ) : null}
</div>
<small className="route-builder-card__distance">
  {t(distance.key).replace("{value}", distance.value)}
</small>
```

CSS は `src/ui/styles/screens.css` に `.route-builder-card__distance` と `.route-builder-swipe__notice` を追加（既存 `route-builder-*` 命名に合わせる）。

---

## Data Models

```ts
// src/domain/types.ts への追加・変更
export type CandidateSource = "primary" | "temple" | "spot";

export interface RouteCandidate {
  id: string;
  kind: RouteCandidateKind;
  title: string;
  description: string;
  searchQuery: string;
  /** 省略時は Primary（Google 検証済み）。Fallback は "temple" / "spot"。 */
  source?: CandidateSource;
  place: RecommendedPlace & { location: GeoPoint };
}

export interface RouteCandidatesResult {
  candidates: RouteCandidate[];
  appliedRadiusMeters: number;
  minimumCount: number;
}
```

`source` を **optional** にすることで既存の候補生成箇所（`initialRouteFromTheme`、既存テストのフィクスチャ）は無変更でコンパイルできる。`src/ports/index.ts` の再エクスポートに `CandidateSource` / `RouteCandidatesResult` を追加する。

### API 形状

リクエスト（変更なし。`area.radiusMeters` は 5,000m にクランプされる）:

```json
{
  "lang": "ja",
  "kind": "sightseeing",
  "theme": { "id": "...", "title": "...", "summary": "...", "reason": "..." },
  "area": { "center": { "lat": 33.84, "lng": 132.79 }, "radiusMeters": 5000 },
  "route": [{ "title": "...", "placeId": "...", "location": { "lat": 0, "lng": 0 } }],
  "count": 6
}
```

レスポンス（200）:

```json
{
  "candidates": [
    {
      "id": "sightseeing:ChIJ...",
      "kind": "sightseeing",
      "title": "松山城",
      "description": "...",
      "searchQuery": "松山城",
      "place": { "id": "ChIJ...", "name": "松山城", "location": { "lat": 33.84, "lng": 132.76 } }
    },
    {
      "id": "sightseeing:temple:temple-51",
      "kind": "sightseeing",
      "title": "第51番札所 石手寺",
      "description": "...",
      "searchQuery": "第51番札所 石手寺",
      "source": "temple",
      "place": { "id": "temple-51", "name": "第51番札所 石手寺", "formattedAddress": "愛媛県松山市石手二丁目9-21", "location": { "lat": 33.847577, "lng": 132.797129 } }
    }
  ],
  "appliedRadiusMeters": 10000,
  "minimumCount": 5
}
```

レスポンス（502、拡大後も 0 件）: `{ "error": "Route candidates backend error", "detail": "..." }`（既存形式のまま）

---

## Error Handling

| 状況 | 扱い |
| --- | --- |
| Bedrock 失敗 / JSON 不正 | 既存どおり例外 → 502。Fallback は走らせない（Primary 生成の失敗と候補不足は別事象として扱い、原因をログに残す） |
| Places 検証で全滅 | `finalizeCandidates` が Fallback を補い、1 件以上あれば 200。0 件なら 502 |
| 20,000m でも下限未達 | 200 を返し、`appliedRadiusMeters: 20000` と実件数を返す。UI が Shortage_Notice を表示 |
| `appliedRadiusMeters` / `minimumCount` 欠落応答（旧サーバー） | `src/adapters/aws/chat.ts` が `input.area.radiusMeters` と `CANDIDATE_MINIMUM_COUNT` で補完し、UI は最終ガードで補完する |
| クライアント補完後も 0 件（`area` 不在・愛媛外中心） | `status = "error"` + `routeBuilder.loadError` + 再試行ボタン（既存 UI を流用） |
| ローカルデータの座標欠損 | `fallbackPools.ts` 構築時に有限数チェックで除外（プールに入れない） |

---

## i18n Keys

`src/i18n/labels.ts` の `routeBuilder.*` 群に追加。既存の `routeBuilder.*` と同じく **ja / en / iyo の 3 言語**を必ず与える（未収載言語は既存 `resolveLabel` により ja へフォールバック）。

| キー | ja | en | iyo |
| --- | --- | --- | --- |
| `routeBuilder.templeTag` | お遍路札所 | Pilgrimage temple | お遍路さんの札所 |
| `routeBuilder.distanceMeters` | 中心から約{value}m | About {value} m from the centre | 中心から約{value}m |
| `routeBuilder.distanceKilometers` | 中心から約{value}km | About {value} km from the centre | 中心から約{value}km |
| `routeBuilder.shortageNotice` | この周辺で見つかった候補は{count}件です。範囲を広げて探しています。 | Only {count} candidates were found nearby, so the search area was widened. | この辺で見つかったんは{count}件やけん、範囲を広げて探しとるよ。 |

差し込みは既存 `routeBuilder.progress` / `routeBuilder.routeLead` と同じ `String.replace("{...}", ...)` 方式。距離値の整形は `centerDistanceLabel`（1,000m 未満は整数メートル、1,000m 以上は小数第 1 位のキロメートル：Req 5.3）が返す文字列を `{value}` に差し込む。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 候補件数は下限と上限に収まる

*For any* 中心座標・既存ルート・Primary 候補集合について、`finalizeCandidates` の出力件数は `min(Minimum_Count, 到達可能な候補総数)` 以上であり、かつ常に Maximum_Count 以下である。

**Validates: Requirements 1.1, 1.2, 1.3, 3.4**

### Property 2: Primary 候補は失われない

*For any* Primary 候補集合について、既存ルートと重複しない Primary 候補は（上限件数に達しない限り）すべて出力に含まれ、Fallback より前に並ぶ。

**Validates: Requirements 1.2, 8.3**

### Property 3: 候補集合の一意性とルート除外

*For any* 中心座標・既存ルート・（重複を含み得る）Primary 候補集合について、出力の `place.id` は互いに異なり、既存ルートの `placeId` と一致するものを含まない。

**Validates: Requirements 1.4, 1.5**

### Property 4: count クランプの境界

*For any* 入力値（数値・NaN・undefined・負数を含む）について、`clampCandidateCount` の結果は指定下限以上 Maximum_Count 以下であり、範囲内の整数入力に対しては恒等写像である。

**Validates: Requirements 1.6**

### Property 5: Fallback は中心距離の昇順

*For any* 中心座標について、出力中の Fallback 候補の中心距離列は非減少であり、より近い未使用の適格地点が採用されずに残ることはない。

**Validates: Requirements 2.1, 2.2**

### Property 6: sightseeing は飲食カテゴリを補完しない

*For any* 中心座標について、`kind = "sightseeing"` の出力に含まれる Spot 由来 Fallback は `category !== "food"` を満たす。

**Validates: Requirements 2.3**

### Property 7: Fallback は Primary と同一構造で非空

*For any* Fallback 候補について、`id` / `kind` / `title` / `description` / `searchQuery` は非空文字列であり、`place.location` の緯度経度は有限数である。札所由来の候補は `TEMPLE_DETAILS` に説明が無い番号でも非空の `description` を持つ。

**Validates: Requirements 2.4, 2.5**

### Property 8: Fallback 判別属性の排他性

*For any* 出力候補について、Primary 由来は `source` が未設定または `"primary"` であり、Fallback 由来は `"temple"` または `"spot"` である。この規則は Candidate_API 経路とモック経路で一致する。

**Validates: Requirements 2.6, 6.3**

### Property 9: 適用半径は下限を満たす最小の段階半径

*For any* 中心座標について、`appliedRadiusMeters` は `[5000, 10000, 20000]` のいずれかであり、下限件数を満たせる最小の段階半径（満たせない場合は 20000）と一致する。より小さい半径で下限に達している場合に、より大きい半径が適用されることはない。

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 10: 拡大後も不足なら例外を投げない

*For any* 中心座標（愛媛外・海上を含む）について、`finalizeCandidates` は例外を投げず、20,000m 圏内の適格地点数が下限未満であればその件数（0 を含む）を返す。

**Validates: Requirements 3.4**

### Property 11: クライアントの距離判定は適用半径に従う

*For any* 応答（`appliedRadiusMeters` が基準半径より大きい場合を含む）について、`appliedRadiusMeters` 以内の候補はクライアント側の再フィルタで除去されない。

**Validates: Requirements 4.1**

### Property 12: 距離表示の書式

*For any* 非負の有限距離について、1,000m 未満はメートル単位の整数表記キー、1,000m 以上は小数第 1 位までのキロメートル単位表記キーが選択される。

**Validates: Requirements 5.3**

### Property 13: モックと API の候補確定規則の一致

*For any* 中心座標・既存ルート・kind について、モックアダプタの出力件数・適用半径・判別属性は、同一の Primary 件数を与えた Candidate_API 経路の確定規則と一致する。

**Validates: Requirements 6.1, 6.2**

### Property 14: 非 sightseeing の既存挙動維持

*For any* 中心座標について、`kind` が `food` / `cafe` / `custom` の出力には Fallback 候補が含まれず、`appliedRadiusMeters` は基準半径のままで、`food` / `cafe` の全候補は `category === "food"` を満たす。

**Validates: Requirements 6.4, 8.3, 8.4**

### Property 15: i18n 追加キーの言語網羅

*For any* 本機能で追加した `routeBuilder.*` キーについて、`UI_LABELS` に ja / en / iyo の非空文字列が存在する。

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 16: モック推薦の既存不変条件

*For any* `MOCK_RECOMMENDATIONS` の要素について、立寄先は 2 件以上 4 件以下であり、すべての立寄先が中心から 5,000m 以内にあり、`source` 属性を持たない。

**Validates: Requirements 8.1, 8.2, 8.3**

---

## Testing Strategy

Vitest + fast-check（既存例: `src/adapters/mock/spot.test.ts`）。プロパティテストは **最低 100 回試行**（fast-check 既定は 100 なので `fc.assert` 既定で足る）、各テストに `Feature: swipe-candidate-fallback-expansion, Property {n}: {要約}` をタグとして記述する。

### 追加テストファイル

| ファイル | 対象 | 種別 |
| --- | --- | --- |
| `src/domain/candidateFallback.test.ts` | Property 1〜10, 12 | プロパティ中心 |
| `src/data/fallbackPools.test.ts` | Property 7（データ側の非空・座標有限）、札所 40〜65 の網羅 | プロパティ（全数） |
| `src/adapters/mock/routeCandidates.test.ts` | Property 8, 13, 14, 16 | プロパティ |
| `src/i18n/routeBuilderLabels.test.ts`（既存ラベルテストがあれば追記） | Property 15 | 全数検査 |
| `src/ui/screens/TourismRouteBuilder.fallback.test.tsx` | Req 4.1〜4.4, 5.1, 5.2, 5.4, 5.5, 7.5 | 例示（RTL） |
| `api/route-candidates.test.ts`（Node 環境、Bedrock/Places をスタブ） | Req 3.5, 3.6, 1.6 | 例示 |

### ジェネレータ

```ts
/** 愛媛陸域に偏らせた中心座標。海上・県外も一定割合含めて枯渇ケースを踏む。 */
const ehimeCenterArb = fc.oneof(
  { weight: 8, arbitrary: fc.record({
      lat: fc.double({ min: 33.0, max: 34.3, noNaN: true }),
      lng: fc.double({ min: 132.4, max: 133.6, noNaN: true }),
    }) },
  { weight: 1, arbitrary: fc.constant({ lat: 24.3, lng: 124.1 }) }, // 遠方＝在庫ゼロ
);

const primaryArb = fc.array(candidateArb, { minLength: 0, maxLength: 10 });
const routeArb = fc.array(fc.oneof(fc.constantFrom(...knownPlaceIds), fc.string()), { maxLength: 6 });
```

### 例示・エッジケース

- Primary 0 件 / 1 件 / 5 件 / 9 件（上限クランプ）
- 既存ルートに札所・Spot が入っていて Fallback 候補が枯渇するケース
- `TEMPLE_DETAILS` 未収載番号の札所が選ばれるケース（既定説明文）
- 距離 999m / 1,000m / 1,050m の書式境界
- API: Places 全滅 → Fallback で 200、ローカルも 0 件 → 502

### 回帰テスト（既存不変条件の保護）

1. **推薦系の既存テストを一切変更せずに通す**こと（`api/recommendations.ts` と `mockRecommendation` は無変更なので、変更が漏れれば既存テストが落ちる）。
2. `mockRecommendation` の 2〜4 件・5km 検証は現行のランタイム `throw` を維持（Property 16 で全数検査も追加）。
3. `RouteCandidate.source` を optional にすることで既存フィクスチャを壊さない。ポート戻り値変更（`RouteCandidatesResult`）は型エラーとして検出されるため、`npm run typecheck` を変更完了の判定に使う。
4. `api/` は root `tsconfig.json` の対象外なので、`node node_modules/typescript/bin/tsc --noEmit -p api/tsconfig.json` を手元で追加実行して api 側の型崩れを確認する。
