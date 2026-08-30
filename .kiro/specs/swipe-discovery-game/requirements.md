# Requirements Document

## Introduction

単独のスワイプ画面は前機能（`swipe-favorites-itinerary`）で削除された。プラン作成フローの中にある2方向スワイプ（`BinarySwipeDeck`）だけが残っており、テーマ選択とルート構築を通過しないとスワイプに到達できない。「暇なときに眺めたい」という使い方ができず、削除前の4方向スワイプ画面も候補の供給元を失っていたため復活させる対象にはならない。

本機能では、スワイプを**愛媛のスポットを集めるゲーム**として作り直し、下タブから直接到達できる独立した画面として追加する。実現する内容は次の4点。

1. **発見タブの追加** — 下タブを マップ／発見／お気に入り／しおり の4件にし、`Route_Builder` の進行状況に依存せず発見画面へ到達できるようにする。
2. **収集・コンプリート型のゲーム性** — スポットカタログ全件を分母とした達成率ゲージと、エリア別・カテゴリ別のバッジを提示する。判定したスポットの記録は端末に永続化し、アプリを開き直しても続きから進められる。
3. **Google Places 写真の表示** — カードに出したスポットだけ `POST /places/lookup` で写真を取得し、Places の帰属表示を同じカード内に出す。取得結果は端末にキャッシュして、同じスポットを二度取得しない。
4. **お気に入りの一本化** — 発見画面の「興味あり」と、プラン作成の `BinarySwipeDeck` の「興味あり」の両方が、区別のない単一のお気に入りへ入る。

判定は「興味あり」「興味なし」の2方向のみとする。しおりへの流入は従来どおりルート確定経由だけを維持し、削除済みの `later` / 後で見る / 4方向判定は復活させない。

`BinarySwipeDeck` の「興味あり」からお気に入りへの登録は前機能で実装・テスト済みであり、本機能では**保持すべき不変条件**として扱う（Requirement 9）。

### 対象外

- 発見画面以外（お気に入り、しおり、マップのスポット詳細パネル）への Places 写真取得の拡張。写真取得は課金対象であり、取得範囲を発見画面に限定する。
- `Route_Builder` 由来のお気に入り／しおり項目が `imageUrls` に Places 写真URLを持ちながら帰属表示を伴わない既存の挙動の是正。既存仕様の変更は本機能の範囲に含めない。ただし本機能が新たに作る経路では同じ状態を作らない（AC 9.2）。
- しおりへの直接追加操作、4方向判定、`later` コレクションの復活。

### 設計に委ねる論点

- `Seen_Record` 用および `Photo_Cache` 用の `StorageKey` 文字列リテラル。
- エリア区分の境界定義（座標からエリアを決める規則）。`Area_Classifier` が全件をちょうど1つのエリアへ割り当てることは AC 4.5 で要求する。
- `Spot.id` から提示順の順位を決める関数の実装。決定性と順列性は AC 3.1、3.3、3.4 で要求する。
- ゲージとバッジの視覚表現、および `Discovery_Store` を既存の `TourismProvider` に統合するか新しい provider として置くか。

## Glossary

### 画面・タブ

- **Application**: アプリ全体のシェルと画面遷移 `src/app/App.tsx`
- **Mode_Manager**: モード・タブの純粋ロジック `src/app/modeManager.ts`
- **Tourism_Tabs**: 通常観光モードのタブID一覧 `TOURISM_TABS`（`src/app/modeManager.ts`）
- **Mode_Shell**: 下部ナビゲーションを持つ画面シェル `src/ui/screens/ModeShell.tsx`
- **Tab_Content_Registry**: タブIDと画面の対応表 `TOURISM_TAB_CONTENT`（`src/ui/screens/tourismTabs.tsx`）。`Record<TourismTab, TourismTabRenderer>` として全域
- **Discovery_Screen**: 本機能で新規に追加する発見画面。タブID `discover` に対応する
- **Discovery_Deck**: Discovery_Screen 内の2方向スワイプデッキ
- **Favorites_View**: お気に入り画面 `src/ui/screens/FavoritesView.tsx`
- **Tourism_Layered_Map**: 重ねるマップ画面 `src/ui/screens/TourismLayeredMap.tsx`
- **Route_Builder**: プラン作成のルート構築画面 `src/ui/screens/TourismRouteBuilder.tsx`
- **Binary_Swipe_Deck**: Route_Builder 内の2方向スワイプUI `BinarySwipeDeck`

### 判定

- **Interest_Decision**: 「興味あり」判定。「興味あり」ボタン押下、右方向へ80ピクセル以上のドラッグ、または `ArrowRight` キーによって発生する
- **Skip_Decision**: 「興味なし」判定。「興味なし」ボタン押下、左方向へ80ピクセル以上のドラッグ、または `ArrowLeft` キーによって発生する

### データ・状態

- **Spot**: 観光スポットの型 `Spot`（`src/domain/types.ts`）
- **Spot_Catalogue**: `SpotPort.listSpots()` が返すスポット一覧。同梱の `EHIME_SPOTS`（`ehime-spots.generated.ts` + `ehime-food.curated.ts`）と、利用者が追加したスポットからなる
- **Tourism_Store**: 通常観光モードの共有状態 `TourismProvider` / `useTourism`（`src/app/TourismContext.tsx`）
- **Favorites_List**: Tourism_Store の `favorites: Spot[]`
- **Discovery_Store**: Discovery_Screen の状態（`Seen_Record`、`Deck_Position`、`Photo_Cache`）を保持する新規のストア
- **Seen_Record**: Interest_Decision または Skip_Decision を受けたスポットの `id` の集合
- **Deck_Position**: Discovery_Deck が現在表示しているカードの、提示順における位置
- **Deck_Order**: Spot_Catalogue と Seen_Record から提示順を決める新規の純粋関数
- **Progress_Module**: 達成率とバッジを計算する新規の純粋モジュール
- **Area_Classifier**: スポットをエリアへ割り当てる新規の純粋関数
- **Badge**: エリアまたは `Spot.category` を単位とする収集目標。当該グループの全スポットが Seen_Record に含まれたときに獲得済みとなる

### 写真

- **Places_Lookup_API**: `POST {apiEndpoint}/places/lookup`（`api/places/lookup.ts`）。`{ query, lang }` を受け、`{ place }` を返す。該当なしで HTTP 404、検索失敗で HTTP 502、`GOOGLE_MAPS_API_KEY` 未設定で HTTP 503 を返す
- **Places_Photo_API**: `GET /api/places/photo?name=...`（`api/places/photo.ts`）。写真リソース名を検証し、Places のメディアURLへ HTTP 302 でリダイレクトする
- **Recommended_Place**: Places_Lookup_API が返す場所情報の型 `RecommendedPlace`（`src/domain/types.ts`）。`photoUrl` は `/api/places/photo?name=...` という Places_Photo_API への相対パスであり、Google の署名付きURLではない
- **Photo_Resolver**: Discovery_Screen のために Places_Lookup_API を呼び出す新規の処理
- **Photo_Cache**: スポットの `id` をキーに `photoUrl` と `photoAttributions` を保持する端末上のキャッシュ
- **Fallback_Image_Set**: 写真が得られないカードに用いる同梱画像の集合。`public/images/ehime/` 配下のファイル（`Route_Builder` の `FALLBACK_IMAGE` と同じ供給元）
- **Api_Endpoint**: `awsEnv.apiEndpoint`（`src/config/env.ts`）。開発時は `VITE_AWS_API_ENDPOINT` 未設定なら `undefined`

### 永続化・文言・検証

- **Storage_Port**: 永続化ポート `StoragePort`（`src/ports/index.ts`）
- **Storage_Key**: 永続化キーの型 `StorageKey`（`src/domain/types.ts`）
- **Label_Dictionary**: 表示文言の辞書 `UI_LABELS`（`src/i18n/labels.ts`）。既存の各キーは `ja` / `en` / `zh-Hans` / `ko` / `fr` / `ar` / `iyo` の値を持ち、`resolveLabel` は未宣言の言語で `ja` の値、未知のキーでキー文字列自体を返す
- **Codebase**: 本リポジトリのソースツリー（`src/`、`api/`、`scripts/`）
- **Type_Check**: `npm run typecheck` および `npx tsc --noEmit -p api/tsconfig.json`
- **Test_Suite**: `npm test`（`vitest run`）

## Requirements

### Requirement 1: 発見タブの追加

**User Story:** 旅行者として、暇なときに下タブから直接スワイプ画面を開きたい。テーマ選択とルート構築を通過しないとスワイプに触れられない状態では、待ち時間に眺めるという使い方ができないため。

#### Acceptance Criteria

1. THE Mode_Manager SHALL Tourism_Tabs を `map`、`discover`、`favorites`、`shiori` の4件、この順序で宣言する。
2. THE Mode_Manager SHALL 通常観光モードの既定タブとして `map` を返す。
3. THE Mode_Shell SHALL 下部ナビゲーションに Tourism_Tabs の4件それぞれのラベルとアイコンを表示する。
4. THE Tab_Content_Registry SHALL Tourism_Tabs の全タブIDに対応する画面を登録する。
5. WHEN 利用者が下部ナビゲーションの `discover` を選択する、THE Mode_Shell SHALL Discovery_Screen を表示する。
6. THE Mode_Shell SHALL Discovery_Screen の表示を Route_Builder の進行状況および `activePlan` の有無に依存させない。
7. WHEN 利用者が `discover` から他のタブへ移動したうえで `discover` へ戻る、THE Discovery_Store SHALL 移動前の Seen_Record と Deck_Position を保持する。
8. THE Discovery_Screen SHALL 見出しと、画面の目的を説明する導入文を表示する。

### Requirement 2: 2方向スワイプ操作

**User Story:** 旅行者として、プラン作成のスワイプと同じ操作感で1件ずつ判定したい。画面ごとに操作方法が違うと覚え直す必要があるため。

#### Acceptance Criteria

1. THE Discovery_Deck SHALL 判定を Interest_Decision と Skip_Decision の2種類とする。
2. THE Discovery_Deck SHALL 1度に1件のスポットをカードとして表示する。
3. WHEN 利用者が「興味あり」ボタンを押下する、THE Discovery_Deck SHALL Interest_Decision を発生させる。
4. WHEN 利用者がカードを右方向へ80ピクセル以上ドラッグして離す、THE Discovery_Deck SHALL Interest_Decision を発生させる。
5. WHILE カードがキーボードフォーカスを持つ、WHEN 利用者が `ArrowRight` キーを押下する、THE Discovery_Deck SHALL Interest_Decision を発生させる。
6. WHEN 利用者が「興味なし」ボタンを押下する、THE Discovery_Deck SHALL Skip_Decision を発生させる。
7. WHEN 利用者がカードを左方向へ80ピクセル以上ドラッグして離す、THE Discovery_Deck SHALL Skip_Decision を発生させる。
8. WHILE カードがキーボードフォーカスを持つ、WHEN 利用者が `ArrowLeft` キーを押下する、THE Discovery_Deck SHALL Skip_Decision を発生させる。
9. IF ドラッグの水平移動量が80ピクセル未満のまま離される、THEN THE Discovery_Deck SHALL カードを初期位置へ戻し、判定を発生させない。
10. WHEN Interest_Decision または Skip_Decision が発生する、THE Discovery_Deck SHALL Deck_Position を1つ進め、次のスポットのカードを表示する。
11. THE Discovery_Deck SHALL カードにキーボードフォーカスを受け取る要素を1つ持ち、当該要素の読み上げ用ラベルへスポット名を設定する。
12. THE Discovery_Deck SHALL Interest_Decision と Skip_Decision の各操作を、テキストラベルを持つボタンとして提供する。
13. WHEN Interest_Decision または Skip_Decision が発生する、THE Discovery_Deck SHALL 読み上げ対象の進捗領域の内容を更新する。
14. WHILE ドラッグの水平移動量が20ピクセルを超える、THE Discovery_Deck SHALL 移動方向に対応する判定の予告表示をカード上に出す。

### Requirement 3: カードの提示順

**User Story:** 旅行者として、まだ見ていないスポットから順に出てきてほしい。既に判定した場所が繰り返し出ると、全部見るという目標が進まないため。

#### Acceptance Criteria

1. THE Deck_Order SHALL Spot_Catalogue の全スポットをちょうど1回ずつ含む列を返す。
2. THE Deck_Order SHALL Seen_Record に含まれないスポットを、Seen_Record に含まれるスポットより前に並べる。
3. THE Deck_Order SHALL 同じ区分（Seen_Record に含まれる／含まれない）に属するスポットを、`Spot.id` から決まる順位で並べる。
4. WHEN 同一の Spot_Catalogue と同一の Seen_Record を与えて2回呼び出される、THE Deck_Order SHALL 同一の順序の列を返す。
5. THE Deck_Order SHALL 入力の Spot_Catalogue と Seen_Record を変更しない。
6. WHEN Discovery_Screen が表示される、THE Discovery_Deck SHALL Deck_Order の先頭にある未判定のスポットからカードの表示を開始する。
7. IF Spot_Catalogue が空である、THEN THE Discovery_Screen SHALL 表示できるスポットが無いことを伝える案内文を表示する。

### Requirement 4: 達成率ゲージとバッジ

**User Story:** 旅行者として、愛媛のスポットを何件見たか、どのエリアとカテゴリを見終えたかを知りたい。全部見たいという目標があると、暇なときに開く理由になるため。

#### Acceptance Criteria

1. THE Discovery_Screen SHALL Seen_Record の件数と Spot_Catalogue の件数を、いずれも数値として表示する。
2. THE Progress_Module SHALL 達成率を、Seen_Record の件数を Spot_Catalogue の件数で割った値の小数点以下を切り捨てた0以上100以下の整数として返す。
3. THE Progress_Module SHALL 達成率の分母に Spot_Catalogue の全スポットを用いる。
4. THE Progress_Module SHALL Seen_Record のうち Spot_Catalogue に存在しない `id` を、達成率とバッジの件数に数えない。
5. THE Area_Classifier SHALL Spot_Catalogue の各スポットをちょうど1つのエリアへ割り当てる。
6. THE Progress_Module SHALL エリアを単位とするグループと `Spot.category` を単位とするグループのそれぞれについて、当該グループのスポット件数と、そのうち Seen_Record に含まれる件数を返す。
7. WHERE あるグループのスポット件数が1件以上であり、かつ当該グループの全スポットが Seen_Record に含まれる、THE Progress_Module SHALL 当該グループの Badge を獲得済みとして返す。
8. WHERE あるグループのスポット件数が0件である、THE Progress_Module SHALL 当該グループの Badge を返さない。
9. THE Discovery_Screen SHALL 獲得済みの Badge と未獲得の Badge を、視覚的な差異と読み上げ可能なテキストの両方で区別して表示する。
10. THE Discovery_Screen SHALL 未獲得の各 Badge について、当該グループの判定済み件数と総件数を表示する。
11. WHEN Interest_Decision または Skip_Decision が発生する、THE Discovery_Store SHALL 当該スポットの `id` を Seen_Record に追加する。
12. IF Seen_Record に当該 `id` が既に含まれる、THEN THE Discovery_Store SHALL Seen_Record を変更しない。
13. WHEN Seen_Record が変化する、THE Discovery_Screen SHALL 達成率、ゲージ、および Badge の表示を更新する。

### Requirement 5: 全件到達時の挙動

**User Story:** 旅行者として、全件見終わったことがはっきり分かってほしい。そのうえで、もう一度眺めたいときに眺められる状態であってほしい。

#### Acceptance Criteria

1. WHERE Spot_Catalogue の全スポットが Seen_Record に含まれる、THE Discovery_Screen SHALL 全件達成を伝える表示と「もう一度見る」操作を表示する。
2. WHILE Spot_Catalogue の全スポットが Seen_Record に含まれる、THE Progress_Module SHALL 達成率を100として返す。
3. WHEN 利用者が「もう一度見る」を実行する、THE Discovery_Deck SHALL Deck_Order の先頭からカードの表示を再開する。
4. WHEN 利用者が「もう一度見る」を実行する、THE Discovery_Store SHALL Seen_Record を変更しない。
5. WHILE 全件達成後の再周回を表示している、THE Discovery_Deck SHALL Interest_Decision と Skip_Decision を Requirement 2 と同じ操作で受け付ける。
6. WHEN 再周回中に Interest_Decision が発生する、THE Tourism_Store SHALL Requirement 9 と同じ規則で Favorites_List を更新する。

### Requirement 6: Google Places 写真の表示と帰属表示

**User Story:** 旅行者として、カードに実際の写真が出てほしい。名前と説明文だけのカードでは、行きたいかどうかを判断できないため。

#### Acceptance Criteria

1. WHEN Discovery_Deck が1件のスポットのカードを表示する、THE Photo_Resolver SHALL Places_Lookup_API へ当該スポットの `name` を `query`、現在の表示言語コードを `lang` として送る。
2. THE Photo_Resolver SHALL 取得対象を、現在表示しているカードのスポットと提示順で次に来る1件のスポットに限定する。
3. WHEN Places_Lookup_API が `photoUrl` を含む Recommended_Place を返す、THE Discovery_Deck SHALL 当該 `photoUrl` を当該カードの画像として表示する。
4. THE Discovery_Deck SHALL カード画像の代替テキストにスポット名を設定する。
5. WHERE 返された Recommended_Place が `photoAttributions` を1件以上持つ、THE Discovery_Deck SHALL 全ての `displayName` を当該カード内に表示する。
6. WHERE `photoAttributions` の要素が `uri` を持つ、THE Discovery_Deck SHALL 当該 `displayName` を当該 `uri` へのリンクとして表示する。
7. THE Discovery_Deck SHALL 帰属表示を、Places 由来の写真を表示しているカードの内部にのみ配置する。
8. THE Discovery_Deck SHALL カードにスポット名、`Spot.category` に対応するカテゴリ名、および現在の表示言語の説明文を表示する。
9. WHILE Places_Lookup_API の応答を待っている、THE Discovery_Deck SHALL カードの判定操作を受け付け可能な状態に保つ。
10. THE Photo_Resolver SHALL Api_Endpoint の末尾のスラッシュを除去したうえで `/places/lookup` を連結した URL を呼び出す。

### Requirement 7: 写真取得結果の端末キャッシュ

**User Story:** 旅行者として、同じスポットのカードを再表示したときに写真がすぐ出てほしい。開発者として、1件のスポットに対する課金対象の呼び出しを1回に抑えたい。

#### Acceptance Criteria

1. WHEN Places_Lookup_API が Recommended_Place を返す、THE Photo_Cache SHALL 当該スポットの `id` をキーとして `photoUrl` と `photoAttributions` を保存する。
2. WHERE あるスポットの `id` が Photo_Cache に登録されている、THE Photo_Resolver SHALL Places_Lookup_API を呼び出さずに Photo_Cache の値でカードの画像と帰属表示を構成する。
3. WHILE あるスポットの `id` が Photo_Cache に登録されている、THE Photo_Resolver SHALL 当該スポットに対する Places_Lookup_API の呼び出し回数を0に保つ。
4. WHEN Photo_Cache が変化する、THE Discovery_Store SHALL Storage_Port の `save` を、`favorites` および `shiori` とは異なる専用の Storage_Key で呼び出す。
5. WHEN Discovery_Store が初期化される、THE Discovery_Store SHALL Storage_Port の `load` を当該キーで呼び出して Photo_Cache を復元する。
6. WHILE Photo_Cache の初期復元が完了していない、THE Discovery_Store SHALL 当該キーへの保存を行わない。
7. THE Photo_Cache SHALL 保持する項目数を500件以下に保つ。
8. WHEN 新しい項目の追加によって項目数が500件を超える、THE Photo_Cache SHALL 追加時刻が最も古い項目を除去する。
9. IF Storage_Port の `load` が例外を投げるか想定した形式以外の値を返す、THEN THE Discovery_Store SHALL 空の Photo_Cache で動作を継続する。
10. IF Storage_Port の `save` が失敗する、THEN THE Discovery_Screen SHALL メモリ上の Photo_Cache を用いて操作を継続可能な状態に保つ。
11. THE Photo_Cache SHALL Places_Photo_API への相対パスである `photoUrl` をそのまま保存する。
12. WHEN 保存済みの Photo_Cache を復元する、THE Discovery_Deck SHALL 復元した `photoUrl` を画像の取得先として用いる。

### Requirement 8: 写真が得られないときの挙動

**User Story:** 旅行者として、写真が用意できないスポットでもカードが読める状態であってほしい。開発者として、Google の鍵が未設定な環境でも発見画面が動く状態にしたい。

#### Acceptance Criteria

1. THE Fallback_Image_Set SHALL `Spot.category` の各値に対して、リポジトリに同梱された画像ファイルのパスを1件対応させる。
2. IF Places_Lookup_API が HTTP 404 を返す、THEN THE Discovery_Deck SHALL 当該スポットの `Spot.category` に対応する Fallback_Image_Set の画像をカードの画像として表示する。
3. IF Places_Lookup_API が HTTP 502 を返す、THEN THE Discovery_Deck SHALL 当該スポットの `Spot.category` に対応する Fallback_Image_Set の画像をカードの画像として表示する。
4. IF Places_Lookup_API が HTTP 503 を返す、THEN THE Discovery_Deck SHALL 当該スポットの `Spot.category` に対応する Fallback_Image_Set の画像をカードの画像として表示する。
5. IF Places_Lookup_API への通信が例外で終わる、THEN THE Discovery_Deck SHALL 当該スポットの `Spot.category` に対応する Fallback_Image_Set の画像をカードの画像として表示する。
6. IF Api_Endpoint が未設定である、THEN THE Photo_Resolver SHALL Places_Lookup_API を呼び出さない。
7. WHERE Api_Endpoint が未設定である、THE Discovery_Deck SHALL 全てのカードに Fallback_Image_Set の画像を表示する。
8. IF カード画像の読み込みが失敗する、THEN THE Discovery_Deck SHALL 当該カードの画像を Fallback_Image_Set の画像へ切り替える。
9. IF 写真が得られない、THEN THE Discovery_Deck SHALL 当該カードのスポット名、カテゴリ名、および説明文の表示を継続し、判定操作を受け付け可能な状態に保つ。
10. IF 写真取得が失敗した、THEN THE Photo_Resolver SHALL 同一セッション内で当該スポットの Places_Lookup_API 呼び出しを再試行しない。
11. THE Photo_Resolver SHALL 写真取得の失敗記録をメモリ上のみに保持する。
12. WHEN Discovery_Screen が新しいセッションで表示される、THE Photo_Resolver SHALL 前のセッションで失敗したスポットについて Places_Lookup_API を再度呼び出す。

### Requirement 9: お気に入りへの一本化

**User Story:** 旅行者として、発見画面で「興味あり」にした場所と、プラン作成で「興味あり」にした場所を、ひとつのお気に入り欄でまとめて見たい。同じ意味の操作の結果が別の場所に散ると探し直す手間がかかるため。

#### Acceptance Criteria

1. WHEN Discovery_Deck で Interest_Decision が発生する、THE Tourism_Store SHALL 当該スポットを Favorites_List に追加する。
2. THE Discovery_Deck SHALL Favorites_List へ追加する値として Spot_Catalogue のスポットをそのまま用い、`imageUrls` を Places 由来の写真URLへ書き換えない。
3. IF Favorites_List に同一の `id` を持つスポットが既に存在する、THEN THE Tourism_Store SHALL Favorites_List を変更しない。
4. WHEN Discovery_Deck で Skip_Decision が発生する、THE Tourism_Store SHALL Favorites_List を変更しない。
5. THE Discovery_Deck SHALL 判定の結果として更新する Tourism_Store のコレクションを Favorites_List のみとする。
6. WHEN Binary_Swipe_Deck で Interest_Decision が発生する、THE Tourism_Store SHALL 当該候補を `spotFromRouteCandidate` で変換したスポットを Favorites_List に追加する既存の動作を維持する。
7. THE Favorites_View SHALL Discovery_Deck 由来のスポットと Binary_Swipe_Deck 由来のスポットを、同一の「すべて」タブおよび「スポット」タブに表示する。
8. THE Favorites_View SHALL お気に入りの表示分類を既存の `classifyFavoriteTabs` の結果のみに基づいて決める。
9. WHEN 利用者が Favorites_View の削除操作を実行する、THE Tourism_Store SHALL Favorites_List から当該 `id` のスポットを除去する。
10. WHEN Favorites_List から1件のスポットが除去される、THE Discovery_Store SHALL Seen_Record を変更しない。
11. WHEN Favorites_List が変化する、THE Tourism_Layered_Map SHALL お気に入りレイヤーのピンを更新する既存の動作を維持する。
12. WHEN Favorites_List が変化する、THE Tourism_Store SHALL `favorites` キーによる既存の永続化処理で Favorites_List を保存する。

### Requirement 10: 進捗の永続化

**User Story:** 旅行者として、アプリを開き直しても達成率とバッジが残っていてほしい。何件見たかが消えると、全部見るという目標が積み上がらないため。

#### Acceptance Criteria

1. WHEN Seen_Record が変化する、THE Discovery_Store SHALL Storage_Port の `save` を、`favorites`、`shiori`、および Photo_Cache のキーのいずれとも異なる専用の Storage_Key で呼び出す。
2. WHEN Discovery_Store が初期化される、THE Discovery_Store SHALL Storage_Port の `load` を当該キーで呼び出して Seen_Record を復元する。
3. WHILE Seen_Record の初期復元が完了していない、THE Discovery_Store SHALL 当該キーへの保存を行わない。
4. IF Storage_Port の `load` が例外を投げるか想定した形式以外の値を返す、THEN THE Discovery_Store SHALL 空の Seen_Record で動作を継続する。
5. IF Storage_Port の `save` が失敗する、THEN THE Discovery_Screen SHALL メモリ上の Seen_Record を用いて操作を継続可能な状態に保つ。
6. WHERE Storage_Port が Discovery_Store に注入されていない、THE Discovery_Store SHALL Seen_Record と Photo_Cache をメモリ上のみで保持する。
7. THE Discovery_Store SHALL Seen_Record、Photo_Cache、および Favorites_List の永続化を互いに独立に行い、いずれかの失敗が他の保存を妨げない状態を保つ。
8. WHEN 保存済みの Seen_Record を復元する、THE Progress_Module SHALL 保存時と同一の達成率および同一の Badge 獲得状態を返す。
9. THE Codebase SHALL Storage_Key に Seen_Record 用のキーと Photo_Cache 用のキーの2件を宣言する。

### Requirement 11: 表示文言

**User Story:** 旅行者として、選んだ言語で発見画面を読みたい。他の画面が翻訳されているのに1画面だけ日本語のままでは使えないため。

#### Acceptance Criteria

1. THE Label_Dictionary SHALL Discovery_Screen が表示する全ての固定文字列に対応するキーを宣言する。
2. THE Label_Dictionary SHALL Discovery_Screen 用のキーに接頭辞 `discover.` を用いる。
3. THE Label_Dictionary SHALL Discovery_Screen 用の各キーについて、`ja`、`en`、`zh-Hans`、`ko`、`fr`、`ar`、`iyo` の値を宣言する。
4. THE Discovery_Screen SHALL カテゴリ名の表示に既存の `spot.category.*` キーを用いる。
5. THE Label_Dictionary SHALL 下部ナビゲーションの `discover` タブ用のラベルキーを宣言する。
6. WHEN 利用者が表示言語を切り替える、THE Discovery_Screen SHALL 切替後の言語の文言を表示する。
7. WHERE 表示言語に対応する値が宣言されていない、THE Label_Dictionary SHALL `ja` の値を返す既存のフォールバックを適用する。
8. THE Discovery_Screen SHALL 件数を含む文言を、件数を差し込むプレースホルダーを持つキー1件で表現する。

### Requirement 12: 変更後の整合性検証

**User Story:** 開発者として、タブ追加と新画面の投入の後にビルド・型検査・テストが通る状態を保ちたい。削除済み機能が同時に戻っていないことも確認したい。

#### Acceptance Criteria

1. WHEN Type_Check を実行する、THE Codebase SHALL 型エラー0件で完了する。
2. WHEN Test_Suite を実行する、THE Codebase SHALL 全テストの成功で完了する。
3. WHEN Test_Suite を実行する、THE Test_Suite SHALL Tourism_Tabs が `map`、`discover`、`favorites`、`shiori` の4件に一致することを検証する。
4. WHEN Test_Suite を実行する、THE Test_Suite SHALL Tourism_Tabs に `chat` が含まれないことを検証する。
5. THE Codebase SHALL AI相談チャットの画面ファイル、`ChatPort` の `sendMessage` 宣言、および `/api/chat` のルート登録を含まない。
6. THE Codebase SHALL `later` コレクション、`later` レイヤー、および4方向判定に対応する状態と文言キーを含まない。
7. THE Codebase SHALL Deck_Order が Spot_Catalogue の順列を返すこと、未判定を先に並べること、および決定的であることを検証する自動テストを含む。
8. THE Codebase SHALL 達成率の算出と Badge の獲得条件を検証する自動テストを含む。
9. THE Codebase SHALL Area_Classifier が各スポットをちょうど1つのエリアへ割り当てることを検証する自動テストを含む。
10. THE Codebase SHALL Discovery_Deck の Interest_Decision による Favorites_List への登録と、Skip_Decision で Favorites_List が変化しないことを検証する自動テストを含む。
11. THE Codebase SHALL 同一スポットの Places_Lookup_API 呼び出しが Photo_Cache により1回に収まることを検証する自動テストを含む。
12. THE Codebase SHALL Seen_Record および Photo_Cache の保存と復元の往復を検証する自動テストを含む。
13. THE Codebase SHALL Places_Lookup_API の HTTP 404、HTTP 502、HTTP 503 の各応答時に Fallback_Image_Set の画像が用いられることを検証する自動テストを含む。
14. THE Codebase SHALL Discovery_Deck のボタン操作とキーボード操作の双方で判定が発生することを検証する自動テストを含む。
