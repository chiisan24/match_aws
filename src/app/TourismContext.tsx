/**
 * Tourism React wiring: the {@link TourismProvider} context and {@link useTourism}
 * hook — the shared state seam for 通常観光モード (Req 3).
 *
 * This store is the hand-off point between the tourism screens that tasks
 * 8.1 / 8.3 / 8.5 / 8.8 build:
 *
 *  - **Chat session** (Req 3.1, 3.5): the running conversation with the AI
 *    advisor, sent/received through the injected {@link ChatPort}. Friendly,
 *    non-robotic copy comes from the adapter (mock by default — Req 3.6).
 *  - **Swipe candidate hand-off** (Req 3.2): when a chat reply carries
 *    `spotCandidates` (a destination-discovery moment), they are stored here so
 *    the swipe screen (task 8.3) can consume them via {@link useTourism}.
 *  - **Swipe history → preferences** (Req 3.3): the swipe screen records each
 *    swipe with {@link TourismContextValue.recordSwipe}; the accumulated history
 *    is folded into `session.preferences` with `buildSuggestionPayload`, so the
 *    next suggestion request reflects what the user liked / skipped.
 *  - **Error + retry** (Req 3.4): a failed `sendMessage` surfaces an error and
 *    {@link TourismContextValue.retry} re-runs the exact same request.
 *
 * The {@link ChatPort} is injected as a prop so the provider stays fully
 * injectable/testable — tests pass a fake port, the app passes `gateway.chat`
 * (the mock adapter when AWS is not configured, Req 3.6 / 16.2).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { reorder } from "../domain/reorder";
import { buildSuggestionPayload, type SwipeRecord } from "../domain/swipe";
import type {
  ChatMessage,
  ChatSession,
  LangCode,
  Spot,
  StorageKey,
} from "../domain/types";
import type { ChatPort, StoragePort } from "../ports";

/** Status of the chat request lifecycle, used to drive the UI. */
export type ChatStatus = "idle" | "sending" | "error";

/**
 * A saved travel plan surfaced under the favorites 「プラン」 tab (Req 5.2).
 *
 * Plan sharing / saving is task 8.8's territory; for the favorites screen this
 * is just the shape the プラン tab classifies, and the live list is empty until
 * that feature lands. Kept minimal on purpose.
 */
export interface FavoritePlan {
  id: string;
  title: string;
}

/** Which favorites tab an entry is classified into (excludes the すべて view). */
export type FavoriteTabKind = "spot" | "shiori" | "plan";

/**
 * One classified favorites entry. `key` is unique across every entry (it is
 * kind-scoped) so the same spot appearing in both スポット and しおり stays two
 * distinct entries — each belonging to exactly one tab (Property 9).
 */
export interface FavoriteEntry {
  /** Stable, globally-unique key (kind-scoped) for React + membership checks. */
  key: string;
  /** The tab this entry belongs to. */
  kind: FavoriteTabKind;
  /** The underlying spot for スポット / しおり entries (undefined for plans). */
  spot?: Spot;
  /** The underlying plan for プラン entries (undefined for spots). */
  plan?: FavoritePlan;
}

/** The favorites split into すべて + each per-type tab. */
export interface FavoriteTabClassification {
  /** すべて — the union of every tab, in spot → shiori → plan order. */
  all: FavoriteEntry[];
  /** スポット — spots swiped 行きたい (favorites). */
  spot: FavoriteEntry[];
  /** しおり — spots added to the しおり. */
  shiori: FavoriteEntry[];
  /** プラン — saved plans. */
  plan: FavoriteEntry[];
}

/**
 * Classify the favorites collections into the すべて/スポット/しおり/プラン tabs
 * (Req 5.2). Pure and total.
 *
 * Each source collection maps to exactly one tab, and every entry carries a
 * single {@link FavoriteEntry.kind}; the すべて list is the concatenation of the
 * three per-type lists. This makes the classification both **exhaustive** (the
 * union equals すべて) and **exclusive** (each entry lands in exactly one tab) by
 * construction — Property 9.
 */
export function classifyFavoriteTabs(
  favorites: Spot[],
  shiori: Spot[],
  plans: FavoritePlan[],
): FavoriteTabClassification {
  const spot: FavoriteEntry[] = favorites.map((s) => ({
    key: `spot:${s.id}`,
    kind: "spot",
    spot: s,
  }));
  const shioriEntries: FavoriteEntry[] = shiori.map((s) => ({
    key: `shiori:${s.id}`,
    kind: "shiori",
    spot: s,
  }));
  const planEntries: FavoriteEntry[] = plans.map((p) => ({
    key: `plan:${p.id}`,
    kind: "plan",
    plan: p,
  }));
  return {
    all: [...spot, ...shioriEntries, ...planEntries],
    spot,
    shiori: shioriEntries,
    plan: planEntries,
  };
}

export interface TourismContextValue {
  /** The running chat session (messages + accumulated preferences). */
  session: ChatSession;
  /** Convenience accessor for the conversation turns. */
  messages: ChatMessage[];
  /** Current chat request status (idle / sending / error). */
  chatStatus: ChatStatus;
  /** True while a request is in flight. */
  isSending: boolean;
  /** True when the last request failed and a retry is available (Req 3.4). */
  hasError: boolean;
  /** Spot candidates handed off from chat for the swipe deck (Req 3.2). */
  swipeCandidates: Spot[];
  /** True when there are candidates waiting to be swiped. */
  hasCandidates: boolean;
  /** The accumulated swipe history (drives preferences, Req 3.3). */
  swipeHistory: SwipeRecord[];
  /**
   * Spots swiped right — 「行きたい」/ お気に入り (Req 4.2). The home that the
   * favorites screen (task 8.5) consumes.
   */
  favorites: Spot[];
  /**
   * Spots swiped up — added to the しおり (Req 4.4). The home that the shiori
   * screen (task 8.8) consumes.
   */
  shiori: Spot[];
  /** Spots swiped down — saved to the 「後で見る」 list (Req 4.5). */
  later: Spot[];
  /** Send a user message to the AI advisor (Req 3.1). */
  sendMessage: (text: string) => Promise<void>;
  /** Re-run the most recent (failed) request unchanged (Req 3.4). */
  retry: () => Promise<void>;
  /** Record a swipe so it feeds back into suggestion preferences (Req 3.3). */
  recordSwipe: (record: SwipeRecord) => void;
  /** Clear the pending swipe candidates once the deck has consumed them. */
  clearCandidates: () => void;
  /** Add a spot to お気に入り — 右スワイプ (Req 4.2). De-duplicated by id. */
  addFavorite: (spot: Spot) => void;
  /** Remove a spot from お気に入り by id — leaves the favorites list (Req 5.3). */
  removeFavorite: (spotId: string) => void;
  /** Add a spot to the しおり — 上スワイプ (Req 4.4). De-duplicated by id. */
  addToShiori: (spot: Spot) => void;
  /** Remove a spot from the しおり by id — leaves the しおり (Req 6.3). */
  removeFromShiori: (spotId: string) => void;
  /**
   * Reorder the しおり, moving the item at `from` to `to` (Req 6.2). Pure
   * {@link reorder} under the hood, so order is preserved and elements are kept
   * (Property 11). Accessible up/down controls in the editor drive this.
   */
  reorderShiori: (from: number, to: number) => void;
  /** Add a spot to 「後で見る」 — 下スワイプ (Req 4.5). De-duplicated by id. */
  addToLater: (spot: Spot) => void;
}

const TourismContext = createContext<TourismContextValue | null>(null);

/** Storage key the しおり is persisted under (Req 6.4). */
const SHIORI_KEY: StorageKey = "shiori";

/** Internal store shape held in a single state object. */
interface TourismState {
  session: ChatSession;
  chatStatus: ChatStatus;
  swipeCandidates: Spot[];
  swipeHistory: SwipeRecord[];
  /** お気に入り (右スワイプ, Req 4.2). */
  favorites: Spot[];
  /** しおり (上スワイプ, Req 4.4). */
  shiori: Spot[];
  /** 後で見る (下スワイプ, Req 4.5). */
  later: Spot[];
}

export interface TourismProviderProps {
  /** Chat backend; inject `gateway.chat` in the app, a fake in tests. */
  chat: ChatPort;
  /**
   * Persistence backend; inject `gateway.storage` in the app, omit in tests.
   * When present the しおり is persisted (and rehydrated) under the `"shiori"`
   * key (Req 6.4 / Property 12). Resilient — a failed load/save never throws and
   * the in-memory しおり stays authoritative, so the UI keeps working.
   */
  storage?: StoragePort;
  /** Display language stamped on the session. Defaults to Japanese. */
  lang?: LangCode;
  children: ReactNode;
}

/** Best-effort unique id for a chat session (no external dependency). */
function newSessionId(): string {
  const globalCrypto = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `chat-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createInitialState(lang: LangCode): TourismState {
  return {
    session: {
      id: newSessionId(),
      lang,
      messages: [],
      preferences: { liked: [], disliked: [] },
    },
    chatStatus: "idle",
    swipeCandidates: [],
    swipeHistory: [],
    favorites: [],
    shiori: [],
    later: [],
  };
}

export function TourismProvider({
  chat,
  storage,
  lang = "ja",
  children,
}: TourismProviderProps): JSX.Element {
  const [state, setState] = useState<TourismState>(() =>
    createInitialState(lang),
  );

  // Guards saving until after the initial rehydration so a slow load never
  // clobbers persisted しおり with the empty initial value (Req 6.4).
  const shioriHydratedRef = useRef(false);

  // Rehydrate the しおり (key "shiori") once on mount. Resilient: any failure
  // leaves the in-memory state in place and the editor still works (Req 6.4).
  useEffect(() => {
    if (!storage) {
      shioriHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<Spot[]>(SHIORI_KEY);
        if (!cancelled && Array.isArray(saved)) {
          setState((s) => ({ ...s, shiori: saved }));
        }
      } catch {
        // Ignore — keep the in-memory しおり.
      }
      if (!cancelled) shioriHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Persist the しおり under "shiori" whenever it changes (after hydration).
  // Resilient by design: a failed save is swallowed so the UI continues
  // (Req 6.4) and the in-memory しおり remains authoritative.
  useEffect(() => {
    if (!storage || !shioriHydratedRef.current) return;
    void storage.save<Spot[]>(SHIORI_KEY, state.shiori).catch(() => {
      // Persistence failed — in-memory しおり remains authoritative.
    });
  }, [storage, state.shiori]);

  // The most recent request, kept so retry can re-run it verbatim (Req 3.4).
  // We remember the session *before* the user turn plus the user text, so a
  // retry never duplicates the user message already shown in the transcript.
  const lastRequest = useRef<{ baseSession: ChatSession; text: string } | null>(
    null,
  );

  /**
   * Performs the actual ChatPort call. `baseSession` is the session before the
   * user turn; `userMessage` is the turn being sent. On success the assistant
   * reply (and any spot candidates) is folded into the live session; on failure
   * the status flips to "error" while the transcript is preserved (Req 3.4).
   */
  const runRequest = useCallback(
    async (baseSession: ChatSession, userMessage: ChatMessage): Promise<void> => {
      const sessionForCall: ChatSession = {
        ...baseSession,
        messages: [...baseSession.messages, userMessage],
      };
      try {
        const reply = await chat.sendMessage(sessionForCall, userMessage.text);
        setState((s) => ({
          ...s,
          session: {
            ...s.session,
            messages: [
              ...s.session.messages,
              { role: "assistant", text: reply.message },
            ],
          },
          // Hand any discovery candidates to the swipe deck (Req 3.2).
          swipeCandidates: reply.spotCandidates ?? s.swipeCandidates,
          chatStatus: "idle",
        }));
      } catch {
        // Surface the failure; keep the conversation so retry can re-run it.
        setState((s) => ({ ...s, chatStatus: "error" }));
      }
    },
    [chat],
  );

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;

      const userMessage: ChatMessage = { role: "user", text: trimmed };

      // Snapshot the pre-turn session for an exact retry, then optimistically
      // show the user's message and the sending state.
      let baseSession!: ChatSession;
      setState((s) => {
        baseSession = s.session;
        return {
          ...s,
          session: {
            ...s.session,
            messages: [...s.session.messages, userMessage],
          },
          chatStatus: "sending",
        };
      });

      lastRequest.current = { baseSession, text: trimmed };
      await runRequest(baseSession, userMessage);
    },
    [runRequest],
  );

  const retry = useCallback(async (): Promise<void> => {
    const pending = lastRequest.current;
    if (!pending) return;
    setState((s) => ({ ...s, chatStatus: "sending" }));
    await runRequest(pending.baseSession, {
      role: "user",
      text: pending.text,
    });
  }, [runRequest]);

  const recordSwipe = useCallback((record: SwipeRecord): void => {
    setState((s) => {
      const swipeHistory = [...s.swipeHistory, record];
      // Reflect accumulated likes/dislikes in the next suggestion request
      // by carrying them on the session preferences (Req 3.3).
      const preferences = buildSuggestionPayload(swipeHistory);
      return {
        ...s,
        swipeHistory,
        session: { ...s.session, preferences },
      };
    });
  }, []);

  const clearCandidates = useCallback((): void => {
    setState((s) =>
      s.swipeCandidates.length === 0 ? s : { ...s, swipeCandidates: [] },
    );
  }, []);

  // Add a spot to one of the swipe-driven collections, de-duplicated by id so
  // re-swiping the same spot never creates duplicate entries. Returns the same
  // state reference when the spot is already present (cheap no-op).
  const addToCollection = useCallback(
    (key: "favorites" | "shiori" | "later", spot: Spot): void => {
      setState((s) => {
        const collection = s[key];
        if (collection.some((existing) => existing.id === spot.id)) return s;
        return { ...s, [key]: [...collection, spot] };
      });
    },
    [],
  );

  const addFavorite = useCallback(
    (spot: Spot): void => addToCollection("favorites", spot),
    [addToCollection],
  );

  // Remove a spot from お気に入り (Req 5.3). De-duplication on add means at most
  // one entry exists; filtering by id leaves the list without it. Returns the
  // same state reference when the spot is absent (cheap no-op).
  const removeFavorite = useCallback((spotId: string): void => {
    setState((s) => {
      if (!s.favorites.some((spot) => spot.id === spotId)) return s;
      return {
        ...s,
        favorites: s.favorites.filter((spot) => spot.id !== spotId),
      };
    });
  }, []);
  const addToShiori = useCallback(
    (spot: Spot): void => addToCollection("shiori", spot),
    [addToCollection],
  );

  // Remove a spot from the しおり (Req 6.3, Property 10). De-duplication on add
  // means at most one entry exists; filtering by id leaves the list without it.
  // Returns the same state reference when absent (cheap no-op).
  const removeFromShiori = useCallback((spotId: string): void => {
    setState((s) => {
      if (!s.shiori.some((spot) => spot.id === spotId)) return s;
      return {
        ...s,
        shiori: s.shiori.filter((spot) => spot.id !== spotId),
      };
    });
  }, []);

  // Reorder the しおり with the pure domain reorder (Req 6.2, Property 11): the
  // result keeps every element and the moved item lands at the target index.
  const reorderShiori = useCallback((from: number, to: number): void => {
    setState((s) => {
      if (from === to) return s;
      return { ...s, shiori: reorder(s.shiori, from, to) };
    });
  }, []);

  const addToLater = useCallback(
    (spot: Spot): void => addToCollection("later", spot),
    [addToCollection],
  );

  const value = useMemo<TourismContextValue>(
    () => ({
      session: state.session,
      messages: state.session.messages,
      chatStatus: state.chatStatus,
      isSending: state.chatStatus === "sending",
      hasError: state.chatStatus === "error",
      swipeCandidates: state.swipeCandidates,
      hasCandidates: state.swipeCandidates.length > 0,
      swipeHistory: state.swipeHistory,
      favorites: state.favorites,
      shiori: state.shiori,
      later: state.later,
      sendMessage,
      retry,
      recordSwipe,
      clearCandidates,
      addFavorite,
      removeFavorite,
      addToShiori,
      removeFromShiori,
      reorderShiori,
      addToLater,
    }),
    [
      state,
      sendMessage,
      retry,
      recordSwipe,
      clearCandidates,
      addFavorite,
      removeFavorite,
      addToShiori,
      removeFromShiori,
      reorderShiori,
      addToLater,
    ],
  );

  return (
    <TourismContext.Provider value={value}>{children}</TourismContext.Provider>
  );
}

/** Access the tourism context. Throws if used outside a {@link TourismProvider}. */
export function useTourism(): TourismContextValue {
  const ctx = useContext(TourismContext);
  if (ctx === null) {
    throw new Error("useTourism must be used within a <TourismProvider>.");
  }
  return ctx;
}
