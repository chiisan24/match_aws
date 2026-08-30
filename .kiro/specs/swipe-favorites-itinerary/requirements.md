# Requirements Document

## Introduction

AIプランのテーマ選択後に表示されるスワイプ式ルート構築画面（Route_Builder）で組み上げた最終ルートが、次画面のしおりへ引き継がれていない。また「興味あり」スワイプの結果もお気に入りに残らないため、旅程を組み直す手間が発生している。

本機能では次の3点を実現する。

1. Route_Builder のスワイプ候補（Route_Candidate）をスポット（Spot）へ変換する規則を定め、確定ルートを既存のしおりリストへ統合する。
2. 「興味あり」スワイプの瞬間にお気に入りへ自動登録し、お気に入りを localStorage に永続化する。
3. 利用されていない AI 相談チャット機能を完全に削除する。チャット削除により供給元を失う4方向スワイプ画面と、その付随状態・レイヤーも併せて削除し、到達不能な経路を残さない。

しおりは単一リストを維持し、既存の並べ替え・削除・共有・永続化をそのまま再利用する。Chat_Port のプラン生成系5メソッド（AIプラン提案・ルート候補生成・ルート最適化・お遍路プラン・次の札所ナビ）は削除対象に含めない。

## Glossary

### 画面・状態

- **Application**: アプリ全体のシェルと画面遷移 `src/app/App.tsx`
- **Route_Builder**: スワイプ候補提示・ルート編集画面 `src/ui/screens/TourismRouteBuilder.tsx`
- **Binary_Swipe_Deck**: Route_Builder 内の2方向スワイプUI `BinarySwipeDeck`（興味あり／興味なし）
- **Interest_Decision**: Binary_Swipe_Deck の「興味あり」判定。♥ボタン押下、右方向のドラッグ（80px以上）、または ArrowRight キーによって発生する
- **Skip_Decision**: Binary_Swipe_Deck の「興味なし」判定。✕ボタン押下、左方向のドラッグ（80px以上）、または ArrowLeft キーによって発生する
- **Final_Stage**: Route_Builder の最終画面（`stage === "final"`）。ルートプレビュー、編集エディタ、見送り候補の復活を含む
- **Start_Trip_Action**: Final_Stage の「このルートで旅を始める」操作。`complete()` を実行し `onComplete` を呼ぶ
- **Debug_Skip_Action**: Route_Builder のデバッグ専用一括追加操作（`debugSkipSwipeEnabled` が真のときのみ表示）
- **Tourism_Store**: 通常観光モードの共有状態 `TourismProvider` / `useTourism`（`src/app/TourismContext.tsx`）
- **Favorites_List**: Tourism_Store の `favorites: Spot[]`
- **Shiori_List**: Tourism_Store の `shiori: Spot[]`
- **Later_List**: Tourism_Store の `later: Spot[]`（削除対象）
- **Active_Plan**: Tourism_Store の `activePlan: RecommendedPlan | null`
- **Favorites_View**: お気に入り画面 `src/ui/screens/FavoritesView.tsx`
- **Shiori_Editor**: しおり画面 `src/ui/screens/ShioriEditor.tsx`
- **Tourism_Layered_Map**: 重ねるマップ画面 `src/ui/screens/TourismLayeredMap.tsx`
- **Mode_Shell**: タブナビゲーションを持つ画面シェル `src/ui/screens/ModeShell.tsx`
- **Mode_Manager**: モード・タブの純粋ロジック `src/app/modeManager.ts`
- **Tourism_Tabs**: 通常観光モードのタブ一覧 `TOURISM_TABS`（`src/app/modeManager.ts`）
- **Tab_Content_Registry**: タブIDと画面の対応表 `TOURISM_TAB_CONTENT`（`src/ui/screens/tourismTabs.tsx`）

### データ・変換

- **Route_Candidate**: スワイプ候補の型 `RouteCandidate`（`src/domain/types.ts`）。`place.location` は必須
- **Place_Id**: `RouteCandidate.place.id`（Google Place ID）
- **Spot**: 観光スポットの型 `Spot`（`src/domain/types.ts`）
- **Candidate_Converter**: Route_Candidate を Spot に変換する新規の純粋関数
- **Layer_Builder**: マップレイヤー生成関数 `buildTourismLayerFeatures`（`src/adapters/mock/tourismLayers.ts`）
- **Swipe_Domain**: 4方向スワイプのドメインロジック `src/domain/swipe.ts`（削除対象）

### 永続化

- **Storage_Port**: 永続化ポート `StoragePort`（`src/ports/index.ts`）
- **Favorites_Storage_Key**: `StorageKey` の `"favorites"`
- **Shiori_Storage_Key**: `StorageKey` の `"shiori"`

### チャット（削除対象）

- **Chat_Advisor**: AI相談チャット画面 `src/ui/screens/ChatAdvisor.tsx`
- **Chat_Port**: AIポート `ChatPort`（`src/ports/index.ts`）
- **Chat_Send_Method**: `Chat_Port.sendMessage`
- **Plan_Methods**: Chat_Port の残す5メソッド `generateRecommendedPlans` / `generateRouteCandidates` / `generateTourismRoutePlan` / `generatePilgrimagePlan` / `estimateNextTempleNav`
- **Mock_Chat_Adapter**: `src/adapters/mock/chat.ts`
- **Aws_Chat_Adapter**: `src/adapters/aws/chat.ts`
- **Chat_API**: サーバーレスハンドラ `api/chat.ts` と開発サーバーの `/api/chat` ルート（`scripts/vite-api-plugin.ts`）
- **Swipe_Deck**: 4方向スワイプ画面 `src/ui/screens/SwipeDeck.tsx`（削除対象）

### 検証

- **Codebase**: 本リポジトリのソースツリー（`src/`、`api/`、`scripts/`）
- **Type_Check**: `npm run typecheck` および `npx tsc --noEmit -p api/tsconfig.json`
- **Test_Suite**: `npm test`（`vitest run`）

## Requirements

### Requirement 1: スワイプ候補からスポットへの変換

**User Story:** 旅行者として、スワイプで選んだ行き先が お気に入り と しおり にそのまま並んでほしい。スワイプの結果が次の画面に引き継がれないと、同じ行き先を探し直して登録し直す手間がかかるため。

#### Acceptance Criteria

1. THE Candidate_Converter SHALL 1件の Route_Candidate から1件の Spot を生成する。
2. THE Candidate_Converter SHALL 生成した Spot の `id` に Route_Candidate の Place_Id を設定する。
3. THE Candidate_Converter SHALL 生成した Spot の `name` に Route_Candidate の `title` を設定する。
4. THE Candidate_Converter SHALL 生成した Spot の `location` に Route_Candidate の `place.location` を設定する。
5. THE Candidate_Converter SHALL Route_Candidate の `kind` を Spot の `category` へ、`sightseeing` は `sightseeing`、`food` は `food`、`cafe` は `food`、`custom` は `sightseeing` の対応で変換する。
6. THE Candidate_Converter SHALL 生成した Spot の `localizedDescriptions` に、変換時の表示言語コードをキーとして Route_Candidate の `description` を設定する。
7. THE Candidate_Converter SHALL 生成した Spot の `reviews` を空配列に設定する。
8. WHERE Route_Candidate が `place.photoUrl` を持つ、THE Candidate_Converter SHALL 生成した Spot の `imageUrls` を当該URL1件のみを要素とする配列に設定する。
9. IF Route_Candidate が `place.photoUrl` を持たない、THEN THE Candidate_Converter SHALL 生成した Spot の `imageUrls` を空配列に設定する。
10. WHERE Route_Candidate が `place.regularOpeningHours` を持つ、THE Candidate_Converter SHALL 生成した Spot の `openingHours` に当該営業時間の文字列表現を設定する。
11. WHERE Route_Candidate が `place.websiteUri` を持つ、THE Candidate_Converter SHALL 生成した Spot の `website` に当該URLを設定する。
12. THE Candidate_Converter SHALL 生成した Spot の `popularityRank` を未設定のままにする。
13. THE Candidate_Converter SHALL 同一の Route_Candidate に対して構造的に等価な Spot を返し、入力の Route_Candidate を変更しない。
14. WHEN 同一の Place_Id を持つ複数の Route_Candidate を変換する、THE Candidate_Converter SHALL 同一の `id` を持つ Spot を返す。

### Requirement 2: 「興味あり」スワイプ時のお気に入り自動登録

**User Story:** 旅行者として、スワイプで「興味あり」にした場所をその場でお気に入りに残したい。あとで気になった場所を思い出して探し直す必要をなくしたいため。

#### Acceptance Criteria

1. WHEN Binary_Swipe_Deck が Interest_Decision を受け取る、THE Route_Builder SHALL 当該 Route_Candidate を Requirement 1 の規則で変換した Spot を Favorites_List に追加する。
2. WHEN Binary_Swipe_Deck が Interest_Decision を受け取る、THE Route_Builder SHALL 当該 Route_Candidate を編集中ルートへ挿入する既存の動作を維持する。
3. IF Favorites_List に同一 `id` の Spot が既に存在する、THEN THE Tourism_Store SHALL Favorites_List を変更しない。
4. WHEN Binary_Swipe_Deck が Skip_Decision を受け取る、THE Route_Builder SHALL Favorites_List を変更しない。
5. WHEN 利用者が Final_Stage の編集エディタで立寄先をルートから削除する、THE Tourism_Store SHALL Favorites_List 内の当該 Spot を保持する。
6. WHEN 利用者が Favorites_View の削除操作を実行する、THE Tourism_Store SHALL Favorites_List から当該 `id` の Spot を除去する。
7. WHEN Favorites_List に Spot が追加される、THE Favorites_View SHALL 当該 Spot を「すべて」タブおよび「スポット」タブに表示する。
8. WHERE Debug_Skip_Action が有効である、THE Route_Builder SHALL 一括追加した各 Route_Candidate を変換した Spot を Favorites_List に追加する。

### Requirement 3: お気に入りの永続化

**User Story:** 旅行者として、アプリを開き直してもお気に入りが残っていてほしい。旅の準備を複数回に分けて進めたいため。

#### Acceptance Criteria

1. WHEN Favorites_List が変化する、THE Tourism_Store SHALL Storage_Port の `save` を Favorites_Storage_Key で呼び出して Favorites_List を保存する。
2. WHEN Tourism_Store がマウントされる、THE Tourism_Store SHALL Storage_Port の `load` を Favorites_Storage_Key で呼び出して Favorites_List を復元する。
3. WHILE Favorites_List の初期復元が完了していない、THE Tourism_Store SHALL Favorites_Storage_Key への保存を行わない。
4. IF Storage_Port の `load` が例外を投げるか配列以外の値を返す、THEN THE Tourism_Store SHALL メモリ上の Favorites_List を維持する。
5. IF Storage_Port の `save` が失敗する、THEN THE Tourism_Store SHALL メモリ上の Favorites_List を維持し、画面の操作を継続可能な状態に保つ。
6. WHERE Storage_Port が Tourism_Store に注入されていない、THE Tourism_Store SHALL Favorites_List をメモリ上のみで保持する。
7. WHEN 保存済みの Favorites_List を復元する、THE Tourism_Store SHALL 保存時と同一の順序で Spot を並べる。
8. THE Tourism_Store SHALL Favorites_List の永続化を Shiori_List の永続化と独立に行い、一方の失敗が他方の保存を妨げない状態を保つ。

### Requirement 4: 確定ルートのしおりへの統合

**User Story:** 旅行者として、スワイプで組み上げた最終ルートをしおり画面でそのまま見たい。組んだ旅程が次の画面に引き継がれないと、しおりを一から作り直すことになるため。

#### Acceptance Criteria

1. WHEN 利用者が Start_Trip_Action を実行する、THE Tourism_Store SHALL 確定ルートの各立寄先を Requirement 1 の規則で変換した Spot を Shiori_List に追加する。
2. WHEN Start_Trip_Action によって Spot が追加される、THE Tourism_Store SHALL 追加した Spot を確定ルートの並び順で Shiori_List に並べる。
3. IF Shiori_List に同一 `id` の Spot が既に存在する、THEN THE Tourism_Store SHALL 当該 Spot を重複して追加しない。
4. WHEN Start_Trip_Action の実行前から Shiori_List に Spot が存在する、THE Tourism_Store SHALL 既存の Spot とその順序を保持したうえで新規の Spot を末尾に追加する。
5. WHEN Shiori_List に Spot が追加される、THE Shiori_Editor SHALL 当該 Spot を番号付きリストの項目として表示する。
6. WHEN Shiori_List が変化する、THE Tourism_Store SHALL Shiori_Storage_Key による既存の永続化処理で Shiori_List を保存する。
7. WHERE しおり項目が到着予定時刻を保持する、THE Shiori_Editor SHALL 当該時刻を項目に表示する。
8. THE Tourism_Store SHALL Shiori_List を単一のリストとして Shiori_Editor、Favorites_View の「しおり」タブ、および Tourism_Layered_Map に提供する。
9. WHEN 確定ルートが空である状態で Start_Trip_Action を実行する、THE Tourism_Store SHALL Shiori_List を変更しない。
10. WHEN 利用者が Start_Trip_Action を実行する、THE Application SHALL Active_Plan を確定ルートで更新し、着地タブとして `map` を表示する既存の遷移を維持する。

### Requirement 5: 既存のしおり操作とマップ表示の継続

**User Story:** 旅行者として、しおりに入った行き先を並べ替え・削除・共有できる状態のままにしてほしい。ルートから流し込んだ項目だけ編集できないという状態を避けたいため。

#### Acceptance Criteria

1. WHEN 利用者が Shiori_Editor の「ひとつ前へ」または「ひとつ後へ」を操作する、THE Tourism_Store SHALL Shiori_List の並び順を更新し、全要素を保持する。
2. WHEN 利用者が Shiori_Editor の削除操作を実行する、THE Tourism_Store SHALL Shiori_List から当該 `id` の Spot を除去する。
3. WHEN Shiori_List が変化する、THE Shiori_Editor SHALL 共有用プランの項目一覧を Shiori_List の内容と順序に一致させる。
4. WHEN Favorites_List または Shiori_List が変化する、THE Tourism_Layered_Map SHALL Layer_Builder の結果としてお気に入りレイヤーおよびしおりレイヤーのピンを更新する。
5. THE Tourism_Layered_Map SHALL Candidate_Converter が生成した Spot を、当該 Spot の `location` の座標に配置する。
6. WHEN Candidate_Converter が生成した Spot に画像URLが無い、THE Shiori_Editor および Favorites_View SHALL プレースホルダー画像を表示する。

### Requirement 6: AI相談チャット機能の削除

**User Story:** 開発者として、使用しないAI相談チャットをコードベースから取り除きたい。維持対象を減らし、残る機能の見通しを良くしたいため。

#### Acceptance Criteria

1. THE Codebase SHALL Chat_Advisor のファイルと、そのファイルを指す再エクスポートを含まない。
2. THE Mode_Manager SHALL Tourism_Tabs に `chat` を含まない。
3. THE Mode_Shell SHALL 下部ナビゲーションにチャットタブを表示しない。
4. THE Chat_Port SHALL Chat_Send_Method を宣言しない。
5. THE Chat_Port SHALL Plan_Methods の5メソッドを変更前と同一のシグネチャで宣言する。
6. THE Mock_Chat_Adapter および THE Aws_Chat_Adapter SHALL Plan_Methods のみを実装する。
7. THE Codebase SHALL Chat_API のハンドラファイルと `/api/chat` のルート登録を含まない。
8. THE Tourism_Store SHALL `session`、`messages`、`chatStatus`、`chatError`、`isSending`、`hasError`、`sendMessage`、`retry` を公開しない。
9. THE Codebase SHALL `ChatMessage`、`ChatSession`、`ChatReply` の型宣言と、それらへの参照を含まない。
10. THE Codebase SHALL 接頭辞 `chat.` を持つ表示文言キーを含まない。
11. THE Codebase SHALL チャットUI専用のスタイル規則を含まない。
12. WHEN 利用者が言語選択を完了する、THE Application SHALL プラン選択、ルート構築、着地タブ `map` の順序で変更前と同じ画面遷移を行う。

### Requirement 7: 4方向スワイプ画面と付随する到達不能な経路の削除

**User Story:** 開発者として、候補の供給元を失って常に空になる画面と状態を残したくない。到達不能なコードは仕様の理解を妨げ、誤った前提を生むため。

#### Acceptance Criteria

1. THE Codebase SHALL Swipe_Deck のファイルと、そのファイルを指す再エクスポートを含まない。
2. THE Mode_Manager SHALL Tourism_Tabs に `swipe` を含まない。
3. THE Mode_Manager SHALL 通常観光モードの既定タブとして `map` を返す。
4. THE Tourism_Store SHALL `swipeCandidates`、`hasCandidates`、`swipeHistory`、`recordSwipe`、`clearCandidates`、`addToLater`、`later` を公開しない。
5. THE Codebase SHALL Swipe_Domain のモジュールと、そのモジュールを指す再エクスポートを含まない。
6. THE Codebase SHALL `SwipePreferences` の型宣言と、その型への参照を含まない。
7. THE Layer_Builder SHALL コレクション引数として Favorites_List と Shiori_List のみを受け取る。
8. THE Codebase SHALL `LayerKind` の要素に `later` を含まない。
9. THE Tourism_Layered_Map SHALL レイヤー選択肢に「後で見る」を表示しない。
10. THE Codebase SHALL 接頭辞 `swipe.` を持つ表示文言キーと、`tlmap.layer.later` の文言キーを含まない。
11. THE Tab_Content_Registry SHALL Tourism_Tabs の全タブIDに対応する画面を登録する。
12. THE Mode_Shell SHALL 通常観光モードのタブとして地図、お気に入り、しおりの3件を表示する。

### Requirement 8: 変更後の整合性検証

**User Story:** 開発者として、削除と統合の後にビルド・型検査・テストが通る状態を保ちたい。壊れた状態を残したまま次の作業に進みたくないため。

#### Acceptance Criteria

1. WHEN Type_Check を実行する、THE Codebase SHALL 型エラー0件で完了する。
2. WHEN Test_Suite を実行する、THE Codebase SHALL 全テストの成功で完了する。
3. WHEN Mode_Manager のテストを実行する、THE Test_Suite SHALL 通常観光モードの既定タブが `map` であることを検証する。
4. THE Codebase SHALL Requirement 1 の変換規則を検証する自動テストを含む。
5. THE Codebase SHALL Interest_Decision によるお気に入り登録を検証する自動テストを含む。
6. THE Codebase SHALL Favorites_Storage_Key を用いた保存と復元の往復を検証する自動テストを含む。
7. THE Codebase SHALL Start_Trip_Action による Shiori_List への統合を検証する自動テストを含む。
