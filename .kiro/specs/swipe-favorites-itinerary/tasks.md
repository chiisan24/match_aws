# Implementation Plan: swipe-favorites-itinerary

## Overview

実装言語は TypeScript（React 18.3 + Vite 5）。テストは vitest + fast-check + `@testing-library/react`。

design.md の依存順に従い、次の並びで進める。

1. **追加が先**: `src/domain/routeCandidate.ts`（`spotFromRouteCandidate` / `spotsFromRouteCandidates` / `appendUniqueById`）。ストアと Route_Builder の両方が依存する。
2. **型を落とす**: `src/domain/types.ts` の Chat セクションと `LayerKind` の `later`。連鎖先はポート → 両アダプタ → ストア → レイヤー。
3. **ストアを組み替える**: `TourismContext.tsx`（状態撤去 → `addSpotsToShiori` → `favorites` 永続化）→ `App.tsx` → `TourismRouteBuilder.tsx`。
4. **タブ定義を縮める**: `modeManager.ts` → `modeManager.test.ts` → `ModeShell.tsx` → `tourismTabs.tsx`。お遍路側に残る JSDoc 参照もここで掃除する。
5. **型検査で捕まらない範囲を最後に**: 文言キー（キー名だけでなく**文面**も）と CSS。grep で確認する。

### 型検査に関する前提

`tsconfig.json` は `noUnusedLocals` / `noUnusedParameters` を有効にしているので、削除に伴って使われなくなった import・ヘルパー・型は型エラーとして表面化する。各削除タスクの完了条件に `npm run typecheck` を置く。

ただし削除は参照連鎖をまたぐため、**単独では型検査が緑にならないタスクがある**。該当タスクには「この時点で残る型エラー」と「それを解消するタスク番号」を明記した。連鎖の末端タスクが完了した時点で緑になる。

### 型検査で捕まらない削除漏れ

`resolveLabel` は未知キーに対してキー文字列自身を返すため、文言キーの参照漏れは型エラーにもテスト失敗にもならず、**画面にキー文字列が露出する**。CSS の未使用規則も同様に検出されない。

さらに、キー名に `swipe.` を含まないのに**文面が削除する操作を説明している**キーが2件ある（`shiori.lead` / `shiori.empty.lead`）。キー名の grep では見つからないので、タスク 8.2 で文面ごと差し替える。JSDoc・コメントからの参照も型検査では検出されないため、タスク 5.6 と 9.2 で明示的に確認する。

---

## Tasks

- [x] 1. 変換モジュール（Candidate_Converter）の追加

  - [x] 1.1 `src/domain/routeCandidate.ts` を新規作成し `src/domain/index.ts` から再エクスポートする
    - `CATEGORY_BY_KIND: Record<RouteCandidateKind, Spot["category"]>`（`sightseeing`→`sightseeing` / `food`→`food` / `cafe`→`food` / `custom`→`sightseeing`）を定義する
    - `joinOpeningHours(lines)`: 各要素を `trim` → 空要素を除去 → `" / "` で `join` → 空文字なら `undefined`
    - `spotFromRouteCandidate(candidate, lang)`: `location` はスプレッドではなく `{ lat, lng }` で複製し、`openingHours` / `website` は条件付きスプレッドで付与する。`popularityRank` はリテラルに現れさせない
    - `spotsFromRouteCandidates(candidates, lang)`: `map` でルート順を保つ
    - `appendUniqueById(collection: Spot[], additions)`: `Set` で既存 id を保持し、新規0件なら `collection` の参照そのものを返す
    - コメントは `src/domain/` の慣例に合わせて英語で書く
    - `src/domain/index.ts` に3関数の再エクスポートを追加する（`./swipe` ブロックの削除はタスク 5.1）
    - _完了条件: `npm run typecheck`_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 2.3, 4.2, 4.3, 4.4, 4.9_

  - [x] 1.2 `spotFromRouteCandidate` の必須フィールド写しをプロパティテストで固定する
    - 新規 `src/domain/routeCandidate.test.ts` を作成する。React も DOM も使わない
    - `candidateArb`（`fc.record` で `RouteCandidate` を組む。`photoUrl` / `websiteUri` / `regularOpeningHours` は `fc.option(..., { nil: undefined })` で有無の両分岐を覆う）と `LANGS` を定義する
    - **Property 1: 変換は必須フィールドを一意に決める**
    - タグ: `Feature: swipe-favorites-itinerary, Property 1: 変換は必須フィールドを一意に決める`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.12, 1.14**
    - _AC 8.4 を固定する必須テスト（`*` を付けない）_

  - [x] 1.3 任意フィールドの有無が入力に一致することをプロパティテストで固定する
    - `imageUrls` / `website` / `openingHours` の3分岐を検証する
    - `openingHours` は「非空要素が1件以上 → 結果が非空文字列かつ全非空要素を部分文字列として含む／非空要素0件 → 未設定」の形で検証し、区切り文字そのものは固定値でアサートしない（タスク 1.7 の例ベースに分ける）
    - **Property 2: 任意フィールドの有無が入力の有無に一致する**
    - タグ: `Feature: swipe-favorites-itinerary, Property 2: 任意フィールドの有無が入力の有無に一致する`
    - **Validates: Requirements 1.8, 1.9, 1.10, 1.11**
    - _AC 8.4 を固定する必須テスト_

  - [x] 1.4 変換が決定的で入力を変更しないことをプロパティテストで固定する
    - 2回変換の結果が構造的に等価であること、変換後の入力が変換前のクローンと等価であること、返された `Spot.location` が入力の `place.location` と同一参照でないことを検証する
    - **Property 3: 変換は決定的で入力を変更しない**
    - タグ: `Feature: swipe-favorites-itinerary, Property 3: 変換は決定的で入力を変更しない`
    - **Validates: Requirements 1.13**
    - _AC 8.4 を固定する必須テスト_

  - [x] 1.5 `appendUniqueById` が既存の接頭辞と追加順序を保つことをプロパティテストで固定する
    - 結果の先頭が元コレクションと一致し、続く要素が追加リストのうち新規なもののみを同順で並べたものに等しいことを検証する
    - **Property 4: 追記は既存の接頭辞と追加順序を保つ**
    - タグ: `Feature: swipe-favorites-itinerary, Property 4: 追記は既存の接頭辞と追加順序を保つ`
    - **Validates: Requirements 4.2, 4.4**
    - _AC 8.7 を支える必須テスト_

  - [x] 1.6 `appendUniqueById` が id で冪等であることをプロパティテストで固定する
    - 2回適用 = 1回適用、全要素が既存なら同一参照、空の追加リストなら同一参照を検証する
    - **Property 5: 追記は id で冪等である**
    - タグ: `Feature: swipe-favorites-itinerary, Property 5: 追記は id で冪等である`
    - **Validates: Requirements 2.3, 4.3, 4.9**
    - _AC 8.7 を支える必須テスト_

  - [x] 1.7 ルート順の保持と `openingHours` の区切り文字を例ベースで固定する
    - `spotsFromRouteCandidates` の結果の `id` 列が入力の `place.id` 列に一致することをプロパティテストで検証する（**Property 1, 4**）
    - `["月: 9:00–17:00", "火: 定休"]` → `"月: 9:00–17:00 / 火: 定休"` の1件を例ベースで検証する
    - **Validates: Requirements 1.10, 4.2**
    - _AC 8.4, 8.7 を固定する必須テスト_

- [x] 2. 型・ポート・アダプタ・API からチャットを撤去する

  - [x] 2.1 `src/domain/types.ts` から Chat セクションと `LayerKind` の `later` を削除する
    - `ChatMessage` / `ChatSession` / `ChatReply` / `SwipePreferences` をセクションごと削除する
    - `LayerKind` を `"favorite" | "shiori"` のユーザーレイヤーに縮め、コメントの「後で見る」記述も更新する
    - `Spot` / `RouteCandidate` / `RecommendedPlace` / `RouteCandidateKind` / `StorageKey` は無変更（`StorageKey` は `"favorites"` を既に含む）
    - _この時点で残る型エラー: `src/ports/index.ts`（2.2）、両アダプタ（2.3, 2.4）、`TourismContext.tsx`（3.1）、`SwipeDeck.tsx`（5.1 で削除）、`tourismLayers.ts` / `TourismLayeredMap.tsx`（7.1）_
    - _Requirements: 6.9, 7.6, 7.8_

  - [x] 2.2 `src/ports/index.ts` から `ChatPort.sendMessage` を削除する
    - `sendMessage` の宣言と `ChatReply` / `ChatSession` の import を削除する
    - `generateRecommendedPlans` / `generateRouteCandidates` / `generateTourismRoutePlan` / `generatePilgrimagePlan` / `estimateNextTempleNav` の5シグネチャは1文字も変えない
    - `ChatPort` の JSDoc「AI チャット相談・プラン生成 (Req 3, 12)」とファイル冒頭の「abstract interfaces for AI chat, ...」から相談チャットの記述を落とす
    - `export type * from "../domain/types"` のワイルドカード再エクスポート経由で `ChatMessage` / `ChatSession` / `ChatReply` / `SwipePreferences` も自動的に消えるので、個別の対応は不要
    - _完了条件: `npm run typecheck` で本ファイル由来のエラーが0件_
    - _Requirements: 6.4, 6.5_

  - [x] 2.3 `src/adapters/mock/chat.ts` から `sendMessage` と専用ヘルパーを削除する
    - `sendMessage` メソッド、`FRIENDLY_OPENERS` / `DISCOVERY_REPLY` / `FOLLOWUP_REPLY` / `DISCOVERY_HINTS` / `pick` / `looksLikeDiscovery` / `orderCandidates`、`Spot` / `ChatReply` / `ChatSession` の import を削除する
    - `forLang` は `NAV_NOTE` / `PLAN_LABELS` が使うので残す。`EHIME_SPOTS` は `mockRouteCandidates` が使うので残す
    - ファイル冒頭 JSDoc の「Produces friendly, non-robotic chat replies」「At destination-discovery moments it hands back swipe candidates」を落とす
    - _完了条件: `npm run typecheck` で本ファイル由来のエラーが0件（`noUnusedLocals` が撤去漏れを拾う）_
    - _Requirements: 6.6_

  - [x] 2.4 `src/adapters/aws/chat.ts` から `sendMessage` と `ChatApiResponse` を削除する
    - `sendMessage` メソッド、`ChatApiResponse` interface、`ChatReply` / `ChatSession` / `Spot` / `EHIME_SPOTS` の import を削除する
    - `chatErrorMessage` は残る4メソッドが使うので残す。`EHIME_TEMPLES` は `generatePilgrimagePlan` が使うので残す
    - ファイル冒頭 JSDoc の `sendMessage → POST {apiEndpoint}/chat` の行と、`recommendedSpotIds` を `EHIME_SPOTS` に写して swipe deck へ渡す旨の段落を落とす
    - _完了条件: `npm run typecheck` で本ファイル由来のエラーが0件_
    - _Requirements: 6.6_

  - [x] 2.5 `api/chat.ts` を削除し `/api/chat` のルート登録を外す
    - `api/chat.ts` を削除する
    - `scripts/vite-api-plugin.ts` の `ROUTES` から `"/api/chat"` の1行を削除する
    - _完了条件: `npx tsc --noEmit -p api/tsconfig.json`（api は root tsconfig の対象外）。本番ビルドへの影響はタスク 9.1 の `npm run build` で確認する_
    - _Requirements: 6.7_

- [x] 3. Tourism_Store の再構成（状態撤去・しおり統合・お気に入り永続化）

  - [x] 3.1 `src/app/TourismContext.tsx` からチャット・スワイプ状態と props を撤去する
    - `TourismContextValue` から削除: `session` / `messages` / `chatStatus` / `chatError` / `isSending` / `hasError` / `sendMessage` / `retry` / `swipeCandidates` / `hasCandidates` / `swipeHistory` / `recordSwipe` / `clearCandidates` / `later` / `addToLater`
    - `TourismState` から削除: `session` / `chatStatus` / `chatError` / `swipeCandidates` / `swipeHistory` / `later`
    - `ChatStatus` 型、`newSessionId()`、`runRequest`、`lastRequest` ref、`session.lang` 同期の `useEffect` を削除する
    - `TourismProviderProps` を `{ storage?: StoragePort; children: ReactNode }` にする（`chat` / `lang` を削除）
    - `createInitialState(lang)` を引数なしの `createInitialState()` にする（`session` が消えるので `lang` を受ける理由が無くなる）
    - `buildSuggestionPayload` / `SwipeRecord` / `ChatMessage` / `ChatSession` / `ChatPort` / `LangCode` の import を削除する（`LangCode` は `lang` prop と `createInitialState` のためだけに入っていた）
    - ファイル冒頭 JSDoc の「Chat session」「Swipe candidate hand-off」「Swipe history → preferences」「Error + retry」「{@link ChatPort} は prop で注入」の記述を、`favorites` / `shiori` / 永続化を説明する内容に書き換える
    - `classifyFavoriteTabs` / `FavoritePlan` / `FavoriteEntry` / `FavoriteTabKind` / `FavoriteTabClassification` は `FavoritesView` が使うので残す
    - `addFavorite` / `addToShiori` / `removeFavorite` / `removeFromShiori` / `reorderShiori` / `selectPlan` は無変更
    - _この時点で残る型エラー: `App.tsx` の `LocalizedTourismProvider`（3.4）、`SwipeDeck.tsx` / `ChatAdvisor.tsx`（5.1 で削除）、`TourismLayeredMap.tsx` の `later`（7.1）_
    - _Requirements: 6.8, 7.4_

  - [x] 3.2 `appendUniqueById` を共有し `addSpotsToShiori` を追加する
    - `addToCollection(key: "favorites" | "shiori", spot)` を `appendUniqueById(s[key], [spot])` で再実装し、`later` を対象から外す。結果が同一参照なら state も同一参照を返す既存挙動を維持する
    - `addSpotsToShiori(spots: Spot[])` を `useCallback` で追加し、`TourismContextValue` に公開する。`appendUniqueById(s.shiori, spots)` が同一参照を返したら `setState` も同一参照を返す
    - `src/domain/routeCandidate` から `appendUniqueById` を import する
    - _Requirements: 2.3, 4.1, 4.2, 4.3, 4.4, 4.9_

  - [x] 3.3 `favorites` を `Favorites_Storage_Key` で永続化する
    - `FAVORITES_KEY: StorageKey = "favorites"` を定義し、既存の `SHIORI_KEY` と並べる
    - `favoritesHydratedRef` を `shioriHydratedRef` とは別に持つ
    - 復元 `useEffect`: `storage` 未注入なら ref を `true` にして早期 return、`load<Spot[]>` を `try`/`catch` で包み、`Array.isArray(saved)` が真のときだけ `setState`、`cancelled` フラグでクリーンアップする
    - 保存 `useEffect`: `!storage || !favoritesHydratedRef.current` なら早期 return、`save<Spot[]>` の reject は `.catch(() => {})` で握り潰す
    - 2つの `useEffect` を `shiori` 側と独立させ、一方の失敗が他方の保存を妨げない構造にする
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 3.4 `src/app/App.tsx` の `LocalizedTourismProvider` を撤去する
    - `<TourismProvider storage={gateway.storage}>` を `SpotProvider` の内側（`LocalizedTourismProvider` があった位置）に直結する。`I18nProvider` / `ModeProvider` / `ImageProvider` / `SpotProvider` の入れ子は変えない
    - `LocalizedTourismProvider` 関数と、不要になった `useI18n` / `StoragePort` / `ReactNode` の import を削除する
    - **`ChatPort` の import は残す** — `AppFlowProps.chat: ChatPort` が使っている。ここを一緒に削ると型エラーになる
    - `AppFlow` の `chat` prop は `AIPlanFirst`（`generateRecommendedPlans`）と `TourismRouteBuilder`（`generateRouteCandidates` / `generateTourismRoutePlan`）が使うので残す
    - `phase` 遷移（言語選択 → プラン選択 → ルート構築 → 着地タブ `map`）は変更しない
    - _完了条件: `npm run typecheck` で本ファイル由来のエラーが0件_
    - _Requirements: 6.12_

  - [x] 3.5 永続化の往復をプロパティテストで固定する
    - 新規 `src/app/TourismContext.test.tsx` を作成する。`MockStorageAdapter` に対して `save` → `load` を回し、`StorageKey`（`"favorites"` / `"shiori"`）を媒介変数化する
    - **Property 6: 永続化は往復で内容と順序を保つ**
    - タグ: `Feature: swipe-favorites-itinerary, Property 6: 永続化は往復で内容と順序を保つ`
    - **Validates: Requirements 3.1, 3.2, 3.7, 4.6**
    - _AC 8.6 を固定する必須テスト_

  - [x] 3.6 永続化の失敗がメモリ上のリストを壊さないことをプロパティテストで固定する
    - `load` が `fc.anything()` を返す fake、`load` が throw する fake、`save` が reject する fake を用意する
    - キー別に成否を分ける fake で、`favorites` の保存だけ失敗しても `shiori` の保存が成立することを検証する
    - **Property 7: 永続化の失敗はメモリ上のリストを壊さない**
    - タグ: `Feature: swipe-favorites-itinerary, Property 7: 永続化の失敗はメモリ上のリストを壊さない`
    - **Validates: Requirements 3.4, 3.5, 3.8**
    - _AC 8.6 を固定する必須テスト。マウントを伴うケースは代表例1〜2件に留める_

  - [x] 3.7 復元・保存ガード・未注入・空追加を例ベースで固定する
    - `MockStorageAdapter` に事前 `save` した `favorites` が `TourismProvider` マウント時に復元されることを、プローブコンポーネント経由で検証する（AC 3.2）
    - `load` を手動解決する Promise にし、解決前は `save` 呼び出しが0件であることを検証する（AC 3.3）
    - `storage` を省略しても `addFavorite` が機能することを検証する（AC 3.6）
    - `addSpotsToShiori([])` の前後で `shiori` が同一参照であることを検証する（AC 4.9）
    - **Validates: Requirements 3.2, 3.3, 3.6, 4.9**
    - _AC 8.6 を固定する必須テスト_

- [ ] 4. チェックポイント — 変換モジュールとストアを確認する
  - `npm test` で `routeCandidate.test.ts` と `TourismContext.test.tsx` が通ることを確認する。全体の型検査はまだ赤（タスク 5 以降で解消）。疑問があれば利用者に確認する。

- [ ] 5. 削除画面とタブ定義を撤去する

  - [x] 5.1 `ChatAdvisor.tsx` / `SwipeDeck.tsx` / `domain/swipe.ts` を削除し参照3ファイルを更新する
    - `src/ui/screens/ChatAdvisor.tsx`、`src/ui/screens/SwipeDeck.tsx`、`src/domain/swipe.ts` を削除する
    - `src/ui/screens/index.ts` から `ChatAdvisor` / `ChatAdvisorProps` / `SwipeDeck` / `SwipeDeckProps` の再エクスポート4行を削除する
    - `src/domain/index.ts` から `./swipe` の `export` ブロック2つ（値と型）を削除する。タスク 1.1 で追加した `./routeCandidate` の再エクスポートはその位置に残す
    - `src/ui/screens/tourismTabs.tsx` から `ChatAdvisor` / `SwipeDeck` の import と `chat` / `swipe` の2エントリ、および JSDoc の該当行を削除する（`Partial<Record<...>>` と `goToTab` はタスク 5.5 まで残す）
    - _`domain/swipe.ts` の参照元は `SwipeDeck.tsx` / `TourismContext.tsx` / `domain/index.ts` のみ。テストからの参照はゼロなので既存テストは壊れない_
    - _完了条件: `npm run typecheck` で未解決 import が0件_
    - _Requirements: 6.1, 7.1, 7.5_

  - [x] 5.2 `src/app/modeManager.ts` の `TOURISM_TABS` を3件に縮める
    - `TOURISM_TABS = ["map", "favorites", "shiori"] as const` にする
    - `DEFAULT_TAB.tourism = TOURISM_TABS[0]` は式を変えずに `"map"` を返す
    - JSDoc の「チャット / スワイプ / お気に入り / しおり」を「マップ / お気に入り / しおり」に更新する
    - _この時点で残る型エラー: `ModeShell.tsx` の `TOURISM_TABS[3]` / `[4]` 添字ずれ（5.4 で解消）_
    - _Requirements: 6.2, 7.2, 7.3_

  - [x] 5.3 `src/app/modeManager.test.ts` を更新する
    - `expect(s.tabByMode.tourism).toBe("chat")` → `toBe("map")`
    - `expect(activeTab(s)).toBe("chat")` → `toBe("map")`
    - `TOURISM_TABS` が `["map", "favorites", "shiori"]` であることを検証するテストを1件追加する（`chat` / `swipe` 復活の回帰ガード）
    - **Validates: Requirements 6.2, 7.2, 7.3**
    - _AC 8.3 を固定する必須テスト（`*` を付けない）_

  - [x] 5.4 `src/ui/screens/ModeShell.tsx` の `TOURISM_TAB_META` を3件に振り直す
    - `map` / `favorites` / `shiori` の3エントリにし、添字を `TOURISM_TABS[0]`〜`[2]` に振り直す
    - `nav.tourism.chat` / `nav.tourism.swipe` / `panel.tourism.chat.title` / `panel.tourism.swipe.title` への参照が消えることを確認する（キー本体の削除はタスク 8.2）
    - _`PlaceholderPanel` 系の撤去はタスク 5.5 で `Record` 網羅化と同時に行う（それまで `renderer` は `undefined` を取り得る）_
    - _完了条件: `npm run typecheck` で添字ずれのエラーが0件_
    - _Requirements: 6.3, 7.12_

  - [ ] 5.5 `tourismTabs.tsx` を全タブ網羅にし `ModeShell.tsx` の placeholder 分岐を撤去する
    - `TOURISM_TAB_CONTENT` の型を `Partial<Record<TourismTab, TourismTabRenderer>>` → `Record<TourismTab, TourismTabRenderer>` に変更する（`map` / `favorites` / `shiori` の3件で網羅）
    - `TourismTabContext` から `goToTab` を削除し、`map` のみを渡す形にする
    - `ModeShell.tsx` の呼び出しを `renderer({ map })` に変更し、`renderer ? ... : <PlaceholderPanel ...>` の分岐を撤去する
    - `ModeShell.tsx` から `PlaceholderPanel` / `PlaceholderPanelProps` / `TabMeta.panelKey` / `TabMeta.motif` と `PlaceholderImage` / `SectionHeader` の import を削除する
    - `tourismTabs.tsx` のファイル冒頭 JSDoc（placeholder フォールバック、`chat` → `swipe` のハンドオフ、「chat session, swipe candidates and swipe history が保持される」の記述）を、全タブに renderer が登録済みである現状に合わせて書き替える
    - _`PlaceholderPanel` は `ModeShell.tsx` 内でのみ定義・使用されており、お遍路側は別シェルなので影響しない（`pilgrimageTabs.tsx` は `ModeShell` から参照されていない）_
    - _完了条件: `npm run typecheck`（`Record` の網羅性と `noUnusedLocals` で撤去漏れが表面化する）_
    - _Requirements: 7.11, 6.3, 7.12_

  - [ ] 5.6 お遍路側に残る `SwipeDeck` への JSDoc 参照を書き替える
    - `src/ui/screens/VisitTrackerScroll.tsx`: 冒頭 JSDoc の `{@link SwipeDeck}` と、`TemplePhoto` の JSDoc にある「Mirrors the 通常観光モード SwipeDeck's SpotPhoto」を、削除済みシンボルを指さない文面にする
    - `src/ui/screens/NokyochoView.tsx`: `useEffect` 上のコメント「Mirrors the 通常観光モード SwipeDeck, which seeds from fetched candidates ...」を同様に書き替える
    - _コード参照ではなくコメントのみなので型検査では検出されない。AC 7.1 は「ファイルと再エクスポート」を禁じるだけで JSDoc は対象外だが、存在しないシンボルを指すリンクを残さないために触る。`.swipe*` の CSS 共有（タスク 8.3）とは別件_
    - _Requirements: 7.1_

- [ ] 6. Route_Builder をストアに配線する

  - [x] 6.1 `src/ui/screens/TourismRouteBuilder.tsx` から `favorites` / `shiori` へ書き込む
    - `useTourism()` から `addFavorite` / `addSpotsToShiori` を取得し、`useI18n()` の `lang` を変換に渡す。`spotFromRouteCandidate` / `spotsFromRouteCandidates` を import する（`appendUniqueById` は import しない）
    - `decide(true)`: `addFavorite(spotFromRouteCandidate(candidate, lang))` を実行したうえで、既存のルート挿入と見送りリストからの除去を維持する。依存配列に `addFavorite` / `lang` を追加する
    - `decide(false)`: `favorites` に触れない
    - `debugAutoAccept`: 一括採用する各候補にも `addFavorite` を通す
    - `complete()`: `addSpotsToShiori(spotsFromRouteCandidates(route, lang))` を `onComplete(plan)` の**前**に呼ぶ（`onComplete` がこの画面をアンマウントするため）
    - `routeTimes` / `RoutePreview` の時刻表示は画面内表示として維持する。到着予定時刻は `Spot` に持ち込まない
    - `removeFromRoute` は `favorites` を触らない（現状のまま無変更）
    - _完了条件: `npm run typecheck`_
    - _Requirements: 2.1, 2.2, 2.4, 2.8, 4.1, 4.2, 4.9_

  - [ ] 6.2 お気に入り側の配線を例ベーステストで固定する
    - 新規 `src/ui/screens/TourismRouteBuilder.test.tsx` を作成する。fake `ChatPort`（`generateRouteCandidates` が固定候補2件、`generateTourismRoutePlan` が固定順序を返す）を用意し、`I18nProvider` + `TourismProvider` + `TourismRouteBuilder` をレンダリングする。`favorites` / `shiori` は同じ Provider 配下のプローブコンポーネントから読み出す
    - ♥ボタン押下で候補が `favorites` に入り、`name` / `category` が変換規則どおりであること（AC 2.1）
    - ♥ボタン押下でルートプレビューにも当該候補が現れること（AC 2.2）
    - ✕ボタン押下後に `favorites` が空であること（AC 2.4）
    - 同一 `place.id` を持つ候補が2つのステージ（観光→食事）のデッキに現れ、両方で「興味あり」にしても `favorites` が1件であること（AC 2.3）
      - _fake `ChatPort.generateRouteCandidates` が、`kind` によって `candidate.id` は違うが `place.id` は同じ候補を返すようにする_
      - _「見送り→復活」経路では検証できない。`restoreCandidate` はルートへ挿入して最終画面を開くだけでデッキへ戻らず、`decide` は `index` を単調に進めるので同一候補への2回目の Interest_Decision は起きない_
    - ♥ → 最終画面でルートから削除しても `favorites` に残ること（AC 2.5）
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    - _AC 8.5 を固定する必須テスト（`*` を付けない）_

  - [ ] 6.3 しおり統合を例ベーステストで固定する
    - 「このルートで旅を始める」で `shiori` の `id` 列がルート順に一致すること（AC 4.1, 4.2）
    - 事前に `addToShiori` した1件がある状態で開始すると、既存が先頭に残り新規が末尾に追加されること（AC 4.4）
    - `onComplete` のモックが `stops` 付きプランで呼ばれること（AC 4.10）
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.10**
    - _AC 8.7 を固定する必須テスト（`*` を付けない）_

- [ ] 7. マップレイヤーから「後で見る」を撤去する

  - [ ] 7.1 `tourismLayers.ts` と `TourismLayeredMap.tsx` から `later` を落とす
    - `src/adapters/mock/tourismLayers.ts`: `TourismCollections` から `later` を削除し、`collectionToFeatures(collections.later, "later", "later")` の行と JSDoc の「後で見る」記述を削除する
    - `src/ui/screens/TourismLayeredMap.tsx`: `USER_LAYERS` から `{ key: "later", ... }` を削除し、`useTourism()` の分割代入から `later` を外し、`buildTourismLayerFeatures(spots, { favorites, shiori })` に変更する
    - `PURPOSE_PRESETS` / `DEFAULT_ACTIVE` に `later` は含まれないので無変更
    - _完了条件: `npm run typecheck`（`TourismCollections` の余剰プロパティと `LayerKind` の `"later"` リテラルが表面化する）_
    - _Requirements: 7.7, 7.9, 5.4, 5.5_

  - [ ]* 7.2 レイヤー生成をプロパティテストで固定する
    - 新規 `src/adapters/mock/tourismLayers.test.ts` を作成する
    - `favorite` / `shiori` レイヤーのフィーチャが各コレクションと1対1に対応して `location` と `spotId` が一致し、`later` レイヤーのフィーチャが0件であることを検証する
    - _`later` の不在は `f.layer === "later"` と書くと TS2367（型に重なりが無い比較）になる。`(f.layer as string) === "later"` のように `string` 経由で比較する_
    - **Property 8: レイヤー生成はコレクションの座標にピンを置く**
    - タグ: `Feature: swipe-favorites-itinerary, Property 8: レイヤー生成はコレクションの座標にピンを置く`
    - **Validates: Requirements 5.4, 5.5, 7.7**
    - _任意。design は `later` 消滅の検証を `LayerKind` からの `"later"` 削除による型検査（AC 7.8）に委ねており、必須テストは AC 8.4〜8.7 の4件に含まれない_

- [ ] 8. 文言キーと CSS を撤去する

  - [ ] 8.1 `spot.*` へのキー改称と `FavoritesView.tsx` の参照更新を同時に行う
    - `src/i18n/labels.ts`: `swipe.category.sightseeing` / `.food` / `.souvenir` / `.onsen` を `spot.category.*` に、`swipe.reviewCount` を `spot.reviewCount` に改称する（全言語分）
    - `src/ui/screens/FavoritesView.tsx`: テンプレートリテラルで `swipe.category.` を組んでいる3箇所と `t("swipe.reviewCount")` の1箇所を新キーに更新する
    - _改称と参照更新を分けると、画面にキー文字列が露出した状態が残る。`resolveLabel` は未知キーでキー自身を返すため型検査もテストも失敗しないので、同一タスクで行う_
    - _Requirements: 7.10_

  - [ ] 8.2 `src/i18n/labels.ts` からチャット・スワイプ・後で見るのキーを削除し、しおりの案内文を新しい流入経路に合わせる
    - `chat.*` の全キー
    - `nav.tourism.chat` / `nav.tourism.swipe` / `panel.tourism.chat.title` / `panel.tourism.swipe.title`（参照はタスク 5.4, 5.5 で消えている）
    - `tlmap.layer.later`（参照はタスク 7.1 で消えている）
    - 残る `swipe.*` 全キー（`swipe.title` / `.lead` / `.progress` / `.cardRole` / `.controls` / `.hint` / `.action.*` / `.aria.*` / `.rank` / `.noReviews` / `.recommend.*` / `.done.*` / `.restart` / `.backToChat`）— いずれも `SwipeDeck` 専用。タスク 8.1 で改称した `spot.*` は残す
    - **`shiori.lead` と `shiori.empty.lead` の文面（ja / en / iyo）を書き替える。** 現在どちらも「スワイプで**上に**した／スワイプ画面で上にスワイプすると」と、削除する4方向スワイプの操作を案内している。しおりへの流入経路は Final_Stage の「このルートで旅を始める」だけになるので、その旨に改める
    - `fav.empty.lead`（「スワイプで気になるスポットを右にすると、ここに集まります。」）は変更しない。Route_Builder の右スワイプ＝興味ありがそのままお気に入り登録になるので、この機能の後は文面が事実と一致する
    - _`labels.ts` はオブジェクトリテラル（`"key": {...}`）と後段の代入（`UI_LABELS["key"] = {...}`）の2形式が混在している。`chat.*` / `nav.tourism.*` / `panel.tourism.*` は前者、`swipe.*` / `tlmap.layer.later` / `shiori.*` は後者_
    - _Requirements: 6.10, 7.10_

  - [ ] 8.3 `src/ui/styles/screens.css` から `.chat*` の規則を削除する
    - 削除対象: `.chat`, `.chat__header`, `.chat__title`, `.chat__lead`, `.chat__transcript`, `.chat__bubble*`, `.chat__avatar`, `.chat__text`, `.chat__handoff*`, `.chat__error*`, `.chat__compose`, `.chat__input*`
    - **`.swipe*` の規則は削除しない**。`VisitTrackerScroll`（お遍路マッチ）が `.swipe__done`, `.swipe__done-actions`, `.swipe__stage`, `.swipe-card`, `.swipe-card--peek`, `.swipe-card--lean-{left,right}`, `.swipe-card__badge`, `.swipe-card__badge--{left,right}`, `.swipe-card__photo-wrap`, `.swipe-card__photo`, `.swipe-card__body`, `.swipe-card__name`, `.swipe-card__desc` の12クラスを共有している
    - `SwipeDeck` 専用の規則（`.swipe__controls`, `.swipe__btn*`, `.swipe__recommend*`, `.swipe-card__rank`, `.swipe-card__reviews*` など）は死コードとして残るが、これを削除する AC は無いので触らない
    - _Requirements: 6.11_

- [ ] 9. 最終検証

  - [ ] 9.1 4つの検証コマンドを実行し、失敗を修正する
    - `npm run typecheck`（root tsconfig。型エラー0件）
    - `npx tsc --noEmit -p api/tsconfig.json`（api は root 対象外）
    - `npm test`（vitest。全テスト成功）
    - `npm run build`（本番ビルド。`api/chat.ts` 削除と `/api/chat` ルート削除の影響確認を含む）
    - _Requirements: 8.1, 8.2_

  - [ ] 9.2 型検査で捕まらない削除漏れを grep で確認する
    - `src/` を対象に `chat\.` 接頭辞の文言キー参照が0件であることを確認する（`chatErrorMessage` / `ChatPort` / `gateway.chat` などの識別子は対象外）
    - `src/` を対象に `swipe\.` 接頭辞の文言キー参照が0件であることを確認する（`spot.category.*` / `spot.reviewCount` に改称済み）
    - `tlmap.layer.later` の参照が0件であることを確認する
    - `src/i18n/labels.ts` に `chat.*` / `swipe.*` / `tlmap.layer.later` のキー定義が残っていないことを確認する
    - `src/ui/styles/screens.css` に `.chat` 系セレクタが残っていないこと、および `.swipe` 系セレクタが**残っている**ことを確認する
    - `ChatAdvisor` / `SwipeDeck` / `domain/swipe` / `SwipePreferences` / `ChatMessage` / `ChatSession` / `ChatReply` / `sendMessage` / `addToLater` / `recordSwipe` / `clearCandidates` / `swipeCandidates` / `swipeHistory` / `hasCandidates` の残存参照が0件であることを確認する（コメント・JSDoc を含む。`chatErrorMessage` / `ChatPort` / `gateway.chat` / `BinarySwipeDeck` / `route-builder-swipe*` は残す）
    - `SwipeDir` / `SwipeClassification` / `SwipeRecord` / `Identifiable` / `classifySwipe` / `generateRecommendations` / `recommendSimilarSpots` / `buildSuggestionPayload` の残存参照が0件であることを確認する（`domain/index.ts` の再エクスポートを含む）
    - `shiori.lead` / `shiori.empty.lead` の文面に「上にスワイプ」「スワイプ画面」が残っていないことを確認する（タスク 8.2）
    - _`resolveLabel` は未知キーでキー文字列を返すため、参照漏れは実行時エラーにならず画面にキーが露出する。型検査もテストも失敗しないので grep が唯一の検出手段_
    - _Requirements: 6.10, 6.11, 7.10_

- [ ] 10. 最終チェックポイント
  - タスク 9.1 の4コマンドすべてが成功していることを確認する。疑問があれば利用者に確認する。

---

## Correctness Properties とタスクの対応

| Property | 内容 | 検証タスク | 必須/任意 |
| --- | --- | --- | --- |
| Property 1 | 変換は必須フィールドを一意に決める | 1.2（+ 1.7 で順序） | 必須（AC 8.4） |
| Property 2 | 任意フィールドの有無が入力の有無に一致する | 1.3 | 必須（AC 8.4） |
| Property 3 | 変換は決定的で入力を変更しない | 1.4 | 必須（AC 8.4） |
| Property 4 | 追記は既存の接頭辞と追加順序を保つ | 1.5（+ 1.7 で順序） | 必須（AC 8.7） |
| Property 5 | 追記は id で冪等である | 1.6 | 必須（AC 8.7） |
| Property 6 | 永続化は往復で内容と順序を保つ | 3.5 | 必須（AC 8.6） |
| Property 7 | 永続化の失敗はメモリ上のリストを壊さない | 3.6 | 必須（AC 8.6） |
| Property 8 | レイヤー生成はコレクションの座標にピンを置く | 7.2 | 任意 |

## ファイルとタスクの対応

### 削除するファイル（4件）

| ファイル | タスク | AC |
| --- | --- | --- |
| `src/ui/screens/ChatAdvisor.tsx` | 5.1 | 6.1 |
| `src/ui/screens/SwipeDeck.tsx` | 5.1 | 7.1 |
| `src/domain/swipe.ts` | 5.1 | 7.5 |
| `api/chat.ts` | 2.5 | 6.7 |

### 変更するファイル（21件）

| ファイル | タスク | AC |
| --- | --- | --- |
| `src/domain/index.ts` | 1.1（追加） / 5.1（`./swipe` 削除） | 7.5 |
| `src/domain/types.ts` | 2.1 | 6.9, 7.6, 7.8 |
| `src/ports/index.ts` | 2.2 | 6.4, 6.5 |
| `src/adapters/mock/chat.ts` | 2.3 | 6.6 |
| `src/adapters/aws/chat.ts` | 2.4 | 6.6 |
| `scripts/vite-api-plugin.ts` | 2.5 | 6.7 |
| `src/app/TourismContext.tsx` | 3.1, 3.2, 3.3 | 6.8, 7.4, 3.x, 4.x |
| `src/app/App.tsx` | 3.4 | 6.12 |
| `src/ui/screens/index.ts` | 5.1 | 6.1, 7.1 |
| `src/ui/screens/tourismTabs.tsx` | 5.1（エントリ削除） / 5.5（`Record` 網羅化） | 6.1, 7.1, 7.11 |
| `src/app/modeManager.ts` | 5.2 | 6.2, 7.2, 7.3 |
| `src/app/modeManager.test.ts` | 5.3 | 8.3, 6.2, 7.2 |
| `src/ui/screens/ModeShell.tsx` | 5.4（添字） / 5.5（placeholder 撤去） | 6.3, 7.12 |
| `src/ui/screens/VisitTrackerScroll.tsx` | 5.6（JSDoc のみ） | 7.1 |
| `src/ui/screens/NokyochoView.tsx` | 5.6（コメントのみ） | 7.1 |
| `src/ui/screens/TourismRouteBuilder.tsx` | 6.1 | 2.1, 2.2, 2.4, 2.8, 4.1, 4.2, 4.9 |
| `src/adapters/mock/tourismLayers.ts` | 7.1 | 7.7 |
| `src/ui/screens/TourismLayeredMap.tsx` | 7.1 | 7.9 |
| `src/ui/screens/FavoritesView.tsx` | 8.1 | 7.10 |
| `src/i18n/labels.ts` | 8.1（改称） / 8.2（削除） | 6.10, 7.10 |
| `src/ui/styles/screens.css` | 8.3 | 6.11 |

### 新規ファイル（4件：実装1 + テスト3）

| ファイル | タスク |
| --- | --- |
| `src/domain/routeCandidate.ts` | 1.1 |
| `src/domain/routeCandidate.test.ts` | 1.2〜1.7 |
| `src/app/TourismContext.test.tsx` | 3.5〜3.7 |
| `src/ui/screens/TourismRouteBuilder.test.tsx` | 6.2, 6.3 |

任意タスク 7.2 を実施する場合は `src/adapters/mock/tourismLayers.test.ts` が加わる。

## 変更せずに満たす AC

要件の Introduction が「しおりは単一リストを維持し、既存の並べ替え・削除・共有・永続化をそのまま再利用する」と定めているため、次の9条は**既存実装を変えないこと**が達成条件になる。実装タスクを持たないのは意図的で、根拠となる既存コードを明記して追跡可能にしておく。タスク 9.1 の `npm test` / `npm run build` が回帰の検出点。

| AC | 内容 | 根拠となる既存実装 | 変更 |
| --- | --- | --- | --- |
| 2.6 | Favorites_View の削除操作で当該 Spot を除去 | `TourismContext.removeFavorite` + `FavoritesView` の `onRemove={removeFavorite}` | なし |
| 2.7 | 追加された Spot が「すべて」「スポット」タブに出る | `classifyFavoriteTabs`（`favorites` → `spot` と `all` の両方へ写す） | なし（タスク 3.1 で残すと明記） |
| 4.5 | Shiori_List の Spot を番号付きリスト項目として表示 | `ShioriEditor` の `<ol className="shiori__list">` | なし |
| 4.7 | しおり項目が到着予定時刻を保持するなら表示 | 設計判断1により前提が偽。`Spot` に時刻を持たせないので空虚に成立 | なし |
| 4.8 | Shiori_List を単一リストとして3画面へ提供 | `TourismContextValue.shiori`（`ShioriEditor` / `FavoritesView` の しおりタブ / `TourismLayeredMap` が同じ配列を読む） | なし |
| 5.1 | 「ひとつ前へ / 後へ」で並び順を更新し全要素を保持 | `reorderShiori` → 純粋 `reorder`（`src/domain/reorder.ts`） | なし |
| 5.2 | Shiori_Editor の削除操作で当該 Spot を除去 | `removeFromShiori` | なし |
| 5.3 | 共有用プランの項目一覧が Shiori_List と一致 | `ShioriEditor` の `useMemo<SharePlan>`（`shiori` から毎回導出） | なし |
| 5.6 | 画像URLが無い Spot はプレースホルダー表示 | `ShioriEditor` の `SpotThumb`（`if (!url)`）/ `FavoritesView` の `SpotThumb`（`if (!url \|\| errored)`） | なし |

その他の全 AC（Requirement 1 の14条、2.1〜2.5 / 2.8、3.1〜3.8、4.1〜4.4 / 4.6 / 4.9 / 4.10、5.4 / 5.5、Requirement 6 の12条、Requirement 7 の12条、Requirement 8 の7条）はいずれか1つ以上の実装タスクから参照されている。

## Notes

- `*` を付けたサブタスクは任意（7.2 のみ）。AC 8.3〜8.7 を固定するテスト（1.2〜1.7 / 3.5〜3.7 / 5.3 / 6.2 / 6.3）は必須なので `*` を付けない。
- 各プロパティテストは fast-check の既定値（最低100回）で回す。マウントを伴うケースは代表例1〜2件に留める。
- `src/ui/screens/LayeredMap.test.tsx` は `buildLayerFeatures`（お遍路）を対象としており `buildTourismLayerFeatures` には触れないので無変更。
- 到着予定時刻は `Spot` に持ち込まない。`ShioriEditor.tsx` / `src/domain/share.ts` / `src/domain/reorder.ts` / `Shiori_Storage_Key` の JSON 形状はいずれも無変更（AC 4.7 は前提が偽になり空虚に成立する）。
- `mock/chat.ts` は `forLang` / `EHIME_SPOTS` を残す。`aws/chat.ts` は `chatErrorMessage` / `EHIME_TEMPLES` を残す。Chat_Port のプラン生成系5メソッドはシグネチャを1文字も変えない。
- `.swipe*` の CSS は削除しない（`VisitTrackerScroll` が12クラスを共有）。削除対象は `.chat*` のみ。
- 既存テスト9件（`LayeredMap.test.tsx` / `MapCanvas.test.tsx` / `components.test.tsx` / `modeManager.test.ts` / `recommendationFallbackPlans.test.ts` / `spot.test.ts` / `api/recommendations.test.ts` / `api/_recommendation-fallback.test.ts` / `api/_fallback-candidates.test.ts`）のうち、削除対象へ触るのは `modeManager.test.ts` のみ（タスク 5.3 で更新）。`domain/swipe` / `ChatAdvisor` / `SwipeDeck` / `sendMessage` をテストから参照している箇所はゼロ。
- `ModeProvider` は `rehydrate={false}` でマウントされ、タブは永続化されない（`"mode"` キーに入るのは現在モードだけ）。`TOURISM_TABS` を縮めても保存済みの `"chat"` / `"swipe"` が復元されることはない。
- `App.tsx` の `onComplete` は `setTab("map", "tourism")` を明示的に呼ぶので、AC 7.3 の既定タブ `map` は初回導線とは独立に成立する。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["1.3", "2.3"] },
    { "id": 3, "tasks": ["1.4", "2.4"] },
    { "id": 4, "tasks": ["1.5", "2.5"] },
    { "id": 5, "tasks": ["1.6", "3.1"] },
    { "id": 6, "tasks": ["1.7", "3.2"] },
    { "id": 7, "tasks": ["3.3", "3.4"] },
    { "id": 8, "tasks": ["3.5", "5.1"] },
    { "id": 9, "tasks": ["3.6", "5.2"] },
    { "id": 10, "tasks": ["3.7", "5.3"] },
    { "id": 11, "tasks": ["5.4", "6.1"] },
    { "id": 12, "tasks": ["5.5", "6.2"] },
    { "id": 13, "tasks": ["5.6", "6.3", "7.1"] },
    { "id": 14, "tasks": ["7.2", "8.1"] },
    { "id": 15, "tasks": ["8.2", "8.3"] },
    { "id": 16, "tasks": ["9.1", "9.2"] }
  ]
}
```
