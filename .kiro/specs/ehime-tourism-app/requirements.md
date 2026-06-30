# Requirements Document

## Introduction

愛媛（Ehime）の観光地を、有名どころ（道後温泉）だけでなく知られざるスポットまで含めて発見・計画できる React 製 Web アプリの要件定義です。本アプリは「マッチングアプリ風」のスワイプ体験と AI チャットによる旅行相談を中心とした **通常観光モード** と、四国八十八ヶ所巡礼（愛媛 26 札所）を支援する **お遍路モード** の 2 モードを提供します。

お遍路モードは「巡れば巡るほど達成感が貯まる」体験を中核とし、札所マップ・巡礼進捗（達成率）・デジタル納経帳（訪問記録）・今日のお遍路プラン・札所到着時の自動表示で構成されます。これは「検索して終わるアプリ」を「使い続けるアプリ」へ転換することを狙いとしています。

本アプリは **Vercel** へデプロイされます。AI チャット・地図/現在地・データ永続化などの AWS 依存機能は、後から AWS（Amazon Bedrock / Amazon Location Service / DynamoDB / S3 / Lambda 等）へ差し替えられるよう、インターフェース背後に抽象化し、当面はモック/スタブで実装します。マッチング画像（マッチング機能で表示する画像）は後日提供されるため、当面はプレースホルダーを使用します。

デザインは「AI が生成したように見えない」温かみのある手作り感のある、愛媛らしい（海・山・みかん・道後温泉・寺社を想起させる）佇まいを重視します。この方針は見た目だけでなくチャット UX のトーンにも適用します。

> **重要（基盤との突合）**: 既存アプリ基盤 `C:\Users\西原薙寧\Downloads\waskiro` が現ワークスペース（`c:\Users\西原薙寧\Downloads\match`）の外部に存在し、現時点では読み取れません。本スペックは後日この基盤と突合・整合させる必要があります（詳細は「前提・未決事項」を参照）。

## Glossary

- **Application（本アプリ / システム）**: 愛媛観光支援 Web アプリ全体。
- **Language_Module（言語選択モジュール）**: 表示言語の選択・切替を担うサブシステム。
- **Mode_Manager（モード管理）**: 通常観光モードとお遍路モードの選択・切替を担うサブシステム。
- **Chat_Advisor（AI チャット相談）**: 旅行相談・スポット提案・プラン作成を会話形式で行うサブシステム（AI バックエンド抽象化）。
- **Swipe_Discovery（スワイプ発見）**: マッチングアプリ風にスポット/札所カードを提示し、スワイプで評価するサブシステム。
- **Favorites（お気に入り）**: 行きたいスポットを保存・一覧表示するサブシステム。
- **Shiori（しおり）**: 旅程（しおり）を作成・編集するサブシステム。
- **Plan_Sharing（プラン共有）**: 作成した旅程/プランを共有するサブシステム。
- **Temple_Map（札所マップ）**: 愛媛の札所を地図上に表示するサブシステム。
- **Pilgrimage_Progress（巡礼進捗）**: 札所の訪問数と達成率を算出・表示するサブシステム（お遍路モードの主機能）。
- **Nokyocho（デジタル納経帳）**: 札所の訪問記録（訪問日・写真・メモ・ルート・感想）を保存するサブシステム。
- **Visit_Tracker（訪問管理）**: 訪問済/未訪問をスクロール操作で管理するサブシステム。
- **Pilgrimage_Planner（今日のお遍路プラン）**: 条件から AI が当日の巡礼プランを生成するサブシステム。
- **Arrival_Notifier（札所到着時の自動表示）**: 現在地に基づき札所接近/到着を検知し情報を自動表示するサブシステム（ジオフェンス抽象化）。
- **Layered_Map（重ねるマップ）**: お遍路・サイクリング・グルメ・防災等の情報レイヤーを 1 つの地図に重畳表示するサブシステム。
- **Auth_Module（認証モジュール）**: メールアドレスによるログイン/ログアウトを担うサブシステム。
- **AWS_Gateway（AWS 抽象化層）**: AI・地図/現在地・データ永続化などの外部依存を抽象化するインターフェース層（当面モック実装）。
- **札所（Fudasho）**: 巡礼の対象となる寺院。愛媛 26 札所、四国全体 88 札所。
- **達成率（Achievement_Rate）**: 訪問済札所数 ÷ 対象札所総数 × 100（％、整数丸め）。
- **ジオフェンス（Geofence）**: 札所を中心とする半径の仮想境界（例: 100m）。内部進入で「到着」と判定する。
- **マッチング画像（Matching_Image）**: スワイプ等で表示する写真。当面プレースホルダー。

## Requirements

### Requirement 1: 言語選択

**User Story:** As a 訪日/県外を含むユーザー, I want アプリ表示言語を選びたい, so that 母語で観光情報を理解できる。

#### Acceptance Criteria

1. WHEN ユーザーがアプリを初回起動する, THE Language_Module SHALL 言語選択画面を「ようこそ愛媛へ」の表現と愛媛の写真とともに表示する
2. THE Language_Module SHALL 日本語・English・简体中文・繁體中文・한국어・ไทย・Français・Deutsch・Español・Português・Tiếng Việt・Bahasa Indonesia・العربية・Русский・हिन्दी・伊予弁・その他の言語 を選択肢として一覧表示する
3. WHEN ユーザーが 1 つの言語を選択して「次へ進む」を操作する, THE Language_Module SHALL 選択言語を保存し次の画面へ遷移する
4. WHERE ユーザーが設定画面を開いている, THE Language_Module SHALL 表示言語の変更操作を提供する
5. WHEN 表示言語が変更される, THE Application SHALL 画面上のラベルを選択言語の表記へ更新する
6. IF 選択された言語の翻訳リソースが存在しない, THEN THE Language_Module SHALL 通知を行わず日本語をフォールバックとして表示する
7. WHEN 表示言語が変更される一部のラベル更新が失敗する, THE Language_Module SHALL 更新可能なラベルのみを選択言語へ更新し言語変更を継続する
8. WHERE 伊予弁モードが選択されている, THE Language_Module SHALL 主要 UI ラベルについて手動作成済みの伊予弁文言を表示し、伊予弁文言が未整備のラベルは日本語をフォールバックとして表示する

### Requirement 2: モード選択（通常観光 / お遍路）

**User Story:** As a ユーザー, I want 観光モードとお遍路モードを切り替えたい, so that 目的に応じた体験を選べる。

#### Acceptance Criteria

1. WHEN ユーザーが言語選択を完了する, THE Mode_Manager SHALL 通常観光モードとお遍路モードの選択肢を提示する
2. WHEN ユーザーが通常観光モードを選択する, THE Mode_Manager SHALL 観光モードの画面構成（チャット/スワイプ/お気に入り/しおり）へ遷移する
3. WHEN ユーザーがお遍路モードを選択する, THE Mode_Manager SHALL お遍路モードの画面構成（札所マップ/巡礼進捗/納経帳/今日のプラン）へ遷移する
4. WHILE アプリが起動している, THE Mode_Manager SHALL 現在選択中のモードをヘッダー上に表示し、ヘッダーおよび設定画面からモード切替のトグル操作を提供する
5. WHEN ユーザーがヘッダーまたは設定画面のモード切替トグルを操作する, THE Mode_Manager SHALL 切替後のモードの状態を保持したまま該当画面へ遷移する

### Requirement 3: AI チャット旅行相談

**User Story:** As a 旅行計画中のユーザー, I want AI と会話して旅行を相談したい, so that 自分の好みに合うスポットや計画を得られる。

#### Acceptance Criteria

1. WHEN ユーザーがチャットにメッセージを送信する, THE Chat_Advisor SHALL AWS_Gateway 経由で応答を取得しチャット欄に提案を表示する
2. WHEN Chat_Advisor が目的地探索の局面に至る, THE Chat_Advisor SHALL マッチングアプリ風のスポット候補集合を Swipe_Discovery に引き渡す
3. WHEN ユーザーのスワイプ評価が蓄積される, THE Chat_Advisor SHALL 蓄積された嗜好を次回以降の提案生成の入力として使用する
4. IF AWS_Gateway が応答取得に失敗する, THEN THE Chat_Advisor SHALL エラーメッセージを表示し再試行操作を提供する
5. THE Chat_Advisor SHALL 機械的・定型的でない、親しみのある会話トーンの応答を表示する
6. WHERE AWS バックエンドが未接続である, THE Chat_Advisor SHALL モック応答（スタブ）を用いて会話フローを成立させる

### Requirement 4: スワイプによるスポット発見

**User Story:** As a ユーザー, I want スワイプ操作でスポットを直感的に評価したい, so that 好き/興味なしを素早く選別できる。

#### Acceptance Criteria

1. WHEN Swipe_Discovery がスポット候補を表示する, THE Swipe_Discovery SHALL スポット情報（名称・写真・紹介文・人気ランキング・口コミ）をカードとして提示する
2. WHEN ユーザーが右スワイプする, THE Swipe_Discovery SHALL 対象スポットを「行きたい」として Favorites に追加する
3. WHEN ユーザーが左スワイプする, THE Swipe_Discovery SHALL 対象スポットを「興味なし」として次のカードへ進める
4. WHEN ユーザーが上スワイプする, THE Swipe_Discovery SHALL 対象スポットを Shiori に追加する
5. WHEN ユーザーが下スワイプする, THE Swipe_Discovery SHALL 対象スポットを「後で見る」リストに追加する
6. WHEN スワイプ履歴が更新される, THE Swipe_Discovery SHALL 履歴に基づく「あなたへのおすすめ」を提示する
7. WHERE マッチング画像が未提供である, THE Swipe_Discovery SHALL プレースホルダー画像を表示する

> **データ出典補足（Q3）**: MVP のスポット・飲食店・口コミデータはダミーデータを用いる。本番のデータ入手元・利用条件確認は後続課題として保留し、Tabelog 等の外部サービスの無断利用は行わない（口コミは自前または正式提供データを前提とする）。

### Requirement 5: お気に入り

**User Story:** As a ユーザー, I want 気になるスポットをお気に入り登録したい, so that 後から見返して計画に使える。

#### Acceptance Criteria

1. WHEN スポットが「行きたい」と評価される, THE Favorites SHALL 当該スポットをお気に入り一覧に追加する
2. WHEN ユーザーがお気に入り一覧を開く, THE Favorites SHALL すべて/スポット/しおり/プラン のタブで分類表示する
3. WHEN ユーザーがお気に入りからスポットを削除する, THE Favorites SHALL 当該スポットを一覧から除外する
4. WHEN ユーザーがお気に入りのスポットを選択する, THE Favorites SHALL 当該スポットの詳細と関連スポットを表示する

### Requirement 6: しおり（旅程）作成

**User Story:** As a ユーザー, I want 旅程（しおり）を作りたい, so that 当日の行程を整理できる。

#### Acceptance Criteria

1. WHEN ユーザーがスポットをしおりに追加する, THE Shiori SHALL 当該スポットをしおりの項目として登録する
2. WHEN ユーザーがしおりの項目順序を変更する, THE Shiori SHALL 変更後の順序を保持して表示する
3. WHEN ユーザーがしおりの項目を削除する, THE Shiori SHALL 当該項目をしおりから除外する
4. THE Shiori SHALL しおりの内容を AWS_Gateway 経由で永続化する（当面はモックストレージ）

### Requirement 7: プラン共有

**User Story:** As a ユーザー, I want 作成したプランを共有したい, so that 同行者と計画を共有できる。

#### Acceptance Criteria

1. WHEN ユーザーが共有操作を行う, THE Plan_Sharing SHALL 対象プランの共有用リンクまたは共有データを生成する
2. WHEN 共有用リンクが開かれる, THE Plan_Sharing SHALL 対象プランの内容を閲覧表示する
3. IF 対象プランが存在しない, THEN THE Plan_Sharing SHALL プランが見つからない旨のメッセージを表示する

### Requirement 8: 札所マップ（お遍路モード）

**User Story:** As a お遍路ユーザー, I want 愛媛の札所を地図で確認したい, so that 巡る順序や周辺施設を把握できる。

#### Acceptance Criteria

1. WHEN ユーザーが札所マップを開く, THE Temple_Map SHALL 愛媛の各札所を番号付きピンとして地図上に表示する
2. WHEN ユーザーが札所ピンを選択する, THE Temple_Map SHALL 札所番号（1 以上の整数）・札所名・現在地からの距離・徒歩/車の所要時間（0 以上）・駐車場有無（`parking` フラグ）・トイレ/休憩所（`restrooms` フラグ）・周辺スポット/飲食店を表示する
3. WHERE フィルタ（車/徒歩/時間/未訪問のみ）が指定される, THE Temple_Map SHALL 指定条件に合致する札所のみを地図上に表示する
4. WHEN 現在地が取得可能である, THE Temple_Map SHALL 現在地を地図上に表示する
5. WHERE AWS の地図/現在地サービスが未接続である, THE Temple_Map SHALL 愛媛 26 札所（第 40〜65 番）の固定モックデータ（`parking` / `restrooms` フラグのダミー値を含む）とモック現在地で表示を成立させる

### Requirement 9: 巡礼進捗・達成率（お遍路モードの主機能）

**User Story:** As a 巡礼ファン, I want 巡った札所と達成率を見たい, so that 達成感を得て巡礼を続けられる。

#### Acceptance Criteria

1. WHEN ユーザーがお遍路モードのホームを開く, THE Pilgrimage_Progress SHALL 愛媛 26 札所の訪問数と達成率を表示する
2. WHEN ユーザーがお遍路モードのホームを開く, THE Pilgrimage_Progress SHALL 四国 88 札所の訪問数と達成率を表示する
3. THE Pilgrimage_Progress SHALL 達成率を「訪問済札所数 ÷ 対象札所総数 × 100」を整数へ切り捨て（例: 12.5% → 12%）た百分率として算出する
4. WHEN 札所が訪問済として記録される, THE Pilgrimage_Progress SHALL 訪問数・達成率・残りの札所数を再計算して更新する
5. THE Pilgrimage_Progress SHALL 今日巡った札所数・今月巡った札所数・残りの札所数を表示する
6. WHEN ユーザーがお遍路を開始する都道府県を選択する, THE Pilgrimage_Progress SHALL 四国 4 県のうち選択された 1 県を対象範囲として進捗を表示する

### Requirement 10: デジタル納経帳・訪問記録（お遍路モード）

**User Story:** As a お遍路ユーザー, I want 訪問した札所を記録したい, so that 旅の記録として残せる。

#### Acceptance Criteria

1. WHEN ユーザーが札所の訪問を記録する, THE Nokyocho SHALL 札所名・訪問日・写真・メモ・当日のルート・感想を保存する
2. WHEN ユーザーが納経帳を開く, THE Nokyocho SHALL 記録済みの札所一覧を訪問日とともに表示する
3. WHEN ユーザーが記録済み札所を選択する, THE Nokyocho SHALL 当該札所の保存内容（訪問日・写真・メモ・感想）を表示する
4. WHERE 写真が添付される, THE Nokyocho SHALL 添付写真を当該訪問記録に紐づけて保存する（MVP ではプレースホルダー／端末ローカル保存とし、本番は S3 へ差し替える）
5. THE Nokyocho SHALL 訪問記録を AWS_Gateway 経由で永続化する（当面はモックストレージ、写真は本番で S3 へ差し替え）

### Requirement 11: 訪問済/未訪問のスクロール管理（お遍路モード）

**User Story:** As a お遍路ユーザー, I want 行った/行ってないをスクロールで管理したい, so that マッチングアプリの感覚で進捗の初期値を設定できる。

#### Acceptance Criteria

1. WHEN ユーザーが初回ログイン後にお遍路モードへ入る, THE Visit_Tracker SHALL 行った/行ってないを設定するスクロール操作の画面を提示する
2. WHEN ユーザーが札所を「行った」に設定する, THE Visit_Tracker SHALL 当該札所を訪問済として記録する
3. WHEN ユーザーが札所を「行ってない」に設定する, THE Visit_Tracker SHALL 当該札所を未訪問として記録する（訪問済からの差し戻しを含む）
4. WHEN 訪問状態が更新される, THE Visit_Tracker SHALL Pilgrimage_Progress に状態変更を反映させる
5. IF 訪問状態の永続化がネットワーク/ストレージ障害で失敗する, THEN THE Visit_Tracker SHALL UI 上の訪問状態を維持したままユーザー操作を継続させる

### Requirement 12: 今日のお遍路プラン（AI 生成）

**User Story:** As a お遍路ユーザー, I want 条件から当日の巡礼プランを作ってほしい, so that 効率よく巡れる。

#### Acceptance Criteria

1. WHEN ユーザーが出発地点・利用可能時間・移動手段・希望札所・体力レベル・観光を含むかを入力して生成を要求する, THE Pilgrimage_Planner SHALL AWS_Gateway 経由で当日の巡礼プランを生成する
2. WHEN 巡礼プランが生成される, THE Pilgrimage_Planner SHALL 時刻付きのタイムライン形式でプランを表示する
3. WHERE ユーザーが観光を含むことを選択している, THE Pilgrimage_Planner SHALL 札所に加えて周辺の観光スポット/飲食店をプランへ混在させる
4. IF AWS_Gateway がプラン生成に失敗する, THEN THE Pilgrimage_Planner SHALL エラーメッセージを表示し再試行操作を提供する
5. WHERE AWS バックエンドが未接続である, THE Pilgrimage_Planner SHALL モックのプラン生成結果を表示する

### Requirement 13: 札所到着時の自動表示（ジオフェンス）

**User Story:** As a お遍路ユーザー, I want 札所に近づいたら自動で情報が出てほしい, so that その場で記録や見どころ確認ができる。

#### Acceptance Criteria

1. WHEN 現在地が札所のジオフェンス内へ進入する, THE Arrival_Notifier SHALL 到着通知と当該札所の説明・歴史・見どころ・写真スポットを自動表示する
2. WHEN 到着画面が表示される, THE Arrival_Notifier SHALL 「納経帳に記録」操作と「しおりに追加」操作を提供する
3. WHEN ユーザーが「納経帳に記録」を操作する, THE Arrival_Notifier SHALL 当該札所の訪問記録を Nokyocho に登録する
4. IF 現在地取得が不可能である, THEN THE Arrival_Notifier SHALL 手動で札所到着を記録する操作を提供する
5. WHILE 通信が切断されている, THE Arrival_Notifier SHALL 到着ログを端末ローカルに一時保存する
6. WHEN 通信が復帰する, THE Arrival_Notifier SHALL ローカル保存した到着ログを AWS_Gateway 経由で同期する

> **MVP スコープ補足（Q5）**: 訪問判定は手動と GPS（ジオフェンス）自動の両対応を最終仕様とする。MVP では Req 11 の手動判定（スクロールによる「行った/行ってない」設定）と AC4 の手動到着記録を対象とし、本 Requirement のジオフェンス自動表示（AC1）は後続フェーズで実装する。

### Requirement 14: 重ねるマップ（情報レイヤー）

**User Story:** As a ユーザー, I want お遍路・サイクリング・グルメ・防災などの情報を 1 つの地図に重ねたい, so that サイト横断せず最適な周遊ができる。

#### Acceptance Criteria

1. WHEN ユーザーが情報レイヤーを選択する, THE Layered_Map SHALL 選択されたレイヤー（お遍路/サイクリング/グルメ/防災/トイレ/休憩所）を地図上に重畳表示する
2. WHEN ユーザーがレイヤーの表示を解除する, THE Layered_Map SHALL 当該レイヤーの要素を地図から除外する
3. WHERE 複数レイヤーが同時に選択される, THE Layered_Map SHALL 選択中の全レイヤーの要素を同一地図上に重ねて表示する
4. WHEN ユーザーが目的を条件として指定する, THE Layered_Map SHALL 指定条件に合致するクロス属性の周遊候補を提示する
5. WHERE 災害/ハザード情報レイヤーが選択される, THE Layered_Map SHALL ハザード区域を地図上に表示する
6. WHERE 本アプリが MVP 構成である, THE Layered_Map SHALL 札所マップに加えて基本レイヤー（お遍路／トイレ／休憩所）のみを提供し、サイクリング／グルメ／防災の各レイヤーは後続フェーズで追加する

> **MVP スコープ補足（Q7）**: 上記 AC1〜AC5 はレイヤー統合後の最終仕様を表す。MVP では AC6 のとおり「札所マップ＋基本レイヤー（お遍路／トイレ／休憩所）」までを対象とし、全レイヤー統合は後続フェーズとする。

### Requirement 15: 認証（メールログイン）

**User Story:** As a お遍路ユーザー, I want メールアドレスでログインしたい, so that 記録や進捗を継続して保持できる。

#### Acceptance Criteria

1. WHEN ユーザーがメールアドレスとパスワードを入力してログインを操作する, THE Auth_Module SHALL 認証を実行し、認証に成功した場合にのみセッションを確立する
2. WHERE 「ログイン状態を保持する」が選択されている, THE Auth_Module SHALL セッションを次回起動時まで保持する
3. IF 認証情報が不正である, THEN THE Auth_Module SHALL 認証失敗のメッセージを表示する
4. WHEN ユーザーがログアウトを操作する, THE Auth_Module SHALL セッションを破棄する
5. WHERE AWS 認証バックエンドが未接続である, THE Auth_Module SHALL モック認証でセッションを確立する

> **MVP スコープ補足（Q8）**: MVP の認証手段はメールアドレス＋パスワードのみとする。SNS ログイン（Google／Apple 等）は将来拡張として位置づけ、MVP には含めない。

### Requirement 16: AWS 抽象化とモック

**User Story:** As a 開発者, I want AWS 依存をインターフェース背後に抽象化したい, so that 後から AWS を接続でき、当面は Vercel 上で動作する。

#### Acceptance Criteria

1. THE AWS_Gateway SHALL AI チャット・地図/現在地・データ永続化・認証・翻訳の各機能を抽象インターフェースとして公開する
2. WHERE 実 AWS 接続が未設定である, THE AWS_Gateway SHALL 各インターフェースのモック実装を提供する
3. WHEN 実 AWS 接続情報が設定される, THE AWS_Gateway SHALL モック実装を実 AWS 実装へ差し替え可能とする
4. THE AWS_Gateway SHALL モック実装と実実装で同一のインターフェース契約を維持する
5. IF モック実装と実 AWS 実装のインターフェース契約が一致しない, THEN THE Application SHALL デプロイを成立させない

### Requirement 17: デプロイ（Vercel）

**User Story:** As a 開発者, I want Vercel へデプロイしたい, so that AWS Amplify に依存せず公開できる。

#### Acceptance Criteria

1. THE Application SHALL Vercel 上でビルド・配信可能な構成を持つ
2. THE Application SHALL AWS 接続情報を環境変数経由で受け取る構成を持つ
3. WHERE AWS 環境変数が未設定である, THE Application SHALL モック実装で機能を成立させる

### Requirement 18: デザイン・ルックアンドフィール（非「AI っぽさ」）

**User Story:** As a ユーザー, I want 温かみのある手作り感のある愛媛らしいデザインを体験したい, so that 機械的・量産的でない親しみを感じられる。

#### Acceptance Criteria

1. THE Application SHALL 海・山・みかん・道後温泉・寺社を想起させる落ち着いた青緑系の配色を全画面で適用する
2. THE Application SHALL 手作り感・人間味のあるビジュアルトーン（量産的に見えない装飾・余白・タイポグラフィ）を適用する
3. THE Chat_Advisor SHALL 定型的でない親しみのある会話トーンでメッセージを提示する
4. THE Application SHALL 通常観光モードでマッチングアプリ風のスワイプ画面を提供する
5. THE Application SHALL お遍路モードで札所マップ・巡礼進捗・デジタル納経帳・今日のプラン・到着画面を提供する

### Requirement 19: 多言語表示（翻訳）

**User Story:** As a 訪日ユーザー, I want コンテンツを選択言語で読みたい, so that 言語の壁なく観光情報を得られる。

#### Acceptance Criteria

1. WHEN 表示言語が選択されている, THE Application SHALL UI ラベルを選択言語で表示する
2. WHERE コンテンツの翻訳が必要である, THE Application SHALL AWS_Gateway の翻訳インターフェース経由で翻訳結果を取得する
3. WHERE AWS 翻訳バックエンドが未接続である, THE Application SHALL モック翻訳または原文フォールバックを表示する

### Requirement 20: 実地図描画（MapLibre GL JS）

**User Story:** As a ユーザー, I want 札所や情報レイヤーを本物の地図上で確認したい, so that 実際の地形・道路・周辺との位置関係を把握できる。

> **背景**: Req 8 / Req 14 は札所・レイヤー要素を「地図上に表示」すると定めるが、MVP の実装は地理座標を百分率に投影するモック地図サーフェスであり、実地図タイルは描画していない。本要件は実地図タイル描画を **MapLibre GL JS**（描画エンジン）＋ **オープンな地図タイル源（既定: OpenStreetMap ラスタタイル）** で行う Map_Renderer として明文化する。Amazon Location Service など特定クラウドのタイル源には依存しない。地図が無効/初期化失敗のときは既存のモックサーフェスへフォールバックし、Req 8.5 / 16.2 / 17.3 と整合する。

#### Acceptance Criteria

1. WHERE 実地図描画が有効化されている, THE Map_Renderer SHALL MapLibre GL JS でオープンな地図タイル源（既定 OpenStreetMap）を背景として表示する
2. THE Map_Renderer SHALL 札所ピン・現在地マーカー・情報レイヤー要素を実地図の地理座標（緯度経度）に整合させて重畳表示する
3. WHEN ユーザーが地図をズーム/パンする, THE Map_Renderer SHALL ピン・マーカーと地図の地理的整合を維持する
4. WHERE 実地図描画が無効である, THE Map_Renderer SHALL 既存のモック地図サーフェス（百分率投影）へフォールバックし、AWS なしでも札所ピン・現在地・フィルタ表示を成立させる（Req 8.5 整合）
5. THE Map_Renderer SHALL ブラウザに AWS 認証情報や秘匿キーを保持しない（既定の OpenStreetMap タイルはキー不要。タイル源の差し替えは公開可能な URL / 公開スコープのキーに限る）
6. WHEN 端末のブラウザ Geolocation が利用可能かつ許可されている, THE MapLocationPort SHALL 端末の現在地を取得して地図に反映し、取得不可/未許可の場合はモック現在地へフォールバックする（Req 8.4 / 8.5 整合）
7. IF 地図タイルの取得または地図ライブラリ（WebGL）の初期化が失敗する, THEN THE Map_Renderer SHALL モック地図サーフェスへ退避し、ピン・詳細・フィルタ機能を維持する

## 前提・未決事項（Assumptions and Open Questions）

> これらは要件の確定に影響します。設計フェーズ前にユーザー確認が必要な項目を含みます。

### 前提（Assumptions）

- A1. デプロイ先は **Vercel**（AWS Amplify ではない）。
- A2. AWS 依存（Bedrock / Location Service / DynamoDB / S3 / Lambda / Translate）は抽象化し、当面 **モック/スタブ**で実装する。
- A3. マッチング画像は後日提供。当面 **プレースホルダー**を使用する。
- A4. 既存基盤 `waskiro` は現時点で読み取り不可。後日 **突合・整合**を行う。
- A5. 達成率は整数丸めの百分率で表示する。
- A6. **MVP スコープ（確定）**: MVP は「札所マップ・訪問記録（写真保存を含む）・達成率表示」を中核とする。
  - 訪問判定（Q5）は **手動**（スクロールによる「行った/行ってない」設定）を MVP とし、GPS（ジオフェンス）自動判定は後続とする。
  - デジタル納経帳の **写真保存（Q6）は MVP に含める**（当面はプレースホルダー／ローカル保存、本番は S3 へ差し替え）。
  - **重ねるマップ（Q7）は MVP では「札所マップ＋基本レイヤー（お遍路／トイレ／休憩所）」までとし**、サイクリング／防災／グルメの全レイヤー統合は後続フェーズとする。
  - AI ルート提案（今日のお遍路プラン）・到着自動表示（ジオフェンス）は後続とする。
- A7. **札所データの正典（確定 / Q1）**: モック段階は **愛媛 26 札所（第 40〜65 番）の固定データ**を用いる。本番は **四国八十八ヶ所霊場会（shikoku88.net）を札所番号・名称の正典**とし、**位置情報はそれを補完**する。多言語解説は **MLIT 多言語観光 DB**、歴史／見どころは **文化庁 日本遺産**を出典とする。
- A8. **施設データの入手元（確定 / Q2）**: トイレ・休憩所・駐車場データは **国土数値情報＋自治体オープンデータ**を想定する。モックでは札所ごとに `parking` / `restrooms` フラグのダミー値を用いる。
- A9. **スポット／飲食店データ（確定 / Q3）**: モックは **ダミーデータ**を用いる。本番のデータ入手元・利用条件確認は **後続課題として保留**する。Tabelog 等の **無断利用は行わず**、口コミは自前データまたは正式提供データを前提とする。
- A10. **認証方式（確定 / Q8）**: MVP は **メールアドレス＋パスワードのみ**とする。SNS ログインは **将来拡張として記載のみ**とし、MVP には含めない。
- A11. **伊予弁モード（確定 / Q9）**: MVP は **主要 UI ラベルのみ伊予弁文言を用意**（チームによる手動作成）する。未整備分は **日本語フォールバック**を表示する。
- A12. **プレゼン用画面イメージ（確定 / Q10）**: 専用素材は作成せず、**アプリ実装後にスクリーンショットを取得**して対応する。
- A13. **実地図描画（確定 / Req 20）**: 地図描画は **MapLibre GL JS**（オープンソースの描画エンジン）を用い、タイル源は **オープンな地図タイル（既定: OpenStreetMap ラスタタイル、APIキー不要）**とする。**Amazon Location Service など特定クラウドには依存しない**（将来 OSM/MapTiler 等へ差し替え可能）。実地図描画は環境変数フラグで有効化し、無効時・WebGL 初期化失敗時は既存のモック地図サーフェスへ自動フォールバックする（Req 20.4 / 20.7 / 16.2 / 17.3）。ブラウザに AWS 認証情報や秘匿キーは保持しない。OSM の公開タイルは利用ポリシー順守の範囲（MVP/デモ用途）で用い、本番大規模時は自前/商用タイルへ差し替える。

### 確定事項（Resolved Decisions）

> 旧「未決事項 Q1〜Q10」はユーザー確認により以下のとおり確定した。各決定は上記 Assumptions（A6〜A12）および本文の受入基準に反映済み。

| # | 論点 | 確定内容 | 反映先 |
|---|------|----------|--------|
| Q1 | 札所データの入手元 | モックは愛媛 26 札所（第 40〜65 番）固定データ。本番は四国八十八ヶ所霊場会（shikoku88.net）を札所番号・名称の正典、位置はそれを補完。多言語解説は MLIT 多言語観光 DB、歴史／見どころは文化庁 日本遺産。 | A7 / Req 8 / Req 13 |
| Q2 | トイレ・休憩所・駐車場データ | 国土数値情報＋自治体オープンデータを想定。モックは札所ごとに `parking` / `restrooms` フラグのダミー値。 | A8 / Req 8 / Req 14 |
| Q3 | スポット・飲食店データ | モックはダミー。本番の入手元・利用条件は後続課題として保留。Tabelog 等の無断利用はしない。 | A9 / Req 4 / Req 12 |
| Q4 | モード切替 UI | 言語選択後にモード選択画面を提示し、以降はヘッダー／設定からトグルで切替（両方採用）。 | Req 2 |
| Q5 | 訪問判定 | 手動と GPS（ジオフェンス）の両対応。MVP は手動（スクロール）、GPS 自動は後続。 | A6 / Req 11 / Req 13 |
| Q6 | 納経帳の写真保存 | MVP に含める（プレースホルダー／ローカル保存、本番 S3 差し替え）。 | A6 / Req 10 |
| Q7 | 重ねるマップ | MVP は札所マップ＋基本レイヤー（お遍路／トイレ／休憩所）まで。全レイヤー統合は後続フェーズ。 | A6 / Req 14 |
| Q8 | 認証 | MVP はメール＋パスワードのみ。SNS ログインは将来拡張として記載のみ。 | A10 / Req 15 |
| Q9 | 伊予弁モード | MVP は主要 UI ラベルのみ伊予弁文言を手動作成。未整備分は日本語フォールバック。 | A11 / Req 1 |
| Q10 | プレゼン用画面イメージ | アプリ実装後にスクリーンショット取得で対応。 | A12 |
