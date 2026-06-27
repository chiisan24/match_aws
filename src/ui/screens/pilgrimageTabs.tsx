/**
 * Pilgrimage tab-content registry — the seam that lets お遍路モード tabs mount
 * real screen components, falling back to the shell's placeholder panel where a
 * screen is not yet built.
 *
 * Mirrors {@link TOURISM_TAB_CONTENT}: {@link ModeShell} looks up the active
 * pilgrimage tab here and, if a renderer is registered, mounts it; otherwise it
 * shows the labelled placeholder. This keeps the routing honest and gives the
 * remaining お遍路 tasks a single, obvious place to plug their screens in:
 *
 *  - `home`     → ProgressDashboard            (task 10.4)
 *  - `map`      → {@link TempleMap}             (task 10.1 — done here)
 *  - `nokyocho` → NokyochoView                  (task 10.5)
 *  - `mypage`   → {@link PilgrimagePlanner}     (task 11.1 — 今日のお遍路プラン)
 *
 * Each renderer receives a small {@link PilgrimageTabContext} carrying the
 * dependencies a pilgrimage screen needs — the {@link MapLocationPort} for the
 * map tab and a `goToTab` to move the user between tabs.
 */

import { useState, type ReactNode } from "react";

import type { PilgrimageTab } from "../../app/modeManager";
import { usePilgrimage } from "../../app/PilgrimageContext";
import type { ChatPort, MapLocationPort, StoragePort } from "../../ports";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { ArrivalNotifier } from "./ArrivalSheet";
import { LayeredMap } from "./LayeredMap";
import { NokyochoView } from "./NokyochoView";
import { PilgrimagePlanner } from "./PilgrimagePlanner";
import { ProgressDashboard } from "./ProgressDashboard";
import { TempleMap } from "./TempleMap";

/** Context handed to each pilgrimage tab renderer. */
export interface PilgrimageTabContext {
  /** Switch the active pilgrimage tab. */
  goToTab: (tab: PilgrimageTab) => void;
  /** Map/location backend (mock by default — Req 8.5). */
  map: MapLocationPort;
  /** AI backend for the 今日のお遍路プラン (mock by default — Req 12.5). */
  chat: ChatPort;
  /** Storage backend for the 到着ログ offline queue (mock by default — Req 13.5/13.6). */
  storage: StoragePort;
}

/** A function that renders the content for a pilgrimage tab. */
export type PilgrimageTabRenderer = (ctx: PilgrimageTabContext) => ReactNode;

/**
 * Wrapper component for the 札所マップ tab. Bridges the shared
 * {@link usePilgrimage} state (the visited set) into {@link TempleMap}'s
 * `visited` prop, so the 未訪問のみ filter reflects the same訪問済 state the
 * progress/nokyocho screens (tasks 10.4 / 10.5) maintain — while TempleMap
 * itself stays a pure, prop-driven, easily-tested component.
 *
 * A small view toggle lets the user switch between the 札所マップ (numbered
 * temple pins) and the 重ねるマップ (information layers — Req 14) on the same
 * tab, without disturbing the ArrivalNotifier which stays mounted underneath in
 * both views so 到着 (Req 13) keeps working regardless of the active view.
 */
function MapTab({
  map,
  storage,
}: {
  map: MapLocationPort;
  storage: StoragePort;
}): JSX.Element {
  const { t } = useI18n();
  const { visited } = usePilgrimage();
  const [view, setView] = useState<"satsu" | "layered">("satsu");

  return (
    <>
      <div
        className="map-view-toggle"
        role="group"
        aria-label={t("map.viewToggle.label")}
        data-testid="map-view-toggle"
      >
        <Button
          variant={view === "satsu" ? "primary" : "ghost"}
          size="sm"
          leading="📍"
          aria-pressed={view === "satsu"}
          onClick={() => setView("satsu")}
        >
          {t("map.viewToggle.satsu")}
        </Button>
        <Button
          variant={view === "layered" ? "primary" : "ghost"}
          size="sm"
          leading="🗺️"
          aria-pressed={view === "layered"}
          onClick={() => setView("layered")}
        >
          {t("map.viewToggle.layered")}
        </Button>
      </div>

      {view === "satsu" ? (
        <TempleMap map={map} visited={visited} />
      ) : (
        <LayeredMap map={map} />
      )}

      {/* 札所到着時の自動表示 (Req 13) — geofence watch + 到着シート + オフライン
          同期。Stays mounted under both views so 到着 happens in the map context;
          a manual 「到着をシミュレート」 keeps it demoable without real GPS. */}
      <ArrivalNotifier map={map} storage={storage} />
    </>
  );
}

/**
 * Registry of real screens by pilgrimage tab id. Tabs without an entry fall back
 * to the shell's placeholder panel — so tasks 10.4 / 10.5 just add their
 * renderer here when their screen lands.
 */
export const PILGRIMAGE_TAB_CONTENT: Partial<
  Record<PilgrimageTab, PilgrimageTabRenderer>
> = {
  home: ({ map, goToTab }) => (
    <ProgressDashboard
      map={map}
      onOpenMap={() => goToTab("map")}
      onOpenPlan={() => goToTab("mypage")}
    />
  ),
  map: ({ map, storage }) => <MapTab map={map} storage={storage} />,
  nokyocho: ({ map }) => <NokyochoView map={map} />,
  mypage: ({ chat, map }) => <PilgrimagePlanner chat={chat} map={map} />,
};
