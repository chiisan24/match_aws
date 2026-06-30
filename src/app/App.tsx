import { useMemo, useState } from "react";

import type { LangCode } from "../domain/types";
import type { ChatPort, MapLocationPort, StoragePort } from "../ports";
import { I18nProvider } from "../i18n";
import {
  LanguageSelect,
  Login,
  ModeSelect,
  ModeShell,
  Settings,
} from "../ui/screens";
import { AuthProvider, useAuth } from "./AuthContext";
import { createGateway } from "./gateway";
import { ModeProvider, useMode } from "./ModeContext";
import { PilgrimageProvider } from "./PilgrimageContext";
import { TourismProvider } from "./TourismContext";

/**
 * App shell.
 *
 * Wires the AWS_Gateway (mock by default on Vercel), the i18n provider and the
 * ModeManager, then drives the first-run flow:
 *
 *   language selection → mode selection → per-mode layout
 *
 * From the per-mode layout the header and settings toggles let the user switch
 * modes at any time (Q4 — both surfaces), and settings also re-opens the
 * language picker (Req 1.4). Per-mode state is held in the {@link ModeProvider}
 * store so switching modes never loses where the user was (Req 2.5).
 *
 * Login is associated with お遍路モード (記録/進捗の継続保持, Req 15): entering
 * pilgrimage mode without a session shows the {@link Login} gate, while 通常
 * 観光モード is usable without signing in. Session state is provided app-wide by
 * the {@link AuthProvider}, backed by the gateway's mock AuthPort when AWS is
 * not configured (Req 15.5).
 */
export function App(): JSX.Element {
  // One gateway for the app lifetime; mock unless AWS env is configured.
  const gateway = useMemo(() => createGateway(), []);

  return (
    <I18nProvider storage={gateway.storage} translate={gateway.translate}>
      <ModeProvider storage={gateway.storage}>
        <AuthProvider auth={gateway.auth}>
          <TourismProvider chat={gateway.chat} storage={gateway.storage}>
            {/* Shared お遍路 state — the visited set read by the 札所マップ
                filter plus the progress store (selected 対象県, 達成率) and the
                visit-record seam the 巡礼進捗ダッシュボード (task 10.4) and
                デジタル納経帳 (task 10.5) build on. Persisted via the storage
                port under "progress" / "visitRecords". */}
            <PilgrimageProvider storage={gateway.storage}>
              <main className="app-shell">
                <AppFlow
                  map={gateway.map}
                  chat={gateway.chat}
                  storage={gateway.storage}
                />
              </main>
            </PilgrimageProvider>
          </TourismProvider>
        </AuthProvider>
      </ModeProvider>
    </I18nProvider>
  );
}

/** Top-level navigation phases of the shell. */
type Phase = "language" | "mode-select" | "app";

interface AppFlowProps {
  /** Map/location backend handed to お遍路 screens (Req 8.5). */
  map: MapLocationPort;
  /** AI backend handed to the 今日のお遍路プラン screen (Req 12.5). */
  chat: ChatPort;
  /** Storage backend handed to the 札所到着 offline queue (Req 13.5/13.6). */
  storage: StoragePort;
}

function AppFlow({ map, chat, storage }: AppFlowProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>("language");
  const { mode, switchMode } = useMode();
  const { isAuthenticated, initializing } = useAuth();
  // Settings overlays the current mode layout; track it independently so
  // returning lands back on the same mode/tab.
  const [showSettings, setShowSettings] = useState(false);

  if (phase === "language") {
    return (
      <LanguageSelect
        onComplete={(_lang: LangCode) => setPhase("mode-select")}
      />
    );
  }

  if (phase === "mode-select") {
    return (
      <ModeSelect
        onChoose={(mode) => {
          // Route into the chosen mode's layout, preserving per-mode state.
          switchMode(mode);
          setPhase("app");
        }}
      />
    );
  }

  // phase === "app": per-mode layout, with settings as an overlay screen.
  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  // Gate お遍路モード behind authentication (Req 15): the pilgrimage experience
  // keeps records/progress for the signed-in user, so it requires a session.
  // 通常観光モード stays open without login. While the remembered session is
  // still rehydrating we hold off so a logged-in user never flashes the gate.
  if (mode === "pilgrimage" && !isAuthenticated) {
    if (initializing) {
      return <div className="app-loading" aria-busy="true" />;
    }
    return <Login onBack={() => switchMode("tourism")} />;
  }

  return <ModeShell onOpenSettings={() => setShowSettings(true)} map={map} chat={chat} storage={storage} />;
}
