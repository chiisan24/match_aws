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
 *  - `discover`  → DiscoveryScreen
 *  - `favorites` → FavoritesView
 *  - `shiori`    → ShioriEditor / PlanShare
 *
 * Each renderer receives a small {@link TourismTabContext} carrying the
 * dependencies its screen needs — the {@link MapLocationPort} goes to the
 * 重ねるマップ tab and to the しおり, which reads the current location once to show
 * how far the trip's starting point is. All tourism tabs share the
 * {@link TourismProvider} store mounted above the shell, so the favorites and
 * shiori collections persist across tab switches.
 */

import type { ReactNode } from "react";

import type { TourismTab } from "../../app/modeManager";
import type { MapLocationPort } from "../../ports";
import { DiscoveryScreen } from "./DiscoveryScreen";
import { FavoritesView } from "./FavoritesView";
import { ShioriEditor } from "./ShioriEditor";
import { TourismLayeredMap } from "./TourismLayeredMap";

/** Context handed to each tourism tab renderer. */
export interface TourismTabContext {
  /**
   * Map/location backend for the 重ねるマップ tab and the しおり's distance figures
   * (inject `gateway.map`).
   */
  map: MapLocationPort;
  /**
   * Leave the tabs and plan another trip. Optional because the shell is
   * mountable without it (tests), in which case the しおり hides the button
   * rather than offering an action that would do nothing.
   */
  onCreateItinerary?: () => void;
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
  discover: () => <DiscoveryScreen />,
  favorites: () => <FavoritesView />,
  shiori: ({ map, onCreateItinerary }) => (
    <ShioriEditor
      map={map}
      {...(onCreateItinerary ? { onCreateItinerary } : {})}
    />
  ),
};
