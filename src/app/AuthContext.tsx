/**
 * Auth React wiring: the {@link AuthProvider} context and {@link useAuth} hook
 * (Req 15).
 *
 * Responsibilities:
 *  - Hold the current {@link Session} (or `null` when signed out) and expose
 *    `login` / `logout` so login state is available app-wide.
 *  - Establish a session **only** on a successful authentication (Req 15.1,
 *    Property 26): a failed `login` returns `null` and leaves the session
 *    untouched, so no session is ever created from bad credentials.
 *  - Honour the "ログイン状態を保持する" (remember) flag — it is passed straight
 *    through to the {@link AuthPort}, which persists remembered sessions so a
 *    fresh launch can restore them (Req 15.2, Property 27).
 *  - Rehydrate any remembered session on mount via `auth.currentSession()` so a
 *    returning user is already signed in (Req 15.2).
 *  - `logout` discards the session everywhere (Req 15.4, Property 28).
 *
 * The {@link AuthPort} is injected as a prop so the provider stays fully
 * injectable/testable — tests pass a fake/mock port, the app passes
 * `gateway.auth` (the mock adapter when AWS is not configured, Req 15.5).
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

import type { AuthPort, Session } from "../ports";

export interface AuthContextValue {
  /** The current session, or `null` when signed out. */
  session: Session | null;
  /** True while the initial session rehydration is in flight. */
  initializing: boolean;
  /** Convenience flag — a session is established. */
  isAuthenticated: boolean;
  /**
   * Attempt to sign in. Returns the established {@link Session} on success or
   * `null` on invalid credentials (Req 15.1, 15.3). The session is only stored
   * in context state when authentication succeeds (Property 26).
   */
  login: (
    email: string,
    password: string,
    remember: boolean,
  ) => Promise<Session | null>;
  /** Sign out, discarding the session everywhere (Req 15.4, Property 28). */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  /** Auth backend; inject `gateway.auth` in the app, a fake/mock in tests. */
  auth: AuthPort;
  /** When false, skip rehydrating the persisted session on mount (tests). */
  rehydrate?: boolean;
  children: ReactNode;
}

export function AuthProvider({
  auth,
  rehydrate = true,
  children,
}: AuthProviderProps): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState<boolean>(rehydrate);

  // Restore a remembered session on mount so a returning user is already
  // signed in (Req 15.2). Never throws — storage problems just leave the user
  // signed out.
  useEffect(() => {
    if (!rehydrate) return;
    let cancelled = false;
    void (async () => {
      try {
        const existing = await auth.currentSession();
        if (!cancelled) setSession(existing);
      } catch {
        // Session backend unavailable — treat as signed out, app still works.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, rehydrate]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      remember: boolean,
    ): Promise<Session | null> => {
      const result = await auth.login(email, password, remember);
      // Establish the session ONLY on success (Req 15.1, Property 26); a failed
      // attempt leaves any existing session state untouched.
      if (result) {
        setSession(result);
      }
      return result;
    },
    [auth],
  );

  const logout = useCallback(async (): Promise<void> => {
    await auth.logout();
    setSession(null);
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      isAuthenticated: session !== null,
      login,
      logout,
    }),
    [session, initializing, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside an {@link AuthProvider}. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return ctx;
}
