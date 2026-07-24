# DynamoDB 設計書 — 観光スポット (EhimeSpots)

「観光地データを実行時に1件ずつ追加・更新できる」ための DynamoDB 設計。実装は含めず、
テーブル定義・キー・アクセスパターン・項目スキーマのみを定義する。

- 対象データ: 観光スポット / 飲食店 / 温泉 / みやげ（アプリの `Spot` 型）
- 方針: 1件で完結する非正規化ドキュメント（RDBのような表結合はしない）
- データ出典: 一部 © OpenStreetMap contributors (ODbL)。表示時はクレジット必須。

---

## 1. テーブル定義

| 項目 | 値 |
|---|---|
| テーブル名 | `EhimeSpots` |
| 課金モード | On-Demand（PAY_PER_REQUEST） |
| パーティションキー (PK) | `id` (String) |
| ソートキー (SK) | なし（1スポット = 1アイテム） |
| TTL | なし |
| ストリーム | 不要（将来のキャッシュ無効化で使う可能性あり） |

### 主キー設計
- `id` はアイテムを一意に識別する。既存データを引き継ぐため、由来が分かる接頭辞を付ける。
  - `osm-node-<id>` / `osm-way-<id>` … OpenStreetMap 由来
  - `curated-food-<slug>` … 手動キュレーション（郷土料理店など）
  - `user-<uuid>` … 管理フォームからの追加分

---

## 2. 属性スキーマ（アプリの `Spot` と対応）

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | S | ✅ | パーティションキー |
| `name` | S | ✅ | 名称 |
| `category` | S | ✅ | `sightseeing` / `food` / `souvenir` / `onsen` のいずれか |
| `lat` | N | ✅ | 緯度 |
| `lng` | N | ✅ | 経度 |
| `descriptionJa` | S | – | 日本語の紹介文（無ければ名称ベース） |
| `descriptionEn` | S | – | 英語の紹介文（任意） |
| `openingHours` | S | – | 営業時間（OSM `opening_hours` 由来など） |
| `website` | S | – | 公式サイト URL（`http(s)://` のみ） |
| `reviews` | L(list) | – | 口コミ配列（当面は空）。要素: `{ author:S, rating:N, text:S }` |
| `imageUrls` | L(list) | – | 画像URL配列（当面は空） |
| `source` | S | – | `osm` / `curated` / `user` |
| `createdAt` | S | – | ISO8601（追加日時） |
| `updatedAt` | S | – | ISO8601（更新日時） |

> 位置情報は `lat` / `lng` の2つの Number 属性として保持する（アプリの `location: {lat,lng}` へ変換）。
> ネスト保存でも可だが、GSI等での扱いやすさからトップレベルの数値に分解する。

---

## 3. グローバルセカンダリインデックス (GSI)

カテゴリ別の取得（例：グルメだけ）を全件 Scan せず Query で行うために1本用意する。

| 項目 | 値 |
|---|---|
| インデックス名 | `gsi_category` |
| パーティションキー | `category` (String) |
| ソートキー | `name` (String) |
| 射影 (Projection) | `ALL` |

- 「カテゴリ内を名前順で取得」が `Query` 1回でできる。
- 件数が少ないので射影は `ALL`（読み取りコスト微少）。

---

## 4. アクセスパターン一覧

| # | ユースケース | 操作 | キー/インデックス |
|---|---|---|---|
| P1 | 1スポットを取得 | `GetItem` | PK=`id` |
| P2 | 全スポット取得（初期表示） | `Scan` | テーブル（件数が少ないため許容） |
| P3 | カテゴリで絞って取得 | `Query` | `gsi_category` (category=…) |
| P4 | スポットを1件追加 | `PutItem`（`attribute_not_exists(id)` 条件付き） | PK=`id` |
| P5 | スポットを更新 | `UpdateItem` / `PutItem` | PK=`id` |
| P6 | スポットを削除 | `DeleteItem` | PK=`id` |
| P7 | 既存データの一括投入（シード） | `BatchWriteItem` | – |

> 規模想定: 数百〜千件程度。全件 Scan(P2) でも実用上問題ないが、増えたら
> 「エリア別GSI」や「ページング」を追加する余地を残す。

---

## 5. 項目例（JSON 表現）

観光地（OSM由来・営業時間/サイトあり）:
```json
{
  "id": "osm-node-611661255",
  "name": "松山城",
  "category": "sightseeing",
  "lat": 33.845651,
  "lng": 132.765746,
  "descriptionJa": "松山城（観光スポット）",
  "descriptionEn": "Matsuyama Castle (sightseeing)",
  "openingHours": "Feb-Jul Mo-Su 09:00-17:00",
  "website": "https://www.matsuyamajo.jp/",
  "reviews": [],
  "imageUrls": [],
  "source": "osm",
  "createdAt": "2026-07-04T07:34:25Z"
}
```

郷土料理（手動キュレーション・座標は目安）:
```json
{
  "id": "curated-food-gansui-matsuyama",
  "name": "宇和島鯛めし 丸水 松山店",
  "category": "food",
  "lat": 33.845,
  "lng": 132.769,
  "descriptionJa": "宇和島鯛めしの店（愛媛の郷土料理・名物）※位置は目安",
  "website": "https://gansui.jp/",
  "reviews": [],
  "imageUrls": [],
  "source": "curated"
}
```

管理フォームからの追加分:
```json
{
  "id": "user-3f2a9c",
  "name": "新スポット",
  "category": "onsen",
  "lat": 33.85,
  "lng": 132.78,
  "descriptionJa": "新スポット（温泉）",
  "reviews": [],
  "imageUrls": [],
  "source": "user",
  "createdAt": "2026-07-22T09:00:00Z"
}
```

---

## 6. バリデーション / 制約（保存前チェック）

- `name` 必須・空不可
- `category` は 4値のいずれか
- `lat` / `lng` は数値。愛媛県のおおよその範囲内を推奨
  - 緯度: 32.90〜34.35 / 経度: 132.00〜133.70
- `website` は `http://` または `https://` で始まる場合のみ保存（それ以外は破棄）
- `id` は追加時、既存と衝突しないこと（`PutItem` の `attribute_not_exists(id)` 条件）

---

## 7. 容量・コスト見積り

- 課金: On-Demand。件数 数百・更新頻度が低いため **実質無料枠内**の見込み。
- 1アイテムは概ね 1KB 未満（口コミ・画像URLが増えなければ）。
- 全件 Scan(P2) は数百件なら 1回あたり数KB〜十数KB程度の読み取り。

---

## 8. IAM（最小権限の目安）

このテーブル（＋GSI）に対してのみ読み書きを許可する専用ポリシーを用意する。

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchWriteItem"
    ],
    "Resource": [
      "arn:aws:dynamodb:*:<ACCOUNT_ID>:table/EhimeSpots",
      "arn:aws:dynamodb:*:<ACCOUNT_ID>:table/EhimeSpots/index/*"
    ]
  }]
}
```

---

## 9. 環境変数（想定）

| 変数 | 用途 |
|---|---|
| `AWS_REGION` | 例: `ap-northeast-1` |
| `DYNAMODB_TABLE` | `EhimeSpots` |
| （認証情報） | 専用IAMキー（Bedrock用とは分離推奨） |
| `ADMIN_TOKEN` | 追加/更新API(P4–P6)の保護用トークン（書き込みのみ保護） |

---

## 10. 将来拡張（設計の余地）

- **エリア別取得**: `gsi_area`（PK=`prefecture` など）を追加。
- **口コミの分離**: 件数が増えたら `reviews` を別テーブル化（PK=`spotId`, SK=`reviewId`）。
- **承認フロー**: `status`（`draft`/`published`）属性＋GSIで公開分だけ配信。
- **地理検索の高度化**: geohash 属性＋GSIで範囲検索（現状は全件から距離計算で十分）。

---

## 参考: 作成コマンド例（設計確認用・実行は別途）

```bash
aws dynamodb create-table \
  --table-name EhimeSpots \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=id,AttributeType=S \
      AttributeName=category,AttributeType=S \
      AttributeName=name,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
      "IndexName=gsi_category,KeySchema=[{AttributeName=category,KeyType=HASH},{AttributeName=name,KeyType=RANGE}],Projection={ProjectionType=ALL}"
```
