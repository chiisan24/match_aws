import type { ReactNode } from "react";

import { TOURISM_TABS, type TourismTab } from "../../app/modeManager";
import { useMode } from "../../app/ModeContext";
import type { MapLocationPort } from "../../ports";
import { useI18n } from "../../i18n";
import { AppHeader } from "../components/AppHeader";
import { BottomNav, type BottomNavItem } from "../components/BottomNav";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { SectionHeader } from "../components/SectionHeader";
import { TOURISM_TAB_CONTENT } from "./tourismTabs";

export interface ModeShellProps {
  onOpenSettings: () => void;
  map: MapLocationPort;
}

interface TabMeta {
  id: TourismTab;
  navKey: string;
  panelKey: string;
  icon: ReactNode;
  motif: "spot" | "mikan";
}

const TOURISM_TAB_META: TabMeta[] = [
  { id: TOURISM_TABS[0], navKey: "nav.tourism.chat", panelKey: "panel.tourism.chat.title", icon: "💬", motif: "spot" },
  { id: TOURISM_TABS[1], navKey: "nav.tourism.swipe", panelKey: "panel.tourism.swipe.title", icon: "🃏", motif: "spot" },
  { id: TOURISM_TABS[2], navKey: "nav.tourism.map", panelKey: "panel.tourism.map.title", icon: "🗺️", motif: "spot" },
  { id: TOURISM_TABS[3], navKey: "nav.tourism.favorites", panelKey: "panel.tourism.favorites.title", icon: "♥", motif: "mikan" },
  { id: TOURISM_TABS[4], navKey: "nav.tourism.shiori", panelKey: "panel.tourism.shiori.title", icon: "📖", motif: "spot" },
];

/** Tourism-only application shell. */
export function ModeShell({ onOpenSettings, map }: ModeShellProps): JSX.Element {
  const { t } = useI18n();
  const { tab, setTab } = useMode();
  const active = TOURISM_TAB_META.find((item) => item.id === tab) ?? TOURISM_TAB_META[0];
  const renderer = TOURISM_TAB_CONTENT[active.id];

  const navItems: BottomNavItem[] = TOURISM_TAB_META.map((item) => ({
    id: item.id,
    label: t(item.navKey),
    icon: item.icon,
  }));

  return (
    <div className="mode-shell" data-mode="tourism">
      <AppHeader
        tourismLabel={t("mode.tourism.name")}
        currentLabel={t("mode.current")}
        settingsLabel={t("header.settings")}
        onOpenSettings={onOpenSettings}
      />

      <div className="mode-shell__content" role="region" aria-label={t(active.navKey)}>
        {renderer ? (
          renderer({ goToTab: (id) => setTab(id, "tourism"), map })
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
        onSelect={(id) => setTab(id, "tourism")}
        label={t("mode.current")}
      />
    </div>
  );
}

interface PlaceholderPanelProps {
  title: string;
  note: string;
  motif: "spot" | "mikan";
}

function PlaceholderPanel({ title, note, motif }: PlaceholderPanelProps): JSX.Element {
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
