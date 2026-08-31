import { useMemo, useState } from "react";

import type { LangCode, RecommendedPlan } from "../domain/types";
import type { ChatPort, MapLocationPort } from "../ports";
import { I18nProvider } from "../i18n";
import {
  AIPlanFirst,
  LanguageSelect,
  ModeShell,
  Settings,
  TourismRouteBuilder,
  WelcomeScreen,
} from "../ui/screens";
import { createGateway } from "./gateway";
import { DiscoveryProvider } from "./DiscoveryContext";
import { ImageProvider } from "./ImageContext";
import { ModeProvider, useMode } from "./ModeContext";
import { SpotProvider } from "./SpotContext";
import { TourismProvider, useTourism } from "./TourismContext";

/**
 * App shell for the tourism-only experience.
 *
 * The first-run flow is:
 * language selection → five AI tourism ideas → route builder → tourism tabs.
 */
export function App(): JSX.Element {
  const gateway = useMemo(() => createGateway(), []);

  return (
    <I18nProvider storage={gateway.storage} translate={gateway.translate}>
      <ModeProvider storage={gateway.storage} rehydrate={false}>
        <ImageProvider image={gateway.image}>
          <SpotProvider spots={gateway.spots}>
            <TourismProvider storage={gateway.storage}>
              {/* 発見画面の進捗と写真キャッシュ。お気に入り (TourismProvider) を
                  読むので内側に置くが、永続化キーは独立している。 */}
              <DiscoveryProvider storage={gateway.storage}>
                <main className="app-shell">
                  <AppFlow map={gateway.map} chat={gateway.chat} />
                </main>
              </DiscoveryProvider>
            </TourismProvider>
          </SpotProvider>
        </ImageProvider>
      </ModeProvider>
    </I18nProvider>
  );
}

type Phase = "welcome" | "language" | "plan-select" | "route-builder" | "app";

interface AppFlowProps {
  map: MapLocationPort;
  chat: ChatPort;
}

function AppFlow({ map, chat }: AppFlowProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [routeTheme, setRouteTheme] = useState<RecommendedPlan | null>(null);
  const { switchMode, setTab } = useMode();
  const { selectPlan, saveItinerary } = useTourism();
  const [showSettings, setShowSettings] = useState(false);

  if (phase === "welcome") {
    return (
      <WelcomeScreen
        onStart={(_lang: LangCode) => setPhase("plan-select")}
        onChangeLanguage={() => setPhase("language")}
      />
    );
  }

  if (phase === "language") {
    return (
      <LanguageSelect
        onComplete={(_lang: LangCode) => setPhase("plan-select")}
      />
    );
  }

  if (phase === "plan-select") {
    return (
      <AIPlanFirst
        chat={chat}
        onStart={(plan) => {
          setRouteTheme({ ...plan, mode: "tourism" });
          switchMode("tourism");
          setPhase("route-builder");
        }}
      />
    );
  }

  if (phase === "route-builder" && routeTheme) {
    return (
      <TourismRouteBuilder
        chat={chat}
        theme={routeTheme}
        onBack={() => setPhase("plan-select")}
        onComplete={(plan) => {
          selectPlan(plan);
          // Keep the confirmed schedule so the しおり can show it with times and
          // a map after a reload. `selectPlan` only feeds the live map and is
          // deliberately not persisted, so without this the times are lost the
          // moment the builder unmounts.
          saveItinerary(plan);
          switchMode("tourism");
          setTab("map", "tourism");
          setPhase("app");
        }}
      />
    );
  }

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  return (
    <ModeShell
      onOpenSettings={() => setShowSettings(true)}
      map={map}
      // しおりは何本でも作れる: 保存済みは残したまま、プラン選択からやり直す。
      // `routeTheme` は次に選ばれたテーマで上書きされるので、ここでは触らない。
      onCreateItinerary={() => setPhase("plan-select")}
    />
  );
}
