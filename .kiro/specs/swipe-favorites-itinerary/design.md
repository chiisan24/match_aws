# Design Document

## Overview

3つの独立した変更を1つの機能としてまとめる。

1. **統合（追加）**: `RouteCandidate` → `Spot` の純粋変換を `src/domain/` に置き、Route_Builder のスワイプ判定と最終確定の2箇所からストアへ書き込む。
2. **永続化（追加）**: `favorites` を `Favorites_Storage_Key` で保存・復元する。既存 `shiori` の2 useEffect パターンをそのまま複製する。
3. **削除**: チャット系4ファイルと、供給元を失う4方向スワイプ系の状態・型・レイヤー・文言を撤去する。

実装言語は TypeScript（React 18.3 + Vite 5）。テストは vitest + fast-check + `@testing-library/react`。

新規ファイルは3つ（変換モジュール1 + テスト2）に留め、残りは既存ファイルの変更で行う。

---

## 設計判断

要件フェーズが design に委ねた3つの論点に結論を出す。

### 判断1: 到着予定時刻は Shiori_List に持ち込まない

**結論**: `Route_Builder` の `routeTimes: string[]` は破棄する。`Spot` 型に時刻フィールドを追加しない。`Shiori_List` は `Spot[]` のまま維持する。

**理由**:

- `Spot` は Google Places / OSM / ユーザー追加スポットのカタログ型で、`SpotPort.listSpots` / `addSpot`、`buildSpotFromInput`、`EHIME_SPOTS`、`api/spots.ts`（DynamoDB）が共有している。「到着予定時刻」はしおり項目固有の属性であってスポットの属性ではない。カタログ型に持ち込むと上記すべてに無意味な `undefined` フィールドが伝播する。
- 別配列（`shioriTimes: string[]`）案は、`reorderShiori` / `removeFromShiori` のたびに2配列のインデックス整合を保つ不変条件が増える。既存の `reorder<T>(items, from, to)` は単一配列を前提とした純粋関数で、これを2配列版に拡張すると Req 5.1（並べ替えで全要素を保持）の既存保証を作り直すことになる。要件の Introduction は「しおりは単一リストを維持し、既存の並べ替え・削除・共有・永続化をそのまま再利用する」と明示している。
- `Shiori_Storage_Key` の永続化フォーマットが `Spot[]` のまま変わらないので、既に保存済みのしおりを読み続けられる。

**AC 4.7 の扱い**: `WHERE しおり項目が到着予定時刻を保持する、THE Shiori_Editor SHALL 当該時刻を項目に表示する` — Optional feature パターンの前提が偽になるため本条は空虚に成立する。`ShioriEditor` は変更しない。

**追加の影響範囲（無変更であることの確認）**:

| 対象 | 変更 |
| --- | --- |
| `src/ui/screens/ShioriEditor.tsx` | なし。`<ol>` の項目描画・`SharePlan` 生成をそのまま維持 |
| `src/domain/share.ts` の `SharePlanItem` | なし（`{ id, name }` のみ） |
| `Shiori_Storage_Key` の JSON 形状 | なし（`Spot[]`） |
| `src/domain/reorder.ts` | なし |

時刻情報そのものは失われない。`Active_Plan`（`RecommendedPlan.stops[].time`）に残り、`TourismLayeredMap` は既に `activePlan.stops` から `planFeatures` を組んでいる。将来しおり画面に時刻が必要になった場合は、`Spot.id` = `RecommendedPlanStop.place.id` の対応で `activePlan` から引ける（型を変えずに追加できる）。

### 判断2: `complete()` から push する。`Route_Builder` は `useTourism()` を導入する

**結論**: `Route_Builder` の `complete()` が `RouteCandidate[]` を変換して `addSpotsToShiori` を呼ぶ。`activePlan` からの導出はしない。ストアへの書き込みは `useTourism()` 経由で行い、props にコールバックを増やさない。

**`activePlan` 導出を却下する理由**:

- `RecommendedPlanStop.place` は optional で、`RecommendedPlace.location` も optional。`activePlan.stops` から変換すると `place?.location` が `undefined` のケースを落とすか座標を捏造するしかなく、AC 1.4（`location` に `place.location` を設定する）を型で保証できない。`RouteCandidate.place` は `RecommendedPlace & { location: GeoPoint }` なので、`RouteCandidate` から直接変換すれば座標の存在が型で保証される。
- 導出は Req 5 と矛盾する。`activePlan` から毎レンダー導出すると、AC 5.2 でしおりから削除した項目が次のレンダーで復活し、AC 5.1 の並べ替え結果も上書きされる。単一の編集可能なリストを維持するには push でなければならない。
- AC 4.4（既存の Spot とその順序を保持したうえで新規を末尾に追加）は、しおりが `activePlan` の従属ではなく独立した state であることを要求している。

**`useTourism()` を選ぶ理由**:

- AC 2.1（Interest_Decision の瞬間にお気に入り追加）は `decide(true)` の内側で書き込む必要があり、`complete()` の `onComplete` では遅い。props 方式にすると `onFavorite` と `onShiori` の2つを `App.tsx` 経由で配線することになり、`App.tsx` が既に `useTourism()` で `selectPlan` を呼んでいる事実と併せて同じストアへの二重経路ができる。
- `Route_Builder` は既に `useI18n()` を使っており、コンテキスト依存はゼロではない。`TourismProvider` は `App.tsx` で `AppFlow` の上にマウントされているので実行時の前提は既に成立している。
- テスト容易性は変換ロジックの切り出しで確保する。AC 1.x（14条）の検証は純粋関数 `spotFromRouteCandidate` に対する fast-check テストで完結し、React を起動しない。`Route_Builder` のテストは元々 fake `ChatPort` を用意する必要があり、`TourismProvider` も同じ fake を受け取らなくなる（判断: `chat` prop を削除するため）ので、ラップのコストは `<TourismProvider>` の1行だけ増える。

**`complete()` の実行順序**: `addSpotsToShiori(spots)` → `onComplete(plan)`。`onComplete` が `setPhase("app")` で `Route_Builder` をアンマウントするため、書き込みを先に行う。

AC 4.9（確定ルートが空なら Shiori_List を変更しない）は自然に満たされる。`route.length === 0` のとき変換結果が空配列になり、後述の `appendUniqueById` が入力参照をそのまま返す。

### 判断3: `openingHours` は非空要素を `" / "` で連結する

**結論**:

```
regularOpeningHours の各要素を trim
→ 空文字になった要素を除去
→ " / " で join
→ 結果が空文字なら undefined
```

**理由**:

- 区切り `" / "` は既存の前例に合わせる。`TourismLayeredMap` の `SpotDetailPanel` が `feature.place?.regularOpeningHours?.join(" / ")` で同じ結合をしており、同じデータが同じ形で見える。
- 空要素の除去と空文字 → `undefined` の変換は、`Spot.openingHours` の既存の意味（`types.ts`: 「無ければ undefined」）と `buildSpotFromInput` の既存挙動（`input.openingHours?.trim() || undefined`）に揃える。`""` を格納すると `SpotDetailPanel` の `?? t("tlmap.detail.noInfo")` フォールバックが効かず空欄が表示される。
- `regularOpeningHours` が空配列、または全要素が空白のみの場合も `undefined` になる。AC 1.10 は `WHERE Route_Candidate が place.regularOpeningHours を持つ` を前提とするが、「持つが中身が無い」ケースで意味のない文字列を作らないほうが AC 1.10 の意図（当該営業時間の文字列表現）に忠実。

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ src/ui/screens/TourismRouteBuilder.tsx                  │
│  BinarySwipeDeck ─ decide(true) ──┐                     │
│  debugAutoAccept ─────────────────┤                     │
│  complete() ──────────────────────┤                     │
└───────────────────────────────────┼─────────────────────┘
                                    │ RouteCandidate
                    ┌───────────────▼─────────────────────┐
                    │ src/domain/routeCandidate.ts (new)  │
                    │  spotFromRouteCandidate(c, lang)    │
                    │  spotsFromRouteCandidates(cs, lang) │
                    │  appendUniqueById(coll, additions)  │
                    └───────────────┬─────────────────────┘
                                    │ Spot
┌───────────────────────────────────▼─────────────────────┐
│ src/app/TourismContext.tsx                              │
│  addFavorite(spot)          favorites: Spot[]  ─┐       │
│  addSpotsToShiori(spots)    shiori:    Spot[]  ─┤       │
│  ── useEffect × 2 per key ──────────────────────┼──────┐│
└─────────────────────────────────────────────────┼──────┼┘
                                                  │      │ StoragePort
        ┌─────────────────────┬───────────────────┘      │ "favorites"
        ▼                     ▼                   ▼      │ "shiori"
  ShioriEditor         FavoritesView      TourismLayeredMap
                                          └ buildTourismLayerFeatures
```

変換は純粋関数として `src/domain/` に置き、ストアは `Spot` しか知らない。`RouteCandidate` は `src/ui/screens/TourismRouteBuilder.tsx` と `src/domain/routeCandidate.ts` の外に漏れない。

---

## Components and Interfaces

### 新規: `src/domain/routeCandidate.ts`

`src/domain/` の慣例に合わせてコメントは英語で書く。`src/domain/spot.ts`（`NewSpotInput` → `Spot`、ユーザー入力の変換）とは関心が異なるので別モジュールにする。

```ts
/**
 * Pure conversion from interactive route-builder candidates to catalogue spots.
 *
 * `spotFromRouteCandidate` is the single rule that decides how a Google-verified
 * `RouteCandidate` becomes a `Spot` (Req 1). It takes the display language as an
 * argument so the description lands under the language the user is actually
 * looking at (Req 1.6) — the function itself stays free of i18n state.
 *
 * `appendUniqueById` is the shared merge used when route results flow into the
 * favorites / shiori collections: it preserves the existing prefix and order and
 * skips ids already present (Req 4.2-4.4), returning the input reference when
 * nothing is added so callers can skip a state update.
 */

import type { LangCode, RouteCandidate, RouteCandidateKind, Spot } from "./types";

/** Separator used when folding `regularOpeningHours` into one string. */
const OPENING_HOURS_SEPARATOR = " / ";

/**
 * Candidate kind -> spot category (Req 1.5). `cafe` is a place to eat, so it
 * shares the `food` category; a free-text `custom` request is treated as
 * sightseeing. `souvenir` / `onsen` are never produced — no candidate kind maps
 * to them.
 */
const CATEGORY_BY_KIND: Record<RouteCandidateKind, Spot["category"]> = {
  sightseeing: "sightseeing",
  food: "food",
  cafe: "food",
  custom: "sightseeing",
};

/**
 * Fold Google's `regularOpeningHours` lines into the single string `Spot` holds
 * (Req 1.10). Blank lines are dropped; a set with nothing usable yields
 * `undefined` so the UI falls back to its "no info" copy rather than an empty
 * field.
 */
function joinOpeningHours(lines: readonly string[] | undefined): string | undefined {
  if (!lines) return undefined;
  const kept = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  return kept.length > 0 ? kept.join(OPENING_HOURS_SEPARATOR) : undefined;
}

/**
 * Convert one candidate into one spot (Req 1.1-1.12). Pure and total: the input
 * is never mutated, `location` is copied rather than shared, and the same
 * candidate always yields a structurally equal spot (Req 1.13).
 */
export function spotFromRouteCandidate(
  candidate: RouteCandidate,
  lang: LangCode,
): Spot {
  const { place } = candidate;
  const openingHours = joinOpeningHours(place.regularOpeningHours);
  return {
    id: place.id,
    name: candidate.title,
    category: CATEGORY_BY_KIND[candidate.kind],
    location: { lat: place.location.lat, lng: place.location.lng },
    localizedDescriptions: { [lang]: candidate.description },
    reviews: [],
    imageUrls: place.photoUrl ? [place.photoUrl] : [],
    ...(openingHours ? { openingHours } : {}),
    ...(place.websiteUri ? { website: place.websiteUri } : {}),
  };
}

/** Convert a confirmed route, preserving its order (Req 4.2). */
export function spotsFromRouteCandidates(
  candidates: readonly RouteCandidate[],
  lang: LangCode,
): Spot[] {
  return candidates.map((candidate) => spotFromRouteCandidate(candidate, lang));
}

/**
 * Append `additions` to `collection`, skipping any id already present
 * (Req 2.3, 4.3) and keeping both the existing prefix and the addition order
 * (Req 4.2, 4.4). Returns `collection` itself when nothing new is added, so an
 * empty route is a no-op (Req 4.9) and React can skip a re-render.
 */
export function appendUniqueById(
  collection: Spot[],
  additions: readonly Spot[],
): Spot[] {
  const seen = new Set(collection.map((spot) => spot.id));
  const fresh: Spot[] = [];
  for (const spot of additions) {
    if (seen.has(spot.id)) continue;
    seen.add(spot.id);
    fresh.push(spot);
  }
  return fresh.length === 0 ? collection : [...collection, ...fresh];
}
```

`collection` を `readonly Spot[]` ではなく `Spot[]` にするのは、「新規が0件なら入力参照そのものを返す」という契約（Property 5）を型変換なしで表すため。呼び出し元はいずれも `Spot[]` の state 配列を渡す。関数内で `collection` を変更しないことはコメントで示す。

`popularityRank` はオブジェクトリテラルに現れないので未設定（AC 1.12）。`openingHours` / `website` はスプレッドで条件付き付与し、`exactOptionalPropertyTypes` 相当の厳格さでも `undefined` を明示的に格納しない。

`src/domain/index.ts` に再エクスポートを追加する（`./swipe` のブロックを削除した位置）。

```ts
// Route-builder candidate -> spot conversion and collection merge (Req 1, 4).
export {
  spotFromRouteCandidate,
  spotsFromRouteCandidates,
  appendUniqueById,
} from "./routeCandidate";
```

### 変更: `src/app/TourismContext.tsx`

**削除するメンバー**（AC 6.8, 7.4）

`TourismContextValue` から: `session` / `messages` / `chatStatus` / `chatError` / `isSending` / `hasError` / `sendMessage` / `retry` / `swipeCandidates` / `hasCandidates` / `swipeHistory` / `recordSwipe` / `clearCandidates` / `later` / `addToLater`

`TourismState` から: `session` / `chatStatus` / `chatError` / `swipeCandidates` / `swipeHistory` / `later`

その他: `ChatStatus` 型、`newSessionId()`、`runRequest`、`lastRequest` ref、`session.lang` 同期の `useEffect`、`chat` prop、`lang` prop、`buildSuggestionPayload` / `SwipeRecord` の import、`ChatMessage` / `ChatSession` / `ChatPort` / `LangCode` の import。`createInitialState(lang)` は引数を落として `createInitialState()` にする（`LangCode` を必要としていたのは `session` と `lang` prop だけ）。

`chat` と `lang` が props から消えるので `TourismProviderProps` は `{ storage?: StoragePort; children: ReactNode }` になる。`lang` は `session.lang` のためだけに存在していた。表示言語は変換時に `Route_Builder` 側の `useI18n().lang` から渡す。

`classifyFavoriteTabs` / `FavoritePlan` / `FavoriteEntry` / `FavoriteTabKind` / `FavoriteTabClassification` は `FavoritesView` が使うので残す。

**追加するメンバー**

```ts
/**
 * Add every spot in `spots` to the しおり in one update, skipping ids already
 * present (Req 4.1-4.4). Used by the route builder when the user starts the
 * trip; an empty list is a no-op (Req 4.9).
 */
addSpotsToShiori: (spots: Spot[]) => void;
```

**`favorites` の永続化**（Req 3）

`shiori` と同じ形を2組並べる。ハイドレーション ref を別に持ち、`useEffect` も独立させることで AC 3.8（一方の失敗が他方を妨げない）が構造で成立する。

```ts
/** Storage key the しおり is persisted under (Req 6.4). */
const SHIORI_KEY: StorageKey = "shiori";
/** Storage key お気に入り is persisted under (Req 3.1, 3.2). */
const FAVORITES_KEY: StorageKey = "favorites";
```

```ts
// Guards saving until after the initial rehydration so a slow load never
// clobbers persisted お気に入り with the empty initial value (Req 3.3).
const favoritesHydratedRef = useRef(false);

// Rehydrate お気に入り (key "favorites") once on mount. Resilient: a throw or a
// non-array value leaves the in-memory list in place (Req 3.4).
useEffect(() => {
  if (!storage) {
    // No StoragePort injected — お気に入り stays in memory only (Req 3.6).
    favoritesHydratedRef.current = true;
    return;
  }
  let cancelled = false;
  void (async () => {
    try {
      const saved = await storage.load<Spot[]>(FAVORITES_KEY);
      if (!cancelled && Array.isArray(saved)) {
        setState((s) => ({ ...s, favorites: saved }));
      }
    } catch {
      // Ignore — keep the in-memory お気に入り.
    }
    if (!cancelled) favoritesHydratedRef.current = true;
  })();
  return () => {
    cancelled = true;
  };
}, [storage]);

// Persist お気に入り under "favorites" whenever it changes (after hydration).
// Independent of the しおり effect, so a failure on one key never blocks the
// other (Req 3.8). A failed save is swallowed and the in-memory list stays
// authoritative (Req 3.5).
useEffect(() => {
  if (!storage || !favoritesHydratedRef.current) return;
  void storage.save<Spot[]>(FAVORITES_KEY, state.favorites).catch(() => {
    // Persistence failed — in-memory お気に入り remains authoritative.
  });
}, [storage, state.favorites]);
```

既存 `shiori` 側の `shioriHydratedRef` と「失敗を握り潰す」方針をそのまま踏襲する。AC 3.7（同順序）は `MockStorageAdapter` の JSON 往復が配列順序を保つことで満たされる。

**`addToCollection` の再実装**

`appendUniqueById` を共有し、`later` を対象から外す。「既存なら同一 state 参照を返す」既存挙動を維持する。

```ts
// Add a spot to one of the route-driven collections, de-duplicated by id so
// re-deciding the same place never creates duplicate entries. Returns the same
// state reference when the spot is already present (cheap no-op).
const addToCollection = useCallback(
  (key: "favorites" | "shiori", spot: Spot): void => {
    setState((s) => {
      const next = appendUniqueById(s[key], [spot]);
      return next === s[key] ? s : { ...s, [key]: next };
    });
  },
  [],
);

const addSpotsToShiori = useCallback((spots: Spot[]): void => {
  setState((s) => {
    const next = appendUniqueById(s.shiori, spots);
    return next === s.shiori ? s : { ...s, shiori: next };
  });
}, []);
```

`addFavorite` / `addToShiori` / `removeFavorite` / `removeFromShiori` / `reorderShiori` / `selectPlan` は無変更。

### 変更: `src/ui/screens/TourismRouteBuilder.tsx`

```ts
import { useTourism } from "../../app/TourismContext";
import {
  spotFromRouteCandidate,
  spotsFromRouteCandidates,
} from "../../domain/routeCandidate";
```

`appendUniqueById` は `TourismContext` 側だけが使うので、この画面は import しない。

```ts
export function TourismRouteBuilder({ chat, theme, onBack, onComplete }: TourismRouteBuilderProps): JSX.Element {
  const { t, lang } = useI18n();
  const { addFavorite, addSpotsToShiori } = useTourism();
  // ...
```

**`decide`**（AC 2.1, 2.2, 2.4）

```ts
const decide = useCallback((interested: boolean): void => {
  const candidate = candidates[index];
  if (!candidate) return;
  if (interested) {
    // 「興味あり」はその場でお気に入りへ (Req 2.1)。ルート挿入は従来どおり
    // 維持する (Req 2.2)。ルートから外してもお気に入りは残る (Req 2.5)。
    addFavorite(spotFromRouteCandidate(candidate, lang));
    setRoute((current) => current.some((item) => item.place.id === candidate.place.id)
      ? current
      : insertAlongRoute(current, candidate));
    setRejected((current) => current.filter((item) => item.id !== candidate.id));
  } else {
    // 「興味なし」はお気に入りに触れない (Req 2.4)。
    setRoute((current) => current.filter((item) => item.id !== candidate.id));
    setRejected((current) => current.some((item) => item.id === candidate.id)
      ? current
      : [...current, candidate]);
  }
  setIndex((current) => current + 1);
}, [addFavorite, candidates, index, lang]);
```

**`debugAutoAccept`**（AC 2.8）— 採用した各候補にも `addFavorite` を通す。

```ts
const debugAutoAccept = useCallback((count: number): RouteCandidate[] => {
  let next = route;
  for (const candidate of candidates.slice(index, index + count)) {
    if (!next.some((item) => item.place.id === candidate.place.id)) {
      // 一括追加も通常のスワイプと同じくお気に入りへ入れる (Req 2.8)。
      addFavorite(spotFromRouteCandidate(candidate, lang));
      next = insertAlongRoute(next, candidate);
    }
  }
  setRoute(next);
  setIndex(candidates.length);
  return next;
}, [addFavorite, candidates, index, lang, route]);
```

**`complete`**（AC 4.1, 4.2, 4.9）— しおりへ書いてから `onComplete`。

```ts
const complete = (): void => {
  if (!area) return;
  const times = routeTimes.length === route.length
    ? routeTimes
    : fallbackRouteTimes(route.length);
  // 確定ルートをしおりへ流し込む (Req 4.1, 4.2)。到着予定時刻は Spot が持た
  // ないため引き継がない。時刻は下の Active_Plan (stops[].time) に残る。
  // onComplete はこの画面をアンマウントするので、書き込みを先に行う。
  addSpotsToShiori(spotsFromRouteCandidates(route, lang));
  onComplete({
    ...theme,
    mode: "tourism",
    area,
    // ... 既存のまま
  });
};
```

`routeTimes` / `RoutePreview` の時刻表示・`route-builder-editor__time` は Route_Builder 内の表示として維持する（判断1で破棄するのは「しおりへの引き継ぎ」のみ）。

`removeFromRoute` は `favorites` を触らない（AC 2.5）— 現状のまま無変更。

### 変更: `src/app/App.tsx`

`TourismProvider` から `chat` / `lang` が消えるので `LocalizedTourismProvider` ラッパーが不要になる。

```tsx
<SpotProvider spots={gateway.spots}>
  <TourismProvider storage={gateway.storage}>
    <main className="app-shell">
      <AppFlow map={gateway.map} chat={gateway.chat} />
    </main>
  </TourismProvider>
</SpotProvider>
```

`LocalizedTourismProvider` 関数と `useI18n` / `StoragePort` / `ReactNode` の import を削除する。**`ChatPort` の import は残す** — `AppFlowProps.chat: ChatPort` が使っている。`AppFlow` の `chat` は `AIPlanFirst`（`generateRecommendedPlans`）と `TourismRouteBuilder`（`generateRouteCandidates` / `generateTourismRoutePlan`）が使うので残す。`I18nProvider` / `ModeProvider` / `ImageProvider` / `SpotProvider` の入れ子と `phase` 遷移は無変更（AC 6.12）。

---

## Data Models

`src/domain/types.ts` の変更のみ。新しい型は追加しない。

**削除**（AC 6.9, 7.6, 7.8）

```ts
// ---------------------------------------------------------------------------
// Chat (AI 旅行相談 / プラン生成)   ← セクションごと削除
// ---------------------------------------------------------------------------
export interface ChatMessage { ... }
export interface ChatSession { ... }
export interface SwipePreferences { ... }
export interface ChatReply { ... }
```

`LayerKind` から `later` を除去し、コメントも更新する。

```ts
  // ルート結果連動のユーザーレイヤー（お気に入り / しおり）
  | "favorite"
  | "shiori";
```

`StorageKey` は `"favorites"` を既に含む（無変更）。`Spot` / `RouteCandidate` / `RecommendedPlace` / `RouteCandidateKind` も無変更。

---

## 削除対象と参照連鎖

### 削除するファイル（4件）

| ファイル | 根拠 |
| --- | --- |
| `src/ui/screens/ChatAdvisor.tsx` | AC 6.1 |
| `src/ui/screens/SwipeDeck.tsx` | AC 7.1 |
| `src/domain/swipe.ts` | AC 7.5 |
| `api/chat.ts` | AC 6.7 |

`src/domain/swipe.ts`（`classifySwipe` / `generateRecommendations` / `recommendSimilarSpots` / `buildSuggestionPayload`）の参照元は `SwipeDeck.tsx` / `TourismContext.tsx` / `domain/index.ts` のみ。テストからの参照はゼロなので、削除しても既存テストは壊れない。

### 変更するファイル（参照の連鎖）

| ファイル | 変更内容 | AC |
| --- | --- | --- |
| `src/ui/screens/index.ts` | `ChatAdvisor` / `ChatAdvisorProps` / `SwipeDeck` / `SwipeDeckProps` の再エクスポート4行を削除 | 6.1, 7.1 |
| `src/ui/screens/tourismTabs.tsx` | `ChatAdvisor` / `SwipeDeck` の import と `chat` / `swipe` エントリを削除。`TOURISM_TAB_CONTENT` の型を `Partial<Record<TourismTab, TourismTabRenderer>>` → `Record<TourismTab, TourismTabRenderer>` に変更。`TourismTabContext.goToTab` は利用者が消えるので削除し、`map` のみを渡す | 6.1, 7.1, 7.11 |
| `src/app/modeManager.ts` | `TOURISM_TABS = ["map", "favorites", "shiori"] as const`。`DEFAULT_TAB.tourism = TOURISM_TABS[0]` は式を変えずに `"map"` を返す。JSDoc の「チャット / スワイプ / お気に入り / しおり」を「マップ / お気に入り / しおり」に更新 | 6.2, 7.2, 7.3 |
| `src/app/modeManager.test.ts` | `expect(s.tabByMode.tourism).toBe("chat")` → `"map"`、`expect(activeTab(s)).toBe("chat")` → `"map"`。`TOURISM_TABS` の内容を検証する1件を追加 | 8.3, 6.2, 7.2 |
| `src/ui/screens/ModeShell.tsx` | `TOURISM_TAB_META` を3件に縮小し添字を `TOURISM_TABS[0]`〜`[2]` に振り直す。全タブに renderer が登録される（AC 7.11）ため `PlaceholderPanel` / `PlaceholderPanelProps` / `TabMeta.panelKey` / `TabMeta.motif` と `PlaceholderImage` / `SectionHeader` の import を削除 | 6.3, 7.12 |
| `src/app/TourismContext.tsx` | 上述（チャット・スワイプ状態の撤去 + `favorites` 永続化 + `addSpotsToShiori`） | 6.8, 7.4, 3.x, 4.x |
| `src/app/App.tsx` | `LocalizedTourismProvider` 削除、`TourismProvider storage={...}` 直結 | 6.12 |
| `src/ports/index.ts` | `ChatPort.sendMessage` 宣言を削除。`ChatReply` / `ChatSession` の import を削除。`Plan_Methods` 5件のシグネチャは1文字も変えない | 6.4, 6.5 |
| `src/domain/types.ts` | 上述（Chat セクション削除 + `LayerKind` の `later` 削除） | 6.9, 7.6, 7.8 |
| `src/domain/index.ts` | `./swipe` の `export` ブロック2つを削除し、`./routeCandidate` の再エクスポートを追加 | 7.5 |
| `src/adapters/mock/chat.ts` | `sendMessage` メソッドを削除。専用ヘルパー `FRIENDLY_OPENERS` / `DISCOVERY_REPLY` / `FOLLOWUP_REPLY` / `DISCOVERY_HINTS` / `pick` / `looksLikeDiscovery` / `orderCandidates` と `Spot` / `ChatReply` / `ChatSession` の import を削除。`forLang` は `NAV_NOTE` / `PLAN_LABELS` が使うので残す。`EHIME_SPOTS` は `mockRouteCandidates` が使うので残す | 6.6 |
| `src/adapters/aws/chat.ts` | `sendMessage` メソッドと `ChatApiResponse` interface を削除。`ChatReply` / `ChatSession` / `Spot` / `EHIME_SPOTS` の import を削除。`chatErrorMessage` は他4メソッドが使うので残す | 6.6 |
| `scripts/vite-api-plugin.ts` | `ROUTES` から `"/api/chat"` の1行を削除 | 6.7 |
| `src/i18n/labels.ts` | `chat.*` 全キー、`nav.tourism.chat` / `nav.tourism.swipe`、`panel.tourism.chat.title` / `panel.tourism.swipe.title`、`tlmap.layer.later`、`swipe.*` 全キーを削除。後述のキー改称と、`shiori.lead` / `shiori.empty.lead` の文面差し替えを行う | 6.10, 7.10 |
| `src/ui/screens/VisitTrackerScroll.tsx` | 冒頭 JSDoc の `{@link SwipeDeck}` と `TemplePhoto` の JSDoc「Mirrors the 通常観光モード SwipeDeck's SpotPhoto」を書き替える（コメントのみ） | 7.1 |
| `src/ui/screens/NokyochoView.tsx` | `useEffect` 上のコメント「Mirrors the 通常観光モード SwipeDeck, ...」を書き替える（コメントのみ） | 7.1 |
| `src/ui/styles/screens.css` | `.chat` 系の規則ブロックを削除（`.chat`, `.chat__header`, `.chat__title`, `.chat__lead`, `.chat__transcript`, `.chat__bubble*`, `.chat__avatar`, `.chat__text`, `.chat__handoff*`, `.chat__error*`, `.chat__compose`, `.chat__input*`） | 6.11 |
| `src/adapters/mock/tourismLayers.ts` | `TourismCollections` から `later` を削除。`collectionToFeatures(collections.later, "later", "later")` の行と JSDoc の「後で見る」記述を削除 | 7.7 |
| `src/ui/screens/TourismLayeredMap.tsx` | `USER_LAYERS` から `{ key: "later", ... }` を削除。`useTourism()` の分割代入から `later` を削除。`buildTourismLayerFeatures(spots, { favorites, shiori })` に変更。`PURPOSE_PRESETS` / `DEFAULT_ACTIVE` に `later` は含まれないので無変更 | 7.9 |
| `src/ui/screens/FavoritesView.tsx` | `t(\`swipe.category.${...}\`)` 3箇所と `t("swipe.reviewCount")` 1箇所を改称後のキーへ更新 | 7.10 |

### 文言キーの改称（見落としやすい箇所）

AC 7.10 は接頭辞 `swipe.` のキーを禁じるが、`swipe.category.*` と `swipe.reviewCount` は `SwipeDeck` だけでなく **`FavoritesView` が参照している**。単純削除では画面にキー文字列がそのまま出る（`resolveLabel` は未知キーでキー自身を返すため、型検査もテストも失敗しない）。改称して参照を追う。

| 旧キー | 新キー | 参照元 |
| --- | --- | --- |
| `swipe.category.sightseeing` / `.food` / `.souvenir` / `.onsen` | `spot.category.sightseeing` / `.food` / `.souvenir` / `.onsen` | `FavoritesView.tsx` × 3箇所 |
| `swipe.reviewCount` | `spot.reviewCount` | `FavoritesView.tsx` × 1箇所 |

残る `swipe.*`（`swipe.title` / `.lead` / `.progress` / `.cardRole` / `.controls` / `.hint` / `.action.*` / `.aria.*` / `.rank` / `.noReviews` / `.recommend.*` / `.done.*` / `.restart` / `.backToChat`）は `SwipeDeck` 専用なので削除する。`spot.category.*` / `spot.reviewCount` は既存キーと衝突しない（`labels.ts` に `spot.` 接頭辞のキーは1件も無い）。

### 4方向スワイプを案内している文言（キー名では見つからない箇所）

キー名に `swipe.` を含まないため AC 7.10 の grep では引っかからないが、**文面が削除する操作を説明している**キーが2件ある。単純に放置すると、存在しない「上スワイプ」を利用者に指示し続けることになる。

| キー | 現在の文面（ja） | 対応 |
| --- | --- | --- |
| `shiori.lead` | 「スワイプで上にした行きたい場所が並びます。順番を入れ替えて、当日の行程を整えましょう。」 | しおりへの流入経路が Final_Stage の「このルートで旅を始める」だけになるので、その旨に差し替える（ja / en / iyo） |
| `shiori.empty.lead` | 「スワイプ画面で気になる場所を上にスワイプすると、ここに追加されます。」 | 同上 |

`fav.empty.lead`（「スワイプで気になるスポットを右にすると、ここに集まります。」）は**変更しない**。Route_Builder の右スワイプ＝ Interest_Decision が本機能でそのままお気に入り登録になるので、この文面は事実と一致するようになる。

### CSS の扱い

`.swipe*` の規則は削除しない。`VisitTrackerScroll`（お遍路マッチ）が `.swipe__done`, `.swipe__done-actions`, `.swipe__stage`, `.swipe-card`, `.swipe-card--peek`, `.swipe-card--lean-{left,right}`, `.swipe-card__badge`, `.swipe-card__badge--{left,right}`, `.swipe-card__photo-wrap`, `.swipe-card__photo`, `.swipe-card__body`, `.swipe-card__name`, `.swipe-card__desc` を共有している。AC 6.11 が禁じるのは「チャットUI専用のスタイル規則」だけで、スワイプ系 CSS の削除を求める AC は無い。`SwipeDeck` 専用の規則（`.swipe__controls`, `.swipe__btn*`, `.swipe__recommend*`, `.swipe-card__rank`, `.swipe-card__reviews*` など）は死コードとして残るが、本要件の範囲外として触らない。

---

## Error Handling

| 事象 | 挙動 | AC |
| --- | --- | --- |
| `storage.load("favorites")` が throw | `catch` で握り潰し、メモリ上の `favorites` を維持。ハイドレーション ref は `true` にして以降の保存を許可 | 3.4 |
| `storage.load("favorites")` が配列以外を返す | `Array.isArray(saved)` が偽なので `setState` を呼ばない | 3.4 |
| `storage.save("favorites")` が reject | `.catch(() => {})` で握り潰す。`favorites` state はそのまま。画面は操作可能なまま | 3.5 |
| `storage` prop 未注入 | 両方の `useEffect` が早期 return し、コレクションはメモリのみ | 3.6 |
| `favorites` の保存が失敗し `shiori` は成功 | `useEffect` が独立しているため互いに影響しない | 3.8 |
| 確定ルートが空で `complete()` | `appendUniqueById(shiori, [])` が入力参照を返し `setState` が同一参照を返すので再描画も起きない | 4.9 |
| `regularOpeningHours` が空配列 / 空白のみ | `joinOpeningHours` が `undefined` を返し `openingHours` を付与しない | 1.10 |
| `photoUrl` / `websiteUri` 不在 | `imageUrls: []` / `website` 未設定。`ShioriEditor` / `FavoritesView` の `SpotThumb` がプレースホルダーへ退避 | 1.9, 5.6 |

`Route_Builder` の既存のエラー処理（候補取得失敗の `status === "error"`、最終プラン生成失敗の `planStatus === "error"`）は無変更。プラン生成が失敗しても `route` は残るので `complete()` はしおりへ書ける。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 変換は必須フィールドを一意に決める

*For any* `RouteCandidate` と *any* `LangCode` について、`spotFromRouteCandidate` が返す `Spot` は `id` が候補の `place.id` に等しく、`name` が `title` に等しく、`location` が `place.location` と構造的に等価であり、`category` が `kind` の固定対応表（`sightseeing`→`sightseeing`、`food`→`food`、`cafe`→`food`、`custom`→`sightseeing`）の値に等しく、`localizedDescriptions` の当該言語キーが `description` に等しく、`reviews` が空配列であり、`popularityRank` が未設定である。

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.12, 1.14**

### Property 2: 任意フィールドの有無が入力の有無に一致する

*For any* `RouteCandidate` について、`place.photoUrl` があるとき `imageUrls` は当該URLのみを要素とする配列であり、無いとき空配列である。`place.websiteUri` があるとき `website` は当該URLに等しく、無いとき未設定である。`place.regularOpeningHours` の非空要素が1件以上あるとき `openingHours` は非空文字列であって全非空要素を部分文字列として含み、非空要素が0件のとき未設定である。

**Validates: Requirements 1.8, 1.9, 1.10, 1.11**

### Property 3: 変換は決定的で入力を変更しない

*For any* `RouteCandidate` と *any* `LangCode` について、同じ入力で2回変換した結果は構造的に等価であり、変換後の入力は変換前のクローンと構造的に等価であり、返された `Spot` の `location` は入力の `place.location` と同一の参照ではない。

**Validates: Requirements 1.13**

### Property 4: 追記は既存の接頭辞と追加順序を保つ

*For any* `Spot` のコレクションと *any* 追加リストについて、`appendUniqueById` の結果は元のコレクションを接頭辞として持ち、その後に続く要素は追加リストのうち新規なもののみを追加リストと同じ順序で並べたものに等しい。

**Validates: Requirements 4.2, 4.4**

### Property 5: 追記は id で冪等である

*For any* `Spot` のコレクションと *any* 追加リストについて、`appendUniqueById` を2回適用した結果は1回適用した結果に等しく、追加リストの全要素の `id` が既にコレクションに存在するとき（空の追加リストを含む）結果はコレクションと同一の参照である。

**Validates: Requirements 2.3, 4.3, 4.9**

### Property 6: 永続化は往復で内容と順序を保つ

*For any* `Spot` のリストと *any* `StorageKey`（`"favorites"` / `"shiori"`）について、`StoragePort` で保存してから読み込むと、構造的に等価なリストが保存時と同一の順序で得られる。

**Validates: Requirements 3.1, 3.2, 3.7, 4.6**

### Property 7: 永続化の失敗はメモリ上のリストを壊さない

*For any* 「`load` が例外を投げるか配列以外の任意の値を返す」あるいは「`save` が拒否する」`StoragePort` の実装について、`TourismProvider` のマウント後および追加操作後の `favorites` は、アプリがメモリ上で構築した内容と等価である。片方のキーだけが失敗する場合、他方のキーの保存は成立する。

**Validates: Requirements 3.4, 3.5, 3.8**

### Property 8: レイヤー生成はコレクションの座標にピンを置く

*For any* お気に入りリストと *any* しおりリストについて、`buildTourismLayerFeatures` の結果に含まれる `favorite` レイヤーのフィーチャはお気に入りと1対1に対応して各 `location` と `spotId` が一致し、`shiori` レイヤーのフィーチャはしおりと1対1に対応して同様に一致し、`later` レイヤーのフィーチャは1件も存在しない。

**Validates: Requirements 5.4, 5.5, 7.7**

---

## Testing Strategy

### 新規テストファイル（2件）

既存の `src/adapters/mock/spot.test.ts` の書き方（`fc.record` で Arbitrary を組み、`fc.assert(fc.property(...))` で回す）に合わせる。

#### `src/domain/routeCandidate.test.ts` — AC 8.4, 8.7（純粋層）

fast-check のみ。React も DOM も使わない。

```ts
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  appendUniqueById,
  spotFromRouteCandidate,
  spotsFromRouteCandidates,
} from "./routeCandidate";
import type { RouteCandidate, RouteCandidateKind, Spot } from "./types";

const KINDS: RouteCandidateKind[] = ["sightseeing", "food", "cafe", "custom"];
const LANGS = ["ja", "en", "ko", "iyo"] as const;

const candidateArb: fc.Arbitrary<RouteCandidate> = fc.record({
  id: fc.string({ minLength: 1 }),
  kind: fc.constantFrom(...KINDS),
  title: fc.string(),
  description: fc.string(),
  searchQuery: fc.string(),
  place: fc.record({
    id: fc.string({ minLength: 1 }).map((s) => `place-${s}`),
    name: fc.string(),
    formattedAddress: fc.string(),
    location: fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    }),
    // 有無の両分岐を1つのプロパティで覆う。
    photoUrl: fc.option(fc.webUrl(), { nil: undefined }),
    websiteUri: fc.option(fc.webUrl(), { nil: undefined }),
    regularOpeningHours: fc.option(fc.array(fc.string()), { nil: undefined }),
  }),
});
```

| テスト | 検証内容 | Property |
| --- | --- | --- |
| `spotFromRouteCandidate` は必須フィールドを固定規則で写す | `id` / `name` / `location` / `category` / `localizedDescriptions[lang]` / `reviews` / `popularityRank` | Property 1 |
| `spotFromRouteCandidate` は任意フィールドの有無を入力に一致させる | `imageUrls` / `website` / `openingHours` の3分岐 | Property 2 |
| `spotFromRouteCandidate` は決定的で入力を変更しない | 2回変換の等価性、入力クローンとの等価性、`location` の参照分離 | Property 3 |
| `appendUniqueById` は接頭辞と追加順序を保つ | 結果の先頭が元コレクション、続きが新規のみ | Property 4 |
| `appendUniqueById` は id で冪等である | 2回適用 = 1回適用、全既存なら同一参照、空追加なら同一参照 | Property 5 |
| `spotsFromRouteCandidates` はルート順を保つ | 結果の `id` 列が入力の `place.id` 列に一致 | Property 1, 4 |

`openingHours` の検証は「非空要素が1件以上 → 結果が非空かつ全非空要素を含む／0件 → `undefined`」という形にし、区切り文字そのものを固定値でアサートするのは1件の例ベーステスト（`["月: 9:00–17:00", "火: 定休"]` → `"月: 9:00–17:00 / 火: 定休"`）に分ける。

#### `src/app/TourismContext.test.tsx` — AC 8.6

`MockStorageAdapter` と fake `StoragePort` を使う。`@testing-library/react` の `render` でプローブコンポーネントをマウントし、`act` で `addFavorite` を叩く。

| テスト | 検証内容 | Property / AC |
| --- | --- | --- |
| `favorites` を `MockStorageAdapter` に保存して読み戻すと同順序で等価 | `fc.array(spotArb)` を `save("favorites")` → `load("favorites")` | Property 6 |
| `shiori` も同じ往復で等価 | 同じプロパティを `StorageKey` で媒介変数化 | Property 6 |
| 保存済み `favorites` がマウント時に復元される | `MockStorageAdapter` に事前 `save` → `TourismProvider` マウント → 画面に反映 | AC 3.2 |
| `load` が任意の非配列値を返す／throw してもメモリを保つ | `fc.anything()` を返す fake storage、および throw する fake | Property 7 |
| `save` が reject しても `favorites` は追加内容を保つ | reject する fake storage で `addFavorite` | Property 7 |
| `favorites` の save だけ reject しても `shiori` は保存される | キー別に成否を分ける fake storage | Property 7 / AC 3.8 |
| `storage` 未注入でも `addFavorite` が機能する | props から `storage` を省略 | AC 3.6 |
| ハイドレーション完了前は保存しない | `load` を手動解決する Promise にし、解決前の `save` 呼び出しが0件 | AC 3.3 |
| `addSpotsToShiori` が空配列で state を変えない | 呼び出し前後の `shiori` が同一参照 | AC 4.9 |

Property 6 / 7 は `MockStorageAdapter` または軽量な fake に対して回すので100回でも安価。マウントを伴うケースは代表例1〜2件に留める。

#### `src/ui/screens/TourismRouteBuilder.test.tsx` — AC 8.5, 8.7（配線）

例ベース。fake `ChatPort`（`generateRouteCandidates` が固定候補2件、`generateTourismRoutePlan` が固定順序を返す）を用意し、`I18nProvider` + `TourismProvider` + `TourismRouteBuilder` をレンダリングする。favorites / shiori の中身はプローブコンポーネントを同じ Provider 配下に置いて読み出す。

「見送り→復活」経路では AC 2.3 を検証できない。`restoreCandidate` はルートへ挿入して `openFinal` を呼ぶだけでデッキへ戻らず、`decide` は `index` を単調に進めるので、同一候補に対する2回目の Interest_Decision は起きない。重複が実際に発生しうるのはステージをまたいで同じ `place.id` が現れる場合だけで、そこは `route` 側が `place.id` で弾いても `addFavorite` は毎回呼ばれるため、ストアの `appendUniqueById` が最後の防波堤になる。

| テスト | 検証内容 | AC |
| --- | --- | --- |
| ♥ボタン押下で候補が `favorites` に入る | `favorites` に `place.id` が現れ、`name` / `category` が変換規則どおり | 2.1 |
| ♥ボタン押下でルートにも挿入される | ルートプレビューに当該候補が現れる | 2.2 |
| ✕ボタン押下で `favorites` が変わらない | 押下後の `favorites` が空 | 2.4 |
| 同一 `place.id` を2ステージで「興味あり」にしても `favorites` は1件 | fake `ChatPort` が観光と食事のデッキに `candidate.id` は別・`place.id` は同じ候補を返す | 2.3 |
| ルートから✕削除しても `favorites` に残る | ♥ → 最終画面で削除 → `favorites` に残存 | 2.5 |
| 「このルートで旅を始める」で `shiori` にルート順で入る | `shiori` の `id` 列がルート順に一致 | 4.1, 4.2 |
| 既存のしおりがある状態で開始すると既存が保持され末尾に追加される | 事前に `addToShiori` した1件が先頭に残る | 4.4 |
| `onComplete` が呼ばれ `activePlan` 更新が走る | `onComplete` のモックが `stops` 付きプランで呼ばれる | 4.10 |

#### 既存テストの更新

`src/app/modeManager.test.ts`（AC 8.3）:

- `expect(s.tabByMode.tourism).toBe("chat")` → `toBe("map")`
- `expect(activeTab(s)).toBe("chat")` → `toBe("map")`
- `TOURISM_TABS` が `["map", "favorites", "shiori"]` であることを検証する1件を追加（AC 6.2, 7.2 の回帰ガード）

`src/ui/screens/LayeredMap.test.tsx` は `buildLayerFeatures`（お遍路）を対象としており `buildTourismLayerFeatures` には触れないので無変更。

Property 8（`buildTourismLayerFeatures`）は既存の観光レイヤー用テストファイルが無いため、`src/adapters/mock/tourismLayers.test.ts` を追加するか `routeCandidate.test.ts` に相乗りさせるかの選択になる。要件の必須テストは AC 8.4〜8.7 の4件で Property 8 は含まれないため、`later` レイヤー消滅の検証は `LayerKind` からの `"later"` 削除による型検査（AC 7.8）に委ね、Property 8 のテストは任意とする。

実装する場合、`later` の不在は `feature.layer === "later"` と書けない。`LayerKind` から `"later"` が消えた後は型に重なりが無い比較として TS2367 になるので、`(feature.layer as string) === "later"` のように `string` 経由で比較する。

### 整合性検証（AC 8.1, 8.2）

```
npm run typecheck
npx tsc --noEmit -p api/tsconfig.json
npm test
```

型検査で捕まる削除漏れ: 未解決 import（AC 6.1, 7.1, 7.5）、`ChatPort.sendMessage` への参照（6.4）、削除した型への参照（6.9, 7.6）、`LayerKind` の `"later"` リテラル（7.8, 7.9）、`TourismCollections` の余剰プロパティ（7.7）、`Record<TourismTab, TourismTabRenderer>` の網羅性（7.11）、`TOURISM_TAB_META` の添字ずれ（7.12）。

`tsconfig.json` は `noUnusedLocals` / `noUnusedParameters` を有効にしているので、削除に伴って使われなくなった import・ヘルパー・型（`mock/chat.ts` の `pick` / `looksLikeDiscovery` / `orderCandidates`、`aws/chat.ts` の `EHIME_SPOTS`、`TourismContext.tsx` の `buildSuggestionPayload` など）も型エラーとして表面化する。撤去漏れは `npm run typecheck` が拾う。

型検査で捕まらない削除漏れ（grep で確認する）: 文言キー `chat.*` / `swipe.*` / `tlmap.layer.later`（6.10, 7.10）、CSS の `.chat*`（6.11）。`resolveLabel` は未知キーでキー文字列を返すため、参照漏れは実行時エラーにならず画面にキーが露出する。

### Property Test の設定

- 各プロパティテストは最低100回の反復（fast-check の既定値）
- 各プロパティテストは design の対応プロパティを参照する。タグ形式: `Feature: swipe-favorites-itinerary, Property {番号}: {プロパティ名}`
