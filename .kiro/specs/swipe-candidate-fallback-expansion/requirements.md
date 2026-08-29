# Requirements Document

## Introduction

AIプランでテーマを選択した後に表示されるスワイプ候補（TourismRouteBuilder）が、5km 圏内という距離制約のため「1 / 1件」しか提示されない事象が発生している。本機能では、Google Places 由来の候補が下限件数に届かない場合に、ローカルデータ（お遍路の札所・愛媛スポットカタログ）による補完と検索半径の段階的拡大を行い、スワイプで選べる候補を最低5件確保する。補完された候補は UI 上で区別して表示し、下限に届かない場合は注記を表示する。テーマ生成側（推薦の立寄先）の 5km 制約は変更しない。

## Glossary

- **Candidate_API**: サーバー側のスワイプ候補生成エンドポイント `api/route-candidates.ts`
- **Route_Builder**: スワイプ候補提示・ルート編集画面 `src/ui/screens/TourismRouteBuilder.tsx`
- **Mock_Candidate_Adapter**: モック候補生成関数 `mockRouteCandidates`（`src/adapters/mock/chat.ts`）
- **Candidate_Provider**: Candidate_API、Mock_Candidate_Adapter、および Route_Builder の最終ガードを含む、候補件数を確定させる処理の総称
- **Primary_Candidate**: Bedrock 提案と Google Places 検証を通過して得られた候補
- **Fallback_Candidate**: ローカルデータ（Temple_Dataset または Spot_Dataset）から補完された候補
- **Temple_Dataset**: 札所データ `TEMPLE_GEO`（`src/data/templeGeo.ts`）および `TEMPLE_DETAILS`（`src/data/templeDetails.ts`）
- **Spot_Dataset**: 愛媛スポットカタログ `EHIME_SPOTS`（`src/adapters/mock/spots.ts`）
- **Area**: 候補探索の対象領域。中心座標 `center` と半径 `radiusMeters` を持つ
- **Base_Radius**: Area の基準半径 5,000m
- **Expansion_Radii**: 補完時に順に適用する拡大半径の列 10,000m、20,000m
- **Minimum_Count**: スワイプ候補の下限件数 5
- **Maximum_Count**: スワイプ候補の上限件数 8
- **Shortage_Notice**: 候補が Minimum_Count に届かないことを利用者に伝える UI 上の注記
- **Temple_Tag**: Fallback_Candidate のうち札所由来であることを示す UI 上のタグ表示
- **Center_Distance**: Area の中心座標から候補地点までの直線距離（メートル）
- **I18n_Labels**: 表示文言辞書 `src/i18n/labels.ts` の `routeBuilder.*` キー群
- **Recommendation_API**: テーマ・推薦生成エンドポイント `api/recommendations.ts`

## Requirements

### Requirement 1: 候補下限件数の確保

**User Story:** 旅行者として、テーマ選択後のスワイプで十分な数の候補を見たい。1件しか出ないと選ぶ余地がなくルートを組めないため。

#### Acceptance Criteria

1. WHEN 種別 `sightseeing` のスワイプ候補要求を受け取る、THE Candidate_Provider SHALL 候補件数が Minimum_Count 以上 Maximum_Count 以下になるよう候補集合を確定する。
2. WHEN Primary_Candidate の件数が Minimum_Count 未満である、THE Candidate_Provider SHALL Fallback_Candidate を追加して不足分を補う。
3. WHILE 候補集合の件数が Maximum_Count に達している、THE Candidate_Provider SHALL それ以上の候補追加を停止する。
4. THE Candidate_Provider SHALL 同一 `place.id` を持つ候補を候補集合内で1件のみ保持する。
5. THE Candidate_Provider SHALL 現在ルートに既に含まれる立寄先と同一の `placeId` を持つ候補を候補集合から除外する。
6. WHERE 要求に候補件数 `count` が指定されている、THE Candidate_API SHALL `count` を Minimum_Count 以上 Maximum_Count 以下の範囲に丸めて使用する。

### Requirement 2: ローカルデータによる補完

**User Story:** 旅行者として、周辺に候補が少ないエリアでもお遍路の札所など実在の行き先を提示してほしい。空振りの画面で行き止まりになりたくないため。

#### Acceptance Criteria

1. WHEN Fallback_Candidate を選定する、THE Candidate_Provider SHALL Base_Radius 圏内の Temple_Dataset および Spot_Dataset の地点を最初の補完元として使用する。
2. THE Candidate_Provider SHALL Fallback_Candidate を Center_Distance の昇順で選定する。
3. WHEN 種別が `sightseeing` である、THE Candidate_Provider SHALL Spot_Dataset のうち category が `food` である地点を Fallback_Candidate から除外する。
4. THE Candidate_Provider SHALL 各 Fallback_Candidate に、Primary_Candidate と同一の構造（`id`、`kind`、`title`、`description`、`searchQuery`、`place.location` を含む）を与える。
5. IF Temple_Dataset の地点が `TEMPLE_DETAILS` の説明を持たない、THEN THE Candidate_Provider SHALL 札所名を用いた既定の説明文を `description` に設定する。
6. THE Candidate_Provider SHALL Fallback_Candidate であることを判別できる属性を各候補に付与する。

### Requirement 3: 検索半径の段階的拡大

**User Story:** 旅行者として、近隣に候補がないときは少し足を延ばした行き先まで見せてほしい。5km に閉じたままでは選択肢が生まれないため。

#### Acceptance Criteria

1. WHEN Base_Radius 圏内の補完後も候補件数が Minimum_Count 未満である、THE Candidate_Provider SHALL Expansion_Radii を小さい順に適用して候補探索を再実行する。
2. WHILE 候補件数が Minimum_Count 未満である、THE Candidate_Provider SHALL 未適用の Expansion_Radii が残る限り次の拡大半径を適用する。
3. WHEN 候補件数が Minimum_Count に達する、THE Candidate_Provider SHALL 半径拡大を停止する。
4. IF Expansion_Radii の最大値 20,000m を適用しても候補件数が Minimum_Count 未満である、THEN THE Candidate_Provider SHALL その時点で集まった候補集合を結果として返す。
5. IF 半径拡大後も候補件数が 0 件である、THEN THE Candidate_API SHALL HTTP ステータス 502 とエラー内容を返す。
6. THE Candidate_API SHALL 応答に、候補確定時に適用された半径（メートル）と要求された下限件数を含める。

### Requirement 4: クライアント側の最終ガード

**User Story:** 開発者として、サーバー応答が下限件数に届かない場合でもスワイプ画面が破綻しないようにしたい。単一の防御層では不足するため。

#### Acceptance Criteria

1. WHEN Candidate_API から候補を受け取る、THE Route_Builder SHALL 応答に含まれる適用半径を用いて候補の距離判定を行う。
2. WHEN Candidate_API から受け取った候補件数が Minimum_Count 未満である、THE Route_Builder SHALL Temple_Dataset および Spot_Dataset から Fallback_Candidate を追加して Maximum_Count を上限に補完する。
3. IF 補完後も候補件数が 0 件である、THEN THE Route_Builder SHALL 読み込みエラー状態を表示し再試行操作を提示する。
4. WHEN スワイプ候補の要求を開始する、THE Route_Builder SHALL Area の半径として Base_Radius を初期値として送信する。

### Requirement 5: 補完候補の区別表示

**User Story:** 旅行者として、どの候補が近隣枠を広げて出てきたものかを知りたい。移動距離を踏まえて選びたいため。

#### Acceptance Criteria

1. WHERE 候補が札所由来の Fallback_Candidate である、THE Route_Builder SHALL 既存の Tag コンポーネントで Temple_Tag を表示する。
2. THE Route_Builder SHALL 各候補カードに Center_Distance を表示する。
3. THE Route_Builder SHALL Center_Distance が 1,000m 未満の場合はメートル単位、1,000m 以上の場合は小数第1位までのキロメートル単位で表示する。
4. IF 候補件数が Minimum_Count 未満である、THEN THE Route_Builder SHALL Shortage_Notice を表示する。
5. THE Route_Builder SHALL Shortage_Notice に確定した候補件数を含める。

### Requirement 6: モックアダプタの挙動一致

**User Story:** 開発者として、モック環境でも本番と同じ候補件数の挙動を再現したい。AWS 未設定の開発・テスト時に差異で判断を誤らないため。

#### Acceptance Criteria

1. WHEN 種別 `sightseeing` の候補要求を受け取る、THE Mock_Candidate_Adapter SHALL Requirement 2 および Requirement 3 と同一の補完規則および半径拡大規則を適用する。
2. THE Mock_Candidate_Adapter SHALL 候補件数を Minimum_Count 以上 Maximum_Count 以下に収める。ただし 20,000m 適用後も不足する場合は集まった件数を返す。
3. THE Mock_Candidate_Adapter SHALL Fallback_Candidate に Candidate_API と同一の判別属性を付与する。
4. THE Mock_Candidate_Adapter SHALL 種別 `food`、`cafe`、`custom` の既存の絞り込み挙動を維持する。

### Requirement 7: 表示文言の多言語対応

**User Story:** 訪日旅行者として、札所タグや距離、件数不足の注記を自分の言語で読みたい。日本語のみでは意味が分からないため。

#### Acceptance Criteria

1. THE I18n_Labels SHALL Temple_Tag の文言キーを保持する。
2. THE I18n_Labels SHALL Center_Distance の表示書式キーを、メートル表記とキロメートル表記の双方について保持する。
3. THE I18n_Labels SHALL Shortage_Notice の文言キーを保持する。
4. THE I18n_Labels SHALL 追加する各キーについて、既存の `routeBuilder.*` キーが定義している全言語（ja、en、iyo）の訳を保持する。
5. THE Route_Builder SHALL Temple_Tag、Center_Distance、Shortage_Notice の文言を I18n_Labels 経由で取得する。

### Requirement 8: 既存不変条件の保持

**User Story:** 開発者として、今回の変更がテーマ推薦側の距離保証を壊さないことを保証したい。既存のテストと体験を維持するため。

#### Acceptance Criteria

1. THE Recommendation_API SHALL 立寄先の探索半径 5,000m を変更せずに維持する。
2. THE Mock_Candidate_Adapter SHALL 推薦テーマの立寄先を2件以上4件以下、かつ相互距離が 5,000m 以内に収める既存の不変条件を維持する。
3. THE Candidate_Provider SHALL 半径拡大および Fallback_Candidate の適用範囲をスワイプ候補生成に限定する。
4. WHEN 種別が `food`、`cafe`、または `custom` である、THE Candidate_Provider SHALL 既存の候補生成挙動を維持する。
