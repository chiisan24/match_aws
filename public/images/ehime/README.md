# 愛媛の写真 配置ガイド (public/images/ehime/)

このフォルダに、下の表のファイル名で **JPEG (.jpg)** を保存してください。
ファイルを入れる前でもアプリは正常に動きます（画像が無い間は、各画面が
on-brand なプレースホルダー `PlaceholderImage` に自動フォールバックします）。

- 形式: `.jpg`
- 参照方法: アプリは `/images/ehime/<name>.jpg` という固定パスで読み込みます。
- 著作権: 紹介文・口コミはすべてモック（ダミー）です。写真はご自身で用意した
  / 利用許諾のあるものを配置してください。

## マニフェスト（filename | 被写体(photo) | 使う画面）

| filename | 被写体 (photo) | 使う画面 |
| --- | --- | --- |
| `welcome-ehime.jpg` | 愛媛の象徴的な風景（城・瀬戸内海・しまなみ海道の橋・みかん）。縦長(ポートレート)推奨 | 言語選択 (LanguageSelect) ヒーロー |
| `matsuyama-castle.jpg` | 松山城 | スワイプ (SwipeDeck) / お気に入り |
| `imabari-castle.jpg` | 今治城（海城） | スワイプ / お気に入り |
| `uwajima-castle.jpg` | 宇和島城（現存天守） | スワイプ / お気に入り |
| `kurushima-bridge.jpg` | 来島海峡大橋（しまなみ海道） | スワイプ / お気に入り |
| `kurushima-bridge-aerial.jpg` | 来島海峡大橋の空撮 | スワイプ / お気に入り（しまなみ海道 spot-shimanami の2枚目） |
| `shimanami.jpg` | しまなみ海道（kurushima-bridge の別名/予備） | 予備（任意） |
| `onsen-bath.jpg` | 温泉の浴場・湯けむり | スワイプ / お気に入り（道後温泉エリア） |
| `dogo-onsen-station.jpg` | 道後温泉駅（レトロな駅舎） | スワイプ / お気に入り |
| `uchiko-townscape.jpg` | 内子の白壁の町並み | スワイプ / お気に入り |
| `ishiteji-temple.jpg` | 石手寺（第51番札所） | お遍路 地図/一覧 (temple 51) |
| `shrine.jpg` | 神社（狛犬のある社） | スワイプ / お気に入り（瀬戸内の古社 spot-setouchi-shrine） |
| `tobe-zoo-polarbear.jpg` | とべ動物園のホッキョクグマ | スワイプ / お気に入り |
| `cattle-karst.jpg` | 四国カルストの放牧の牛 | スワイプ / お気に入り |
| `mountain-ridge.jpg` | 石鎚山系の稜線 | スワイプ / お気に入り |
| `omishima-museum.jpg` | 大三島美術館（外観など） | スワイプ / お気に入り |
| `museum-stairs.jpg` | 美術館の階段 | スワイプ / お気に入り（美術館の階段と回廊 spot-museum-corridor の2枚目） |
| `museum-corridor.jpg` | 美術館の回廊 | スワイプ / お気に入り（美術館の階段と回廊 spot-museum-corridor） |
| `lighthouse.jpg` | 佐田岬の灯台 | スワイプ / お気に入り |
| `sotodomari-village.jpg` | 外泊 石垣の里 | スワイプ / お気に入り |
| `tobeyaki-shop.jpg` | 砥部焼の器・窯元/お店 | スワイプ / お気に入り（おみやげ） |
| `michi-no-eki.jpg` | 道の駅・みかん物産（みかん加工品など） | スワイプ / お気に入り（おみやげ） |
| `autumn-bridge.jpg` | 滑床渓谷の紅葉と橋 | スワイプ / お気に入り |
| `garden-zashiki.jpg` | 庭園・座敷（紅葉） | スワイプ / お気に入り（庭園と座敷 spot-garden-zashiki） |
| `fujiwara-bridge.jpg` | 藤原大橋（山あいのアーチ橋） | スワイプ / お気に入り（藤原大橋 spot-fujiwara-bridge） |
| `shipyard.jpg` | 造船所（今治など） | スワイプ / お気に入り（今治の造船所 spot-imabari-shipyard） |
| `rice-straw.jpg` | 稲わら・田園風景（にお積み） | スワイプ / お気に入り（稲わらの田園風景 spot-rice-straw） |
| `seaside-station.jpg` | 海辺の駅（下灘など） | スワイプ / お気に入り（海辺の駅 spot-seaside-station） |
| `seaside-rails.jpg` | 海辺の線路（干潮の軌道跡） | スワイプ / お気に入り（海辺の線路 spot-seaside-rails） |
| `brick-studio.jpg` | 煉瓦のスタジオ/建物（手しごと工房） | スワイプ / お気に入り（煉瓦の手しごと工房 spot-brick-studio・おみやげ） |

### 「予備」と書かれたファイルについて
現在は `shimanami.jpg`（`kurushima-bridge.jpg` の別名/予備）のみが予備です。
その他の写真はすべて `src/adapters/mock/spots.ts` のスポットから参照されています。
予備ファイルは将来スポットや札所を増やすときの差し替え候補です。今すぐ用意する
必要はありません。表のうち「使う画面」が指定されているものを優先して配置してください。

### 動作の仕組み（フォールバック）
- スワイプ画面 (`SwipeDeck` の `SpotPhoto`) とお気に入り (`FavoritesView` の
  `SpotThumb`) は `<img onError>` でプレースホルダーに切り替わります。
- 言語選択ヒーロー (`LanguageSelect` の `WelcomeHero`) も同様にフォールバックします。
- よって、画像ファイルが無い・読み込めない場合でも UI は壊れません。
