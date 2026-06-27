/**
 * Tourism tab-content registry — the seam that lets 通常観光モード tabs mount
 * real screen components, falling back to a placeholder where a screen is not
 * yet built.
 *
 * {@link ModeShell} looks up the active tourism tab in {@link TOURISM_TAB_CONTENT}.
 * If a renderer is registered it is mounted; otherwise the shell shows its
 * labelled placeholder panel. This keeps the routing honest and gives later
 * tasks a single, obvious place to plug their screens in:
 *
 *  - `chat`      → {@link ChatAdvisor}            (task 8.1 — done here)
 *  - `swipe`     → SwipeDeck                      (task 8.3)
 *  - `favorites` → FavoritesView                 (task 8.5)
 *  - `shiori`    → ShioriEditor / PlanShare       (task 8.8)
 *
 * Each renderer receives a small {@link TourismTabContext} so a screen can move
 * the user between tabs (e.g. chat → swipe for the candidate hand-off, Req 3.2).
 * All tourism tabs share the {@link TourismProvider} store mounted above the
 * shell, so chat session, swipe candidates and swipe history persist across tab
 * switches.
 */

import type { ReactNode } from "react";

import type { TourismTab } from "../../app/modeManager";
import { ChatAdvisor } from "./ChatAdvisor";
import { SwipeDeck } from "./SwipeDeck";
import { FavoritesView } from "./FavoritesView";
import { ShioriEditor } from "./ShioriEditor";

/** Context handed to each tourism tab renderer. */
export interface TourismTabContext {
  /** Switch the active tourism tab (e.g. hand off chat → swipe). */
  goToTab: (tab: TourismTab) => void;
}

/** A function that renders the content for a tourism tab. */
export type TourismTabRenderer = (ctx: TourismTabContext) => ReactNode;

/**
 * Registry of real screens by tourism tab id. Tabs without an entry fall back
 * to the shell's placeholder panel — so tasks 8.3 / 8.5 / 8.8 just add their
 * renderer here when their screen lands.
 */
export const TOURISM_TAB_CONTENT: Partial<
  Record<TourismTab, TourismTabRenderer>
> = {
  chat: ({ goToTab }) => <ChatAdvisor onOpenSwipe={() => goToTab("swipe")} />,
  swipe: ({ goToTab }) => <SwipeDeck onBackToChat={() => goToTab("chat")} />,
  favorites: () => <FavoritesView />,
  shiori: () => <ShioriEditor />,
};
