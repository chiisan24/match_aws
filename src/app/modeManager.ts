/**
 * ModeManager — pure, side-effect-free logic for the two app modes
 * (通常観光モード / お遍路モード) and the per-mode UI state that must survive
 * switching back and forth (Req 2.1–2.5, design Q4).
 *
 * The React wiring (provider + hook + persistence) lives in `ModeContext.tsx`;
 * everything here is a pure function over plain data so it can be exhaustively
 * verified — including Property 3 (モード切替の状態保持/往復): switching mode and
 * returning leaves the preserved state untouched.
 */

/** The two top-level experiences the app offers. */
export type AppMode = "tourism" | "pilgrimage";

/**
 * The per-mode UI state we deliberately preserve across mode switches. Today
 * this is the active bottom-nav tab for each mode; keeping it in a single
 * store (rather than in component state that unmounts) is what makes the
 * round-trip in Property 3 hold — flipping to the other mode and back lands the
 * user exactly where they left off.
 */
export interface ModeState {
  /** The currently selected mode. */
  current: AppMode;
  /** Active tab id per mode, retained even while the other mode is showing. */
  tabByMode: Record<AppMode, string>;
}

/**
 * Bottom-nav tabs for 通常観光モード (Req 2.2): チャット / スワイプ / お気に入り /
 * しおり. The real screens arrive in tasks 8/10/11; for now each tab mounts a
 * labelled placeholder panel.
 */
export const TOURISM_TABS = [
  "chat",
  "swipe",
  "favorites",
  "shiori",
] as const;
export type TourismTab = (typeof TOURISM_TABS)[number];

/**
 * Bottom-nav tabs for お遍路モード (Req 2.3), matching the mockup:
 * ホーム / マップ / 納経帳 / マイページ.
 */
export const PILGRIMAGE_TABS = [
  "home",
  "map",
  "nokyocho",
  "mypage",
] as const;
export type PilgrimageTab = (typeof PILGRIMAGE_TABS)[number];

/** The default landing tab for each mode. */
const DEFAULT_TAB: Record<AppMode, string> = {
  tourism: TOURISM_TABS[0],
  pilgrimage: PILGRIMAGE_TABS[0],
};

/** All modes in display order (used by the toggle / mode-select screen). */
export const APP_MODES: readonly AppMode[] = ["tourism", "pilgrimage"];

/** Returns the other mode — the target of a toggle. */
export function otherMode(mode: AppMode): AppMode {
  return mode === "tourism" ? "pilgrimage" : "tourism";
}

/** True when `value` is a valid {@link AppMode} (used when rehydrating storage). */
export function isAppMode(value: unknown): value is AppMode {
  return value === "tourism" || value === "pilgrimage";
}

/**
 * Builds the initial mode state. Defaults to 通常観光モード and each mode's first
 * tab; an explicit starting mode (e.g. from persisted storage) can be supplied.
 */
export function createInitialModeState(current: AppMode = "tourism"): ModeState {
  return {
    current,
    tabByMode: { ...DEFAULT_TAB },
  };
}

/**
 * Switches to `mode`, preserving every mode's tab (Req 2.5). Returns the same
 * reference when already on `mode` so React can skip needless re-renders. The
 * fact that `tabByMode` is copied verbatim is exactly what makes the
 * switch→switch-back round-trip an identity (Property 3).
 */
export function switchMode(state: ModeState, mode: AppMode): ModeState {
  if (state.current === mode) return state;
  return { current: mode, tabByMode: { ...state.tabByMode } };
}

/** Toggles to the other mode, preserving per-mode state (Req 2.4, 2.5). */
export function toggleMode(state: ModeState): ModeState {
  return switchMode(state, otherMode(state.current));
}

/**
 * Records the active tab for a mode without changing which mode is current.
 * Returns the same reference when nothing changes.
 */
export function setTab(
  state: ModeState,
  mode: AppMode,
  tab: string,
): ModeState {
  if (state.tabByMode[mode] === tab) return state;
  return {
    current: state.current,
    tabByMode: { ...state.tabByMode, [mode]: tab },
  };
}

/** The active tab id for the currently selected mode. */
export function activeTab(state: ModeState): string {
  return state.tabByMode[state.current];
}
