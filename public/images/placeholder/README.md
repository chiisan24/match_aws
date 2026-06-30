# placeholder/ について

このフォルダのSVGファイル（例 `spot-dogo.svg`, `temple-51.svg` など）は
**必須ではありません**。

アプリのプレースホルダーは React コンポーネント `PlaceholderImage`
(`src/ui/components/PlaceholderImage.tsx`) によるインライン SVG として描画されます。
データ上の `imageUrls` に `/images/placeholder/*.svg` を指していても、ファイルが
存在しない場合は各 `<img>` の `onError` により `PlaceholderImage` に自動で
フォールバックするため、UI は壊れません。

実写真は `public/images/ehime/` に配置してください（同フォルダの README 参照）。
