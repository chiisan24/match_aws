/**
 * i18n React wiring: the {@link I18nProvider} context and {@link useI18n} hook.
 *
 * Responsibilities:
 *  - Hold the active language and expose a `t(key)` translator that delegates to
 *    the pure domain `resolveLabel` (so Japanese fallback is automatic —
 *    Req 1.6, 19.1, 19.3).
 *  - Persist the selected language through the injected {@link StoragePort}
 *    under the `"language"` key, and rehydrate it on mount (Req 1.3).
 *  - Let any screen (e.g. settings) change the language later via
 *    `setLanguage`, updating every label on the next render (Req 1.4, 1.5).
 *  - Continue past partial label-update failures (Req 1.7) by resolving label
 *    batches with {@link resolveLabels}.
 *  - Flip the document text direction to RTL for right-to-left languages such as
 *    Arabic (العربية).
 *
 * The `StoragePort` is a prop so the provider stays fully injectable/testable —
 * tests can pass a fake storage, app code passes `gateway.storage`.
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

import { resolveLabel } from "../domain/i18n";
import type { LangCode, LangDict, StorageKey } from "../domain/types";
import type { StoragePort, TranslatePort } from "../ports";
import { UI_LABELS } from "./labels";
import { dirForLang } from "./languages";
import { resolveLabels, type ResolveLabelsResult } from "./resolveLabels";

const LANGUAGE_STORAGE_KEY: StorageKey = "language";

/** Default language before any selection / rehydration completes. */
const DEFAULT_LANG: LangCode = "ja";

export interface I18nContextValue {
  /** The currently active display language. */
  lang: LangCode;
  /** Text direction for the active language (`"rtl"` for Arabic). */
  dir: "rtl" | "ltr";
  /** Translate a single label key, with Japanese fallback (Req 1.6). */
  t: (key: string) => string;
  /**
   * Resolve many keys at once, tolerating partial failures (Req 1.7). Returns
   * the resolved map plus any keys that could not be updated.
   */
  tMany: (keys: Iterable<string>) => ResolveLabelsResult;
  /** Change the active language and persist it (Req 1.3, 1.4, 1.5). */
  setLanguage: (next: LangCode) => Promise<void>;
  /**
   * Translate dynamic CONTENT (not static UI labels) into the target language
   * via the injected {@link TranslatePort} (Req 19.2). `target` defaults to the
   * active language. Degrades gracefully and NEVER throws — when no translate
   * backend is wired, or the backend fails, the original text is returned so
   * the UI always has something to show (Req 19.3).
   */
  translate: (text: string, target?: LangCode) => Promise<string>;
  /** The label dictionary in use (exposed for advanced callers / tests). */
  dict: LangDict;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  /** Persistence backend; inject `gateway.storage` in the app, a fake in tests. */
  storage: StoragePort;
  /**
   * Optional translation backend for dynamic content (Req 19.2). Inject
   * `gateway.translate` in the app; tests can pass a fake or omit it. When
   * omitted the context's `translate` is a graceful no-op that returns the
   * original text (Req 19.3).
   */
  translate?: TranslatePort;
  /** Label dictionary. Defaults to the bundled {@link UI_LABELS}. */
  dict?: LangDict;
  /** Initial language before rehydration. Defaults to Japanese. */
  initialLang?: LangCode;
  /** When false, skip reading the persisted language on mount (tests). */
  rehydrate?: boolean;
  children: ReactNode;
}

export function I18nProvider({
  storage,
  translate: translatePort,
  dict = UI_LABELS,
  initialLang = DEFAULT_LANG,
  rehydrate = true,
  children,
}: I18nProviderProps): JSX.Element {
  const [lang, setLang] = useState<LangCode>(initialLang);

  // Rehydrate the previously-selected language on mount (Req 1.3 round-trip).
  useEffect(() => {
    if (!rehydrate) return;
    let cancelled = false;
    void (async () => {
      try {
        const saved = await storage.load<LangCode>(LANGUAGE_STORAGE_KEY);
        if (!cancelled && saved) {
          setLang(saved);
        }
      } catch {
        // Storage unavailable — keep the default language, app still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage, rehydrate]);

  // Keep the document direction in sync so RTL languages (Arabic) lay out
  // correctly across the whole shell.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = dirForLang(lang);
    }
  }, [lang]);

  const setLanguage = useCallback(
    async (next: LangCode): Promise<void> => {
      // Update the UI first so the language change is never blocked by a slow
      // or failing write (Req 1.5 / 1.7 — UI continues regardless).
      setLang(next);
      try {
        await storage.save<LangCode>(LANGUAGE_STORAGE_KEY, next);
      } catch {
        // Persistence failed — the in-memory language still updates so the user
        // sees the new language; we simply could not remember it for next time.
      }
    },
    [storage],
  );

  const translate = useCallback(
    async (text: string, target: LangCode = lang): Promise<string> => {
      // No backend wired (or no text to translate) — return the original so the
      // caller always has displayable content (Req 19.3).
      if (!translatePort || text.trim() === "") return text;
      try {
        return await translatePort.translate(text, target);
      } catch {
        // Translation backend failed (e.g. AWS not configured) — fall back to
        // the original text and never throw (Req 19.3).
        return text;
      }
    },
    [translatePort, lang],
  );

  const value = useMemo<I18nContextValue>(() => {
    return {
      lang,
      dir: dirForLang(lang),
      t: (key: string) => resolveLabel(dict, lang, key),
      tMany: (keys: Iterable<string>) => resolveLabels(dict, lang, keys),
      setLanguage,
      translate,
      dict,
    };
  }, [lang, dict, setLanguage, translate]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the i18n context. Throws if used outside an {@link I18nProvider}. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) {
    throw new Error("useI18n must be used within an <I18nProvider>.");
  }
  return ctx;
}

/**
 * Convenience hook returning just the content {@link I18nContextValue.translate}
 * function (Req 19.2). Components that only need to translate dynamic content
 * (e.g. a temple/spot description lacking an entry for the active language) can
 * use this without pulling in the whole context.
 */
export function useTranslate(): I18nContextValue["translate"] {
  return useI18n().translate;
}
