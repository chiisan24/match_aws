# 愛媛観光アプリ（ehime-tourism-app）

愛媛の観光地を、有名どころ（道後温泉）だけでなく知られざるスポットまで発見・計画できる React 製 Web アプリです。マッチングアプリ風のスワイプ体験と AI チャットによる旅行相談を中心とした **通常観光モード** と、四国八十八ヶ所巡礼（愛媛 26 札所）を支援する **お遍路モード** を備えます。

- フロントエンド: React + TypeScript（Vite）
- デプロイ先: **Vercel**
- AI機能（チャット相談 / お遍路プラン生成 / 翻訳 / 写真自動生成）は **Vercel の Serverless Functions（`api/`）経由で Amazon Bedrock・Amazon Translate を実呼び出し**します。AWS 認証情報はサーバ側のみで保持し、ブラウザには出しません。
- 環境変数 `VITE_AWS_API_ENDPOINT` が**未設定なら自動でモックにフォールバック**し、AWS なしでも全機能が動作します。地図・現在地・認証・永続化は現状モックのままです。

## ローカル開発

```bash
npm install
npm run dev        # 開発サーバー
npm run build      # 型チェック + 本番ビルド (dist/)
npm run preview    # 本番ビルドのプレビュー
npm test           # テスト（Vitest）
```

Node.js 18 以上を推奨します。

## ディレクトリ構成

```
src/
  domain/      純粋ロジック（達成率・スワイプ分類・並べ替え・ジオフェンス・レイヤー・言語解決）
  ports/       AWS_Gateway のインターフェース（ChatPort/MapLocationPort/StoragePort/AuthPort/TranslatePort）
  adapters/
    mock/      モック実装（既定。AWS 未接続時に使用）
    aws/       実 AWS 実装（後日。env 設定で切替）
  app/         App Shell・各種 Context・createGateway
  ui/          画面・共通コンポーネント・デザイントークン
  i18n/        多言語（16言語＋伊予弁、日本語フォールバック）
public/
  images/ehime/  愛媛の写真（配置ガイドは同フォルダの README.md 参照）
```

## Vercel へのデプロイ

このリポジトリ（`github.com/chiisan24/match_aws`）を Vercel に連携すると自動でビルド・公開できます。

1. [vercel.com](https://vercel.com) にログインし「Add New… → Project」。
2. GitHub の `match_aws` リポジトリを Import。
3. Vercel が `vercel.json` を読み取り、自動で次を設定します（変更不要）:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 環境変数は **未設定のままで OK**（モックで全機能が動作します）。
5. 「Deploy」を押すと数分で公開 URL が発行されます。

以降は `main` ブランチへ push するたびに Vercel が自動で再デプロイします。

## AI機能（Bedrock）を本番接続する

AI機能を実際に動かすには、AWS 側の準備と Vercel の環境変数設定が必要です。

1. **AWS 準備**
   - 利用リージョン（例: `us-east-1`）で **Amazon Bedrock のモデルアクセス**を有効化します。
     - チャット/プラン: 任意の Anthropic Claude モデル（既定 `anthropic.claude-3-5-haiku-20241022-v1:0`）
     - 画像生成: `amazon.titan-image-generator-v1`
   - Bedrock 呼び出し（`bedrock:InvokeModel`）と Amazon Translate（`translate:TranslateText`）の権限を持つ IAM ユーザーのアクセスキーを発行します。
2. **Vercel の Environment Variables に設定**（`.env.example` 参照）
   - クライアント: `VITE_AWS_API_ENDPOINT=/api`
   - サーバ（VITE_ 接頭辞なし）: `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
   - 任意: `BEDROCK_CHAT_MODEL_ID` / `BEDROCK_IMAGE_MODEL_ID` / `BEDROCK_REGION`
3. 再デプロイすると、チャット・プラン・翻訳・写真生成が実際の Bedrock / Translate を使って動作します。
   - `VITE_AWS_API_ENDPOINT` を外す（または `VITE_FORCE_MOCK=true`）と、いつでもモックに戻せます。

### API エンドポイント（`api/`）

| エンドポイント | 用途 | 呼び出す AWS サービス |
| --- | --- | --- |
| `POST /api/chat` | AIチャット相談・スポット候補選定 | Bedrock (Claude) |
| `POST /api/plan` | 今日のお遍路プラン生成 | Bedrock (Claude) |
| `POST /api/translate` | 多言語翻訳 | Amazon Translate |
| `POST /api/images/generate` | 著作権フリー写真の自動生成 | Bedrock (Titan Image Generator) |

## 現状のスコープ

- MVP 実装済み: 言語選択 / モード切替 / AIチャット / スワイプ発見 / お気に入り / しおり / プラン共有 / 札所マップ / 巡礼進捗 / デジタル納経帳 / 訪問管理 / 重ねるマップ / メール認証
- **AI機能は本番実装済み**: チャット相談・お遍路プラン生成・翻訳・写真自動生成は Bedrock / Translate を実呼び出し（`VITE_AWS_API_ENDPOINT=/api` と AWS 認証情報を設定したとき）。未設定時はモックで動作。
- マッチング画像: `public/images/ehime/` に実写真を配置すると優先表示。未配置時は AI 自動生成、生成不可ならプレースホルダーに自動フォールバック。
- 認証 / データ永続化は現状モック（AWS 実接続は後日）。地図は `VITE_MAP_ENABLED=true` で実地図（MapLibre GL JS + OpenStreetMap）に切替可能。

## 地図（MapLibre GL JS）を有効化する

地図画面（札所マップ・重ねるマップ）は、既定ではモック地図サーフェスで描画します。本物の地図を出すには、環境変数を設定するだけです（AWS不要・APIキー不要）。

- `VITE_MAP_ENABLED=true` … MapLibre GL JS ＋ OpenStreetMap タイルで実地図を描画
- `VITE_MAP_STYLE_URL=`（任意）… 別の MapLibre スタイル URL に差し替え（公開URL/公開スコープのキーのみ）

有効化すると、ピン・現在地・レイヤーが実地図の地理座標に重畳され、ズーム/パンできます。現在地はブラウザの位置情報（許可時）を使用し、不可ならモック現在地へフォールバック。WebGL 非対応環境や初期化失敗時は自動でモック地図に退避します。MapLibre は遅延ロードのため、無効時はメインバンドルに含まれません。OSM の公開タイルは利用ポリシー順守の範囲（MVP/デモ）で使用し、本番大規模時は自前/商用タイルへ差し替えてください。
