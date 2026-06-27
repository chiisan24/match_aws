/**
 * ModeShell — the per-mode layout that hosts both 通常観光モード (Req 2.2) and
 * お遍路モード (Req 2.3, 18.4 / 18.5).
 *
 * It reads the shared {@link useMode} store, so switching modes (via the header
 * or settings toggle) re-renders this same shell with the other mode's tabs and
 * panels while the per-mode active tab is preserved in the store (Req 2.5,
 * Property 3) — nothing is lost on the round-trip.
 *
 * Tourism tabs mount their real screen when one is registered in
 * {@link TOURISM_TAB_CONTENT} (chat is live as of task 8.1); every other tab —
 * and all お遍路モード tabs — falls back to a clearly-labelled placeholder panel
 * until its screen lands (tasks 8.3 / 8.5 / 8.8, 10 and 11).
 */

import type { ReactNode } from "react";

import {
  PILGRIMAGE_TABS,
  TOURISM_TABS,
  type AppMode,
  type PilgrimageTab,
  type TourismTab,
} from "../../app/modeManager";
import { useMode } from "../../app/ModeContext";
import type { ChatPort, MapLocationPort, StoragePort } from "../../ports";
import { useI18n } from "../../i18n";
import { AppHeader } from "../components/AppHeader";
import { BottomNav, type BottomNavItem } from "../components/BottomNav";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { SectionHeader } from "../components/SectionHeader";
import { PILGRIMAGE_TAB_CONTENT } from "./pilgrimageTabs";
import { TOURISM_TAB_CONTENT } from "./tourismTabs";

export interface ModeShellProps {
  /** Open the settings screen (header gear — the other toggle surface, Q4). */
  onOpenSettings: () => void;
  /** Map/location backend for お遍路 screens (inject `gateway.map`, Req 8.5). */
  map: MapLocationPort;
  /** AI backend for the 今日のお遍路プラン (inject `gateway.chat`, Req 12.5). */
  chat: ChatPort;
  /** Storage backend for the 到着ログ offline queue (inject `gateway.storage`, Req 13.5/13.6). */
  storage: StoragePort;
}

/** Per-tab metadata: nav label, icon and the placeholder panel title. */
interface TabMeta {
  id: string;
  navKey: string;
  panelKey: string;
  icon: ReactNode;
  motif: "temple" | "spot" | "mikan";
}

const TAB_META: Record<AppMode, TabMeta[]> = {
  tourism: [
    { id: TOURISM_TABS[0], navKey: "nav.tourism.chat", panelKey: "panel.tourism.chat.title", icon: "💬", motif: "spot" },
    { id: TOURISM_TABS[1], navKey: "nav.tourism.swipe", panelKey: "panel.tourism.swipe.title", icon: "🃏", motif: "spot" },
    { id: TOURISM_TABS[2], navKey: "nav.tourism.favorites", panelKey: "panel.tourism.favorites.title", icon: "♥", motif: "mikan" },
    { id: TOURISM_TABS[3], navKey: "nav.tourism.shiori", panelKey: "panel.tourism.shiori.title", icon: "📖", motif: "spot" },
  ],
  pilgrimage: [
    { id: PILGRIMAGE_TABS[0], navKey: "nav.pilgrimage.home", panelKey: "panel.pilgrimage.home.title", icon: "🏠", motif: "temple" },
    { id: PILGRIMAGE_TABS[1], navKey: "nav.pilgrimage.map", panelKey: "panel.pilgrimage.map.title", icon: "🗺️", motif: "temple" },
    { id: PILGRIMAGE_TABS[2], navKey: "nav.pilgrimage.nokyocho", panelKey: "panel.pilgrimage.nokyocho.title", icon: "📜", motif: "temple" },
    { id: PILGRIMAGE_TABS[3], navKey: "nav.pilgrimage.mypage", panelKey: "panel.pilgrimage.mypage.title", icon: "👤", motif: "mikan" },
  ],
};

export function ModeShell({ onOpenSettings, map, chat, storage }: ModeShellProps): JSX.Element {
  const { t } = useI18n();
  const { mode, tab, switchMode, setTab } = useMode();

  const tabs = TAB_META[mode];
  // Fall back to the first tab if the persisted tab is somehow unknown.
  const active = tabs.find((m) => m.id === tab) ?? tabs[0];

  const navItems: BottomNavItem[] = tabs.map((m) => ({
    id: m.id,
    label: t(m.navKey),
    icon: m.icon,
  }));

  // Mount a real tourism screen when one is registered for the active tab;
  // otherwise fall back to the labelled placeholder panel (tasks 8.3/8.5/8.8).
  const tourismRenderer =
    mode === "tourism"
      ? TOURISM_TAB_CONTENT[active.id as TourismTab]
      : undefined;

  // Likewise mount a real お遍路 screen when registered (札所マップ as of task
  // 10.1); other pilgrimage tabs fall back to the placeholder (tasks 10.4/10.5).
  const pilgrimageRenderer =
    mode === "pilgrimage"
      ? PILGRIMAGE_TAB_CONTENT[active.id as PilgrimageTab]
      : undefined;

  return (
    <div className="mode-shell" data-mode={mode}>
      <AppHeader
        mode={mode}
        tourismLabel={t("mode.tourism.name")}
        pilgrimageLabel={t("mode.pilgrimage.name")}
        currentLabel={t("mode.current")}
        switchAriaLabel={t("header.modeSwitch")}
        settingsLabel={t("header.settings")}
        onSelectMode={switchMode}
        onOpenSettings={onOpenSettings}
      />

      <div className="mode-shell__content" role="region" aria-label={t(active.navKey)}>
        {tourismRenderer ? (
          tourismRenderer({ goToTab: (id) => setTab(id) })
        ) : pilgrimageRenderer ? (
          pilgrimageRenderer({ goToTab: (id) => setTab(id), map, chat, storage })
        ) : (
          <PlaceholderPanel
            title={t(active.panelKey)}
            note={t("common.comingSoon")}
            motif={active.motif}
          />
        )}
      </div>

      <BottomNav
        items={navItems}
        activeId={active.id}
        onSelect={(id) => setTab(id)}
        label={t("mode.current")}
      />
    </div>
  );
}

interface PlaceholderPanelProps {
  title: string;
  note: string;
  motif: "temple" | "spot" | "mikan";
}

/**
 * Clearly-labelled stand-in for a not-yet-built screen. Keeps the layout honest
 * (header + content + nav) so the mode routing can be exercised end to end
 * before the real screens land.
 */
function PlaceholderPanel({
  title,
  note,
  motif,
}: PlaceholderPanelProps): JSX.Element {
  return (
    <section className="mode-panel" data-testid="mode-panel">
      <SectionHeader eyebrow="EHIME" title={title} />
      <div className="mode-panel__art">
        <PlaceholderImage motif={motif} label={title} sublabel={note} aspectRatio="4 / 3" />
      </div>
      <p className="mode-panel__note">{note}</p>
    </section>
  );
}
