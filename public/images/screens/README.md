# 画面用の写真 配置ガイド (public/images/screens/)

言語選択画面とモード選択画面で使う写真を、下の表のファイル名で
**JPEG (.jpg)** として保存してください。

ファイルを入れる前でもアプリは正常に動きます（画像が無い間は、各画面が
on-brand なプレースホルダー `PlaceholderImage` に自動フォールバックします）。

- 形式: `.jpg`
- 参照方法: アプリは `/images/screens/<name>.jpg` という固定パスで読み込みます。
- 著作権: ご自身で用意した / 利用許諾のある写真を配置してください。

## マニフェスト（filename | 被写体(photo) | 使う画面）

| filename | 被写体 (photo) | 使う画面 |
| --- | --- | --- |
| `welcome.jpg` | 愛媛の象徴的な風景（城・瀬戸内海・しまなみ海道の橋・みかんなど）。縦長(ポートレート)推奨 | 言語選択 (LanguageSelect) ヒーロー |
| `mode-tourism.jpg` | 通常観光のイメージ（観光名所・街並み・自然など）。横長(16:9)推奨 | モード選択 (ModeSelect) 観光カード |
| `mode-pilgrimage.jpg` | お遍路のイメージ（札所・お寺・遍路道など）。横長(16:9)推奨 | モード選択 (ModeSelect) お遍路カード |

## 動作の仕組み（フォールバック）
- 言語選択ヒーロー (`LanguageSelect` の `WelcomeHero`) とモード選択カード
  (`ModeSelect` の `ModeHero`) は `<img onError>` でプレースホルダーに切り替わります。
- よって、画像ファイルが無い・読み込めない場合でも UI は壊れません。

> 補足: 愛媛のスポット写真（スワイプ/お気に入りなど）は
> `public/images/ehime/` に配置します（同フォルダの README 参照）。
