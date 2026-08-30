/**
 * Tourism tab-content registry — the seam that lets 通常観光モード tabs mount
 * their real screen components.
 *
 * {@link ModeShell} looks up the active tourism tab in {@link TOURISM_TAB_CONTENT}
 * and mounts the renderer it finds. The registry is a total
 * `Record<TourismTab, TourismTabRenderer>`, so every {@link TourismTab} has a
 * screen and the shell needs no placeholder fallback; adding a tab id without a
 * screen is a type error here (Req 7.11):
 *
 *  - `map`       → TourismLayeredMap
 *  - `favorites` → FavoritesView
 *  - `shiori`    → ShioriEditor / PlanShare
 *
 * Each renderer receives a small {@link TourismTabContext} carrying the
 * dependencies its screen needs — currently just the {@link MapLocationPort}
 * for the 重ねるマップ tab. All tourism tabs share the {@link TourismProvider}
 * store mounted above the shell, so the favorites and shiori collections
 * persist across tab switches.
 */

import type { ReactNode } from "react";

import type { TourismTab } from "../../app/modeManager";
import type { MapLocationPort } from "../../ports";
import { FavoritesView } from "./FavoritesView";
import { ShioriEditor } from "./ShioriEditor";
import { TourismLayeredMap } from "./TourismLayeredMap";

/** Context handed to each tourism tab renderer. */
export interface TourismTabContext {
  /** Map/location backend for the 重ねるマップ tab (inject `gateway.map`). */
  map: MapLocationPort;
}

/** A function that renders the content for a tourism tab. */
export type TourismTabRenderer = (ctx: TourismTabContext) => ReactNode;

/**
 * Registry of screens by tourism tab id, total over {@link TourismTab}. The
 * shell mounts whatever it finds here, so a missing entry is a compile error
 * rather than a placeholder at runtime.
 */
export const TOURISM_TAB_CONTENT: Record<TourismTab, TourismTabRenderer> = {
  map: ({ map }) => <TourismLayeredMap map={map} />,
  favorites: () => <FavoritesView />,
  shiori: () => <ShioriEditor />,
};
