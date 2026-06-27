/**
 * Mode React wiring: the {@link ModeProvider} context and {@link useMode} hook.
 *
 * Responsibilities:
 *  - Hold the {@link ModeState} (current mode + per-mode active tab) in a single
 *    store so the state survives switching modes and back (Req 2.5, Property 3).
 *    The pure transitions live in `modeManager.ts`; this layer adds React state
 *    and persistence only.
 *  - Persist the current mode through the injected {@link StoragePort} under the
 *    `"mode"` key, and rehydrate it on mount.
 *  - Expose `switchMode` / `toggleMode` for the header + settings toggles (both
 *    adopted per Q4) and `setTab` for the per-mode bottom navigation.
 *
 * The `StoragePort` is a prop so the provider stays injectable/testable — tests
 * pass a fake storage, the app passes `gateway.storage`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { StorageKey } from "../domain/types";
import type { StoragePort } from "../ports";
import {
  activeTab as selectActiveTab,
  createInitialModeState,
  isAppMode,
  setTab as setTabPure,
  switchMode as switchModePure,
  toggleMode as toggleModePure,
  type AppMode,
  type ModeState,
} from "./modeManager";

const MODE_STORAGE_KEY: StorageKey = "mode";

export interface ModeContextValue {
  /** The currently selected mode. */
  mode: AppMode;
  /** The active bottom-nav tab for the current mode. */
  tab: string;
  /** Full mode state (exposed for advanced callers / tests). */
  state: ModeState;
  /** Switch to a specific mode, preserving per-mode state (Req 2.5). */
  switchMode: (mode: AppMode) => void;
  /** Toggle to the other mode (header + settings toggles, Q4). */
  toggleMode: () => void;
  /** Set the active tab for the current (or a given) mode. */
  setTab: (tab: string, mode?: AppMode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export interface ModeProviderProps {
  /** Persistence backend; inject `gateway.storage` in the app, a fake in tests. */
  storage: StoragePort;
  /** Initial mode before rehydration. Defaults to 通常観光モード. */
  initialMode?: AppMode;
  /** When false, skip reading the persisted mode on mount (tests). */
  rehydrate?: boolean;
  children: ReactNode;
}

export function ModeProvider({
  storage,
  initialMode = "tourism",
  rehydrate = true,
  children,
}: ModeProviderProps): JSX.Element {
  const [state, setState] = useState<ModeState>(() =>
    createInitialModeState(initialMode),
  );

  // Rehydrate the previously-selected mode on mount.
  useEffect(() => {
    if (!rehydrate) return;
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<AppMode>(MODE_STORAGE_KEY);
        if (!cancelled && isAppMode(saved)) {
          setState((prev) => switchModePure(prev, saved));
        }
      } catch {
        // Storage unavailable — keep the default mode, the app still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage, rehydrate]);

  /** Persist the current mode; never blocks or breaks the UI on failure. */
  const persistMode = useCallback(
    (mode: AppMode): void => {
      void (async () => {
        try {
          await storage.save<AppMode>(MODE_STORAGE_KEY, mode);
        } catch {
          // Persistence failed — in-memory mode still updates so the user sees
          // the switch; we simply could not remember it for next time.
        }
      })();
    },
    [storage],
  );

  const switchMode = useCallback(
    (mode: AppMode): void => {
      setState((prev) => switchModePure(prev, mode));
      persistMode(mode);
    },
    [persistMode],
  );

  const toggleMode = useCallback((): void => {
    setState((prev) => {
      const next = toggleModePure(prev);
      persistMode(next.current);
      return next;
    });
  }, [persistMode]);

  const setTab = useCallback((tab: string, mode?: AppMode): void => {
    setState((prev) => setTabPure(prev, mode ?? prev.current, tab));
  }, []);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode: state.current,
      tab: selectActiveTab(state),
      state,
      switchMode,
      toggleMode,
      setTab,
    }),
    [state, switchMode, toggleMode, setTab],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** Access the mode context. Throws if used outside a {@link ModeProvider}. */
export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (ctx === null) {
    throw new Error("useMode must be used within a <ModeProvider>.");
  }
  return ctx;
}
