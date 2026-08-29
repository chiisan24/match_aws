/**
 * Global debug-flow switch.
 *
 * The DEV guard prevents debug shortcuts and fixtures from being enabled in a
 * production build, even if the environment variable is set accidentally.
 */
export const debugModeEnabled =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_MODE === "true";

/**
 * デバッグ用スキップ導線（ルートビルダー / スワイプタブ）を表示するか。
 *
 * ローカルの `vite dev` だけでなく、ビルド済みのプレビュー環境
 * （`vite preview` / Vercel のプレビューデプロイ）でも動作確認したいので、
 * 明示的な `"true"` は DEV ガードより優先する:
 *
 *  | ビルド    | VITE_DEBUG_SKIP_SWIPE | 結果                             |
 *  | --------- | --------------------- | -------------------------------- |
 *  | dev       | 未設定                | VITE_DEBUG_MODE に従う           |
 *  | dev       | "false"               | 非表示                           |
 *  | 本番/preview | "true"             | 表示（プレビュー確認用）          |
 *  | 本番/preview | 未設定 / "false"   | 非表示 ← リリース時はこれ         |
 *
 * リリース時は Vercel の環境変数から `VITE_DEBUG_SKIP_SWIPE` を消す（または
 * "false" にする）だけでよい。その場合この定数は静的に false へ畳まれるため、
 * UI とハンドラは dead code として bundler が落とす。
 */
export const debugSkipSwipeEnabled =
  import.meta.env.VITE_DEBUG_SKIP_SWIPE === "true"
  || (debugModeEnabled && import.meta.env.VITE_DEBUG_SKIP_SWIPE !== "false");
