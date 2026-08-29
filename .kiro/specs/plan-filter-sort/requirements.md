# Requirements Document

## Introduction

愛媛観光アプリの AI プラン先行画面（`src/ui/screens/AIPlanFirst.tsx`）は、Bedrock が生成した 5 件の旅程をそのまま並べて表示している。所要時間・移動手段・体力強度の違いは本文から読み取るしかなく、自分の条件に合う旅程を選ぶ手間が大きい。

本機能では旅程に構造化メタデータ（所要時間の分数・移動手段・強度）を追加し、並び替えは取得済みの 5 件に対してクライアント側で即時に、絞り込みは条件を Bedrock に渡して条件に合う 5 件を再生成する形で実現する。これにより「待たずに見比べられる」と「条件に合う旅程が常に 5 件揃う」の両方を満たす。

対象は通常観光モードの推薦一覧のみとする。お遍路プラン生成・スワイプ発見・AI チャットは変更しない。

## Requirements

### Requirement 1: 旅程の構造化メタデータ

**User Story:** 開発者として、旅程の所要時間・移動手段・強度を機械可読な値で受け取りたい。表示用の自由文に依存せず並び替えと絞り込みを実装できるようにするため。

#### Acceptance Criteria

1. THE SYSTEM SHALL `RecommendedPlan` に `durationMinutes`（正の整数、分）、`transportMode`（`walk` | `transit` | `car` | `bicycle` | `mixed`）、`intensityLevel`（`easy` | `moderate` | `active`）を任意フィールドとして定義する。
2. WHEN `/api/recommendations` が Bedrock 応答を正規化する THEN THE SYSTEM SHALL 上記 3 フィールドを検証し、非数値・非正数・列挙外・欠落の場合は当該フィールドを省略する。
3. WHEN 旅程に `durationMinutes` が欠落している THEN THE SYSTEM SHALL 最初と最後の `stops[].time` の差分から所要時間を補完する。
4. THE SYSTEM SHALL 既存の自由文 `duration` / `transport` / `intensity` を表示用として維持し、構造化フィールドを画面表示に使用しない。
5. WHEN キャッシュ形式が構造化フィールドの追加により変わる THEN THE SYSTEM SHALL キャッシュバージョンを更新し、旧形式の保存データを無視して再取得する。

### Requirement 2: 並び替え（即時・クライアント側）

**User Story:** 旅行者として、表示中の 5 件を所要時間や強度で並べ替えたい。待ち時間なく自分に合う旅程を見比べるため。

#### Acceptance Criteria

1. THE SYSTEM SHALL 一覧上部に並び替えコントロールを表示し、`AIおすすめ順`（既定）・`所要時間が短い順`・`所要時間が長い順`・`強度が軽い順` から選べるようにする。
2. WHEN ユーザーが並び替えを変更する THEN THE SYSTEM SHALL ネットワーク要求を行わず、取得済みの旅程のみを並べ替えて即時に再描画する。
3. THE SYSTEM SHALL 並び替えを安定ソートで行い、比較キーが同値の旅程は元の順序を保持する。
4. WHEN 比較キーを持たない旅程が存在する THEN THE SYSTEM SHALL 当該旅程を並び替え結果の末尾に配置する。
5. WHEN 並び替えが `AIおすすめ順` に戻される THEN THE SYSTEM SHALL API が返した元の順序で表示する。
6. WHEN 一覧が再生成される THEN THE SYSTEM SHALL 選択中の並び替え条件を維持したまま新しい一覧に適用する。

### Requirement 3: 絞り込み（条件付き再生成）

**User Story:** 旅行者として、所要時間・移動手段・強度の条件を指定して旅程を出してほしい。条件に合わない候補を読み飛ばす必要をなくすため。

#### Acceptance Criteria

1. THE SYSTEM SHALL 絞り込みコントロールとして 所要時間上限（指定なし / 3時間以内 / 6時間以内 / 10時間以内）、移動手段、強度 を提供する。
2. THE SYSTEM SHALL 各絞り込み条件の既定値を「指定なし」とし、複数条件を同時に指定できるようにする。
3. WHEN ユーザーが絞り込み条件を確定する THEN THE SYSTEM SHALL 条件を `/api/recommendations` の要求に含め、条件を満たす 5 件を生成させる。
4. WHEN 絞り込みによる生成を要求する THEN THE SYSTEM SHALL 既存推薦の除外指定（`exclude`）を付与しない。
5. WHEN 生成された旅程が指定条件を満たさない THEN THE SYSTEM SHALL 当該旅程を一覧に含めず、条件に合致した件数を表示する。
6. WHEN 条件に合致する旅程が 0 件になる THEN THE SYSTEM SHALL 空状態メッセージと条件解除の導線を表示する。
7. WHEN 絞り込み条件がすべて「指定なし」に戻される THEN THE SYSTEM SHALL 条件なしの既定の一覧を（キャッシュがあればキャッシュから）表示する。
8. THE SYSTEM SHALL 絞り込み条件の組み合わせごとに別のキャッシュキーで結果を保存し、同一条件の再選択でネットワーク要求を発生させない。

### Requirement 4: 生成中の状態とエラー処理

**User Story:** 旅行者として、条件変更後の生成待ちや失敗時に何が起きているか分かるようにしてほしい。操作が通ったかどうか迷わないため。

#### Acceptance Criteria

1. WHILE 絞り込みによる再生成が進行中 THE SYSTEM SHALL 直前の一覧を表示したまま `aria-busy` と進行表示で状態を伝え、絞り込みコントロールを無効化する。
2. WHEN 再生成が失敗する THEN THE SYSTEM SHALL 直前の一覧と選択中の条件を保持し、`role="alert"` でエラーを伝え、再試行できるようにする。
3. WHEN 初回読み込みが失敗する THEN THE SYSTEM SHALL 既存の全画面エラー表示と再試行の挙動を維持する。
4. THE SYSTEM SHALL 絞り込み・並び替えの利用中も既存の「別の5件を見る」機能を利用可能に保つ。

### Requirement 5: 多言語対応とアクセシビリティ

**User Story:** 多言語利用者およびキーボード・支援技術の利用者として、追加された絞り込みと並び替えを自分の言語と入力手段で使いたい。

#### Acceptance Criteria

1. THE SYSTEM SHALL 追加する全 UI 文言を `src/i18n/labels.ts` に `ja` / `en` / `iyo` で定義し、未定義言語は既存のフォールバック解決に従う。
2. THE SYSTEM SHALL 並び替え・絞り込みコントロールにアクセシブルなラベルを付与し、キーボードのみで選択および選択解除できるようにする。
3. WHEN 一覧の件数または並び順が変化する THEN THE SYSTEM SHALL 変更をライブリージョンで支援技術に通知する。
4. WHEN 表示言語が切り替わる THEN THE SYSTEM SHALL 選択中の並び替え・絞り込み条件を保持する。

### Requirement 6: 既存動作の非回帰

**User Story:** 既存利用者として、絞り込みや並び替えを使わない限り今までと同じ体験でいたい。

#### Acceptance Criteria

1. WHEN 絞り込みと並び替えがいずれも既定値である THEN THE SYSTEM SHALL 本機能導入前と同じ一覧内容および順序を表示する。
2. WHEN 一覧から旅程を選択する THEN THE SYSTEM SHALL 従来と同じ詳細表示および `onStart` 呼び出しを行う。
3. THE SYSTEM SHALL `VITE_AWS_API_ENDPOINT` 未設定時のモック経路でも並び替えと絞り込みが動作するようモックアダプターを更新する。
4. WHEN サーバー応答が構造化フィールドを含まない THEN THE SYSTEM SHALL 画面をエラーにせず、並び替えでは末尾扱い、絞り込みでは条件未達として扱う。

## Glossary

| 用語 | 定義 |
| --- | --- |
| 旅程（プラン） | `RecommendedPlan`。Bedrock が生成し Google Places で補完された 1 日分の観光ルート。 |
| 一覧 | AI プラン先行画面に表示される旅程 5 件のリスト。 |
| 構造化メタデータ | `durationMinutes` / `transportMode` / `intensityLevel`。並び替えと絞り込みの判定に使う機械可読な値。 |
| 所要時間上限 | 絞り込み条件の 1 つ。`durationMinutes` がこの値以下の旅程のみを合致とみなす。 |
| 移動手段 | `transportMode`。`walk`（徒歩）/ `transit`（公共交通）/ `car`（車）/ `bicycle`（自転車）/ `mixed`（併用）。 |
| 強度 | `intensityLevel`。`easy`（軽い）/ `moderate`（普通）/ `active`（活動的）の 3 段階。 |
| 条件付き再生成 | 絞り込み条件を `/api/recommendations` に渡し、条件を満たす 5 件を Bedrock に生成させる処理。 |
| AIおすすめ順 | 並び替えの既定値。API が返した配列順をそのまま使う。 |
| 合致件数 | 生成結果のうち指定条件を満たし一覧に表示された旅程の数。 |
