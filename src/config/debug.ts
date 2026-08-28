/**
 * Global debug-flow switch.
 *
 * The DEV guard prevents debug shortcuts and fixtures from being enabled in a
 * production build, even if the environment variable is set accidentally.
 */
export const debugModeEnabled =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_MODE === "true";

/**
 * デバッグ用「スワイプをスキップ」導線を表示するか。
 *
 * リリース時にこの導線だけ落とせるよう、専用の環境変数で個別に制御できる:
 *  - `VITE_DEBUG_SKIP_SWIPE=false` … デバッグモード中でもスキップ導線を隠す
 *  - 未設定                        … {@link debugModeEnabled} に従う
 *
 * 判定は {@link debugModeEnabled} を経由するため DEV ガードも継承する。
 * 本番ビルドでは値に関係なく常に false になり、UI とハンドラごと
 * dead code になるので bundler が落とせる。
 */
export const debugSkipSwipeEnabled =
  debugModeEnabled && import.meta.env.VITE_DEBUG_SKIP_SWIPE !== "false";
