# Requirements Document

## Introduction

AIプラン提案画面（`/api/recommendations`）が HTTP 502 を返し、「AIバックエンドでエラーが発生しました（HTTP 502）」と表示されたまま利用者が旅程を1件も選べない事象が発生している。さらにエラー画面の「もう一度生成」がリフレッシュ枠を消費するため、再試行が HTTP 429（`Please wait before refreshing recommendations`）になり、利用者が何も選べない詰み状態に陥る。

本機能では、Recommendation_API の失敗経路を「必ず5件の旅程を返す縮退応答」に置き換える。Bedrock 呼び出し失敗・生成結果の契約違反・立寄先検証の不足が起きた場合は、Stale_Cache_Entry → Fallback_Plan_Pool の順で代替プランを合成して HTTP 200 で返し、AI生成が一時的に利用できないことを Plan_First_Screen 上に控えめに告知する。加えて、立寄先検証の部分成功を破棄せず保持し、Bedrock のスロットリングに対して短いバックオフ再試行を行い、Refresh_Rate_Limiter を「成功後の意図的な再生成」にのみ適用する。

推薦プランのデータ契約（ちょうど5件、各 stop の `time` 昇順・`kind`・`place.location`）は変更しない。スワイプ候補生成（`api/route-candidates.ts`）およびテーマ生成プロンプトの 5km 制約は本機能の対象外とする。

## Glossary

- **Recommendation_API**: 推薦プラン生成エンドポイント `api/recommendations.ts`
- **Plan_Generator**: Recommendation_API 内で Bedrock 生成・正規化・検証・再試行を行う処理（`generateRecommendations` と、それを包む再試行ラッパー）
- **Bedrock_Client**: Bedrock 呼び出しラッパー `invokeClaude`（`api/_bedrock.ts`）。HTTP 失敗時は `Bedrock HTTP {status}` 形式のメッセージで失敗する
- **Place_Enricher**: Google Places による立寄先検証・座標付与処理 `enrichPlans`（`api/recommendations.ts`）
- **Verified_Plan**: Place_Enricher による検証を通過し、Itinerary_Contract を満たす立寄先を2件以上持つプラン
- **Recommendation_Cache**: Recommendation_API のインメモリ応答キャッシュ `recommendationCache`
- **Cache_TTL**: Recommendation_Cache の鮮度期限 15分
- **Stale_Retention**: Cache_TTL 経過後も縮退応答の代替として保持する期間 24時間
- **Stale_Cache_Entry**: Cache_TTL を過ぎ、Stale_Retention 以内である Recommendation_Cache のエントリ
- **Fallback_Plan_Pool**: `api/` から参照可能な収録済み愛媛旅程プラン集合。`src/adapters/mock/chat.ts` の `MOCK_RECOMMENDATIONS` および `src/data/fallbackPools.ts` を出自とする
- **Bridge_Module**: `api/` から `src/` を参照する唯一の窓口となる underscore 接頭辞モジュール（規約例: `api/_fallback-candidates.ts`）
- **Plan_Count**: 推薦プランの必要件数 5
- **Itinerary_Contract**: クライアント側の検証条件 `isTourismRecommendations`（`src/ui/screens/AIPlanFirst.tsx`）。ちょうど Plan_Count 件、`mode` が `tourism`、各プランの stops が2〜4件、各 stop が 24時間制 `HH:MM` の厳密昇順 `time`、`sightseeing` / `food` / `cafe` / `custom` のいずれかの `kind`、非空の `title`、有限数の `place.location.lat` / `place.location.lng` を持つこと
- **Plan_Origin**: 応答に含める各プランの出自識別子。`ai`（Bedrock 生成）、`cache`（Stale_Cache_Entry 由来）、`fallback`（Fallback_Plan_Pool 由来）のいずれか
- **Degraded_Response**: Plan_Origin が `ai` 以外のプランを1件以上含む HTTP 200 応答
- **Degraded_Flag**: Degraded_Response であることを示す応答本文の真偽値フィールド
- **Retry_Budget**: Plan_Generator が再試行に費やせる累積経過時間の上限 20,000ms
- **Backoff_Delays**: 再試行開始前に挿入する待機時間の列 300ms、900ms
- **Retryable_Failure**: 再試行が有効な失敗。Bedrock_Client の HTTP 429 および HTTP 5xx、ならびに生成結果の契約違反
- **Fatal_Failure**: 再試行しても解消しない失敗。Bedrock_Client の HTTP 400 / 401 / 403 / 404、および `AccessDeniedException`、`CredentialsProviderError`、`ResourceNotFoundException`、`UnrecognizedClientException`、`ValidationException`
- **Refresh_Rate_Limiter**: リフレッシュ間隔を制御するインメモリ機構 `refreshAllowedAt`（`api/recommendations.ts`）
- **Refresh_Interval**: Refresh_Rate_Limiter が同一クライアントに課す最小間隔 60秒
- **Intentional_Refresh**: 一覧表示済みの状態から利用者が ↻ ボタンを押して行う意図的な再生成
- **Recovery_Retry**: 取得失敗またはエラー表示の状態から利用者が再試行操作を行う取得
- **AWS_Chat_Adapter**: クライアント側 API 呼び出しアダプタ `src/adapters/aws/chat.ts`
- **Plan_First_Screen**: AIプラン提案画面 `src/ui/screens/AIPlanFirst.tsx`
- **Degraded_Notice**: AI生成が一時的に利用できないことを Plan_First_Screen 上で伝える注記
- **I18n_Labels**: 表示文言辞書 `src/i18n/labels.ts`。`ja` / `en` / `iyo` の3言語を持つ
- **Exclusion_List**: Intentional_Refresh 要求に含まれる過去候補の除外指定（`exclude`）
- **Test_Suite**: `npm test`（`vitest run`）で実行される自動テスト。プロパティテストには fast-check を用いる

## Requirements

### Requirement 1: 生成失敗時も旅程を選べる縮退応答

**User Story:** 旅行者として、AI生成が失敗した日でも今日の旅程を5件見て選びたい。エラー画面だけを見せられると何もできず旅行の計画が止まってしまうため。

#### Acceptance Criteria

1. WHEN Plan_Generator が Verified_Plan を Plan_Count 件そろえられずに終了する、THE Recommendation_API SHALL Stale_Cache_Entry と Fallback_Plan_Pool を用いて Plan_Count 件のプランを合成し、HTTP ステータス 200 で返す。
2. WHEN 縮退応答のプランを合成する、THE Recommendation_API SHALL Verified_Plan を先頭に、次に Stale_Cache_Entry のプラン、次に Fallback_Plan_Pool のプランの順で採用する。
3. THE Recommendation_API SHALL 縮退応答に含める各プランに Plan_Origin を付与する。
4. THE Recommendation_API SHALL Degraded_Response の本文に Degraded_Flag を含める。
5. THE Recommendation_API SHALL Plan_Origin が `ai` のプランのみで構成される応答に、Degraded_Flag として偽を設定する。
6. IF Fallback_Plan_Pool を用いた合成後もプラン件数が Plan_Count に満たない、THEN THE Recommendation_API SHALL HTTP ステータス 502 と失敗内容を返す。
7. WHEN Degraded_Response を返す、THE Recommendation_API SHALL 応答ヘッダー `Cache-Control` に `private, no-store` を設定する。
8. WHEN Degraded_Response を返す、THE Recommendation_API SHALL 縮退の分類（Bedrock 呼び出し失敗、生成結果の契約違反、立寄先検証の不足のいずれか）と採用した Plan_Origin の内訳をサーバーログに出力する。
9. THE Recommendation_API SHALL Degraded_Response の内容を Recommendation_Cache に格納しない。

### Requirement 2: 縮退応答のデータ契約適合

**User Story:** 開発者として、縮退応答も通常応答と同じ契約を満たしてほしい。クライアント側の検証で弾かれると縮退の意味がなくなるため。

#### Acceptance Criteria

1. THE Recommendation_API SHALL HTTP ステータス 200 で返す応答に、ちょうど Plan_Count 件のプランを含める。
2. THE Recommendation_API SHALL 応答に含める全プランが Itinerary_Contract を満たすことを、応答送信前に検証する。
3. THE Fallback_Plan_Pool SHALL 各プランの stops を2件以上4件以下とし、各 stop に 24時間制 `HH:MM` 形式で厳密昇順の `time`、`sightseeing` / `food` / `cafe` / `custom` のいずれかの `kind`、有限数の `place.location.lat` および `place.location.lng` を与える。
4. THE Recommendation_API SHALL 応答内で `id` が重複するプランを1件のみ保持する。
5. THE Recommendation_API SHALL 応答内で正規化後のタイトルが一致するプランを1件のみ保持する。
6. THE Recommendation_API SHALL 応答内で先頭 stop の `place.id` が一致するプランを1件のみ保持する。
7. WHERE 要求に Exclusion_List が含まれる、THE Recommendation_API SHALL Exclusion_List に一致しないプランを優先して採用し、Plan_Count に達しない場合に限り Exclusion_List に一致するプランを追加して Plan_Count を満たす。
8. IF Fallback_Plan_Pool のプランが Itinerary_Contract を満たさない、THEN THE Test_Suite SHALL 当該プランを検出して失敗する。

### Requirement 3: 共有モジュール参照規約の遵守

**User Story:** 開発者として、フォールバックプランをサーバーとモックの両方から同じ定義で使いたい。定義が二重化すると契約違反が片方だけに残るため。

#### Acceptance Criteria

1. THE Recommendation_API SHALL Fallback_Plan_Pool を Bridge_Module 経由で参照する。
2. THE Fallback_Plan_Pool SHALL DOM API、React、`import.meta`、および環境変数を参照しない実装で構成される。
3. THE Bridge_Module SHALL `src/` からの再エクスポートのみを行い、プラン生成ロジックを保持しない。

### Requirement 4: 立寄先検証の部分成功の保持

**User Story:** 旅行者として、5件のうち1件だけ場所が確認できなかったからといって全件が消える結果は避けたい。確認できた旅程はそのまま見せてほしいため。

#### Acceptance Criteria

1. WHEN 一部のプランが Verified_Plan の条件を満たさない、THE Place_Enricher SHALL 条件を満たしたプランを保持した結果を返す。
2. WHEN あるプランが Verified_Plan の条件を満たさない、THE Place_Enricher SHALL 当該プランの `id` と不足理由をサーバーログに出力する。
3. WHEN Verified_Plan の件数が Plan_Count に満たない、THE Recommendation_API SHALL 不足件数分を Requirement 1 の採用順で補って Plan_Count を満たす。
4. IF Verified_Plan が0件である、THEN THE Recommendation_API SHALL Stale_Cache_Entry と Fallback_Plan_Pool のみで Plan_Count 件を構成する。
5. WHEN 生成結果に Exclusion_List と重複するプランまたは相互に重複するプランが含まれる、THE Recommendation_API SHALL 重複するプランを除外し、残ったプランを保持する。
6. THE Recommendation_API SHALL Verified_Plan の件数が Plan_Count に一致する場合に限り、当該結果を Plan_Origin `ai` のみの応答として返す。

### Requirement 5: スロットリング時のバックオフ再試行

**User Story:** 旅行者として、AIが一時的に混雑しているだけなら数秒待ってでも本物の提案を見たい。ただし待たされ続けるくらいなら代替の旅程を早く見せてほしい。

#### Acceptance Criteria

1. WHEN Retryable_Failure が発生する、THE Plan_Generator SHALL Backoff_Delays の次の待機時間だけ待機した後に生成を再試行する。
2. THE Plan_Generator SHALL 生成試行を最大3回まで行う。
3. WHEN 再試行を開始しようとした時点で開始からの経過時間が Retry_Budget を超えている、THE Plan_Generator SHALL 再試行を行わず、その時点の結果を Recommendation_API に返す。
4. IF Fatal_Failure が発生する、THEN THE Plan_Generator SHALL 再試行を行わず、その時点で失敗を Recommendation_API に返す。
5. WHEN Plan_Generator が再試行せずに失敗を返す、THE Recommendation_API SHALL Requirement 1 の縮退応答を返す。
6. WHEN 再試行を行う、THE Plan_Generator SHALL 試行回数、経過時間、および失敗内容をサーバーログに出力する。

### Requirement 6: レートリミットの適用条件

**User Story:** 旅行者として、失敗した取得のせいで次の試行が60秒ブロックされる事態を避けたい。失敗と待機が交互に来ると旅程を1件も選べないため。

#### Acceptance Criteria

1. THE Recommendation_API SHALL Refresh_Rate_Limiter による HTTP 429 を、Intentional_Refresh に該当する要求に対してのみ適用する。
2. WHEN Plan_Origin `ai` のみで構成される応答を返す、THE Recommendation_API SHALL 当該クライアントの次回リフレッシュ許可時刻を Refresh_Interval 後に更新する。
3. WHEN Degraded_Response を返す、THE Recommendation_API SHALL 当該クライアントの次回リフレッシュ許可時刻を更新しない。
4. WHEN HTTP ステータス 400、405、または 502 の応答を返す、THE Recommendation_API SHALL 当該クライアントの次回リフレッシュ許可時刻を更新しない。
5. WHEN Refresh_Rate_Limiter が要求を拒否する、THE Recommendation_API SHALL HTTP ステータス 429、`Retry-After` ヘッダーに残り秒数、および待機を促すエラーメッセージを返す。
6. THE Recommendation_API SHALL Exclusion_List の形式違反に対して HTTP ステータス 400 と違反内容を返す。
7. THE Recommendation_API SHALL 要求パラメータ `schema`、`count`、`date` の検証違反に対して HTTP ステータス 400 と違反内容を返す。

### Requirement 7: クライアント側の再試行導線

**User Story:** 旅行者として、失敗後の再試行がすぐに実行されてほしい。再試行が「意図的な再生成」として扱われて待機を求められるのは納得できないため。

#### Acceptance Criteria

1. WHEN Recovery_Retry を実行する、THE AWS_Chat_Adapter SHALL HTTP メソッド GET で Recommendation_API を呼び出し、`refresh` 指定と Exclusion_List を送信しない。
2. WHEN Intentional_Refresh を実行する、THE AWS_Chat_Adapter SHALL HTTP メソッド POST で Recommendation_API を呼び出し、`refresh` 指定と Exclusion_List を送信する。
3. WHEN Recovery_Retry を実行する、THE Plan_First_Screen SHALL 直前の失敗した取得結果を破棄したうえで新しい取得を開始する。
4. WHEN 取得が HTTP ステータス 429 で失敗する、THE AWS_Chat_Adapter SHALL 応答ヘッダー `Retry-After` の秒数を含む待機案内メッセージを生成する。
5. IF 応答ヘッダー `Retry-After` が整数秒として解釈できない、THEN THE AWS_Chat_Adapter SHALL Refresh_Interval の秒数を待機案内メッセージに用いる。
6. WHILE Intentional_Refresh が進行中である、THE Plan_First_Screen SHALL 表示中のプラン一覧を保持し、↻ ボタンを操作不可にする。
7. WHEN Intentional_Refresh が失敗する、THE Plan_First_Screen SHALL 表示中のプラン一覧を保持したまま失敗理由を提示する。

### Requirement 8: 縮退状態の利用者への提示

**User Story:** 旅行者として、いま見ているプランがAI生成でないなら控えめに知らせてほしい。理由が分からないまま同じ内容が並ぶと不信感につながるため。

#### Acceptance Criteria

1. WHEN Degraded_Flag が真の応答を受け取る、THE Plan_First_Screen SHALL プラン一覧を表示し、あわせて Degraded_Notice を表示する。
2. THE Plan_First_Screen SHALL Degraded_Notice を注記として表示し、エラー表示（`role="alert"`）としては表示しない。
3. WHEN Degraded_Flag が真の応答を受け取る、THE Plan_First_Screen SHALL Plan_Count 件すべてのプランを選択可能な状態で表示する。
4. WHEN Degraded_Flag が真の応答を受け取る、THE Plan_First_Screen SHALL 当該プランをセッションストレージに保存しない。
5. WHEN Degraded_Flag が偽の応答を受け取る、THE Plan_First_Screen SHALL Degraded_Notice を表示しない。
6. THE I18n_Labels SHALL Degraded_Notice の文言を `ja`、`en`、`iyo` の3言語で提供する。
7. THE Plan_First_Screen SHALL Degraded_Notice に基盤サービス名および内部エラー内容を含めない。

### Requirement 9: 回帰の自動検証

**User Story:** 開発者として、詰み状態が再発しないことをテストで固定したい。失敗経路は手動では再現しにくいため。

#### Acceptance Criteria

1. THE Test_Suite SHALL Bedrock_Client が HTTP 500 で失敗する条件で、Recommendation_API が HTTP ステータス 200 と Plan_Count 件のプランを返すことを検証する。
2. THE Test_Suite SHALL Place_Enricher が一部のプランのみ検証できる条件で、Recommendation_API が Verified_Plan を保持したまま Plan_Count 件のプランを返すことを検証する。
3. THE Test_Suite SHALL Degraded_Response の直後に行う Intentional_Refresh が HTTP ステータス 429 にならないことを検証する。
4. THE Test_Suite SHALL Plan_Origin `ai` のみの応答の直後に行う Intentional_Refresh が Refresh_Interval 以内で HTTP ステータス 429 になることを検証する。
5. THE Test_Suite SHALL 任意の失敗の組み合わせに対して Recommendation_API の HTTP 200 応答が Itinerary_Contract を満たすことを、fast-check によるプロパティテストで検証する。
6. THE Test_Suite SHALL Fatal_Failure の発生時に Plan_Generator が Bedrock_Client を1回だけ呼び出すことを検証する。
