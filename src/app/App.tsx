import { useMemo, useState, type ReactNode } from "react";

import type { LangCode, RecommendedPlan } from "../domain/types";
import type { ChatPort, MapLocationPort, StoragePort } from "../ports";
import { I18nProvider, useI18n } from "../i18n";
import {
  AIPlanFirst,
  LanguageSelect,
  ModeShell,
  Settings,
  TourismRouteBuilder,
  WelcomeScreen,
} from "../ui/screens";
import { createGateway } from "./gateway";
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
            <LocalizedTourismProvider chat={gateway.chat} storage={gateway.storage}>
              <main className="app-shell">
                <AppFlow map={gateway.map} chat={gateway.chat} />
              </main>
            </LocalizedTourismProvider>
          </SpotProvider>
        </ImageProvider>
      </ModeProvider>
    </I18nProvider>
  );
}

/** Keeps the tourism chat session aligned with the selected UI language. */
function LocalizedTourismProvider({
  chat,
  storage,
  children,
}: {
  chat: ChatPort;
  storage: StoragePort;
  children: ReactNode;
}): JSX.Element {
  const { lang } = useI18n();
  return (
    <TourismProvider chat={chat} storage={storage} lang={lang}>
      {children}
    </TourismProvider>
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
  const { selectPlan } = useTourism();
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

  return <ModeShell onOpenSettings={() => setShowSettings(true)} map={map} />;
}
