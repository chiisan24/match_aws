# 愛媛観光アプリ（ehime-tourism-app）

愛媛の観光地を、有名どころ（道後温泉）だけでなく知られざるスポットまで発見・計画できる React 製 Web アプリです。マッチングアプリ風のスワイプ体験と AI チャットによる旅行相談を中心とした **通常観光モード** と、四国八十八ヶ所巡礼（愛媛 26 札所）を支援する **お遍路モード** を備えます。

- フロントエンド: React + TypeScript（Vite）
- デプロイ先: **Vercel**
- AWS 依存（AI チャット / 地図・現在地 / データ永続化 / 認証 / 翻訳）は `AWS_Gateway` の背後に抽象化。**環境変数が未設定なら自動でモックにフォールバック**し、AWS なしでも全機能が動作します。

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
   - 後で AWS を接続する場合のみ、`.env.example` の `VITE_AWS_*` を Vercel の Environment Variables に設定します。
5. 「Deploy」を押すと数分で公開 URL が発行されます。

以降は `main` ブランチへ push するたびに Vercel が自動で再デプロイします。

## 現状のスコープ

- MVP 実装済み: 言語選択 / モード切替 / AIチャット / スワイプ発見 / お気に入り / しおり / プラン共有 / 札所マップ / 巡礼進捗 / デジタル納経帳 / 訪問管理 / 重ねるマップ / メール認証（すべてモックで動作）
- 後続フェーズ（モックで実装済み・本番は後日）: 今日のお遍路プラン（AI生成）/ 札所到着自動表示（ジオフェンス）
- マッチング画像: `public/images/ehime/` に実写真を配置すると表示。未配置時はプレースホルダーに自動フォールバック。
- AWS 実接続と既存基盤 `waskiro` との突合は後日。
