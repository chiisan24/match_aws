import type { ReactNode } from "react";

import { TOURISM_TABS, type TourismTab } from "../../app/modeManager";
import { useMode } from "../../app/ModeContext";
import type { MapLocationPort } from "../../ports";
import { useI18n } from "../../i18n";
import { AppHeader } from "../components/AppHeader";
import { BottomNav, type BottomNavItem } from "../components/BottomNav";
import { TOURISM_TAB_CONTENT } from "./tourismTabs";

export interface ModeShellProps {
  onOpenSettings: () => void;
  map: MapLocationPort;
}

interface TabMeta {
  id: TourismTab;
  navKey: string;
  icon: ReactNode;
}

const TOURISM_TAB_META: TabMeta[] = [
  { id: TOURISM_TABS[0], navKey: "nav.tourism.map", icon: "🗺️" },
  { id: TOURISM_TABS[1], navKey: "nav.tourism.favorites", icon: "♥" },
  { id: TOURISM_TABS[2], navKey: "nav.tourism.shiori", icon: "📖" },
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
        {renderer({ map })}
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
