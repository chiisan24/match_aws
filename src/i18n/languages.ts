/**
 * Supported display languages and the language-selection option list (Req 1.2).
 *
 * The native names below are intentionally hard-coded constants, not translated
 * strings: a language is always shown in its own script so a speaker can
 * recognise it regardless of the currently-active UI language. `iyo` (伊予弁,
 * the Iyo dialect) is flagged as recommended for the Ehime audience, and Arabic
 * is flagged RTL so the shell can flip `dir` when it is active (Req 1.8 / RTL).
 */

import type { LangCode } from "../domain/types";

/** A selectable real language (maps to a {@link LangCode}). */
export interface LanguageOption {
  /** The language code persisted and used for label resolution. */
  code: LangCode;
  /** Native display name, always shown in the language's own script. */
  nativeName: string;
  /** Optional secondary line (e.g. a reading or English name). */
  sublabel?: string;
  /** Highlight as a recommended choice (used for 伊予弁). */
  recommended?: boolean;
  /** Right-to-left script — the shell sets `dir="rtl"` when active. */
  rtl?: boolean;
}

/**
 * The full ordered option list shown on the language screen, matching the
 * order mandated by Req 1.2:
 *
 * 日本語・English・简体中文・繁體中文・한국어・ไทย・Français・Deutsch・Español・
 * Português・Tiếng Việt・Bahasa Indonesia・العربية・Русский・हिन्दी・伊予弁。
 *
 * (The trailing "その他の言語" entry is not a real language and is handled
 * separately by the language-selection screen.)
 */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "ja", nativeName: "日本語" },
  { code: "en", nativeName: "English" },
  { code: "zh-Hans", nativeName: "简体中文", sublabel: "簡体字" },
  { code: "zh-Hant", nativeName: "繁體中文", sublabel: "繁体字" },
  { code: "ko", nativeName: "한국어" },
  { code: "th", nativeName: "ไทย" },
  { code: "fr", nativeName: "Français" },
  { code: "de", nativeName: "Deutsch" },
  { code: "es", nativeName: "Español" },
  { code: "pt", nativeName: "Português" },
  { code: "vi", nativeName: "Tiếng Việt" },
  { code: "id", nativeName: "Bahasa Indonesia" },
  { code: "ar", nativeName: "العربية", rtl: true },
  { code: "ru", nativeName: "Русский" },
  { code: "hi", nativeName: "हिन्दी" },
  {
    code: "iyo",
    nativeName: "伊予弁",
    sublabel: "いよべん",
    recommended: true,
  },
];

/** Language codes that should be rendered right-to-left. */
const RTL_CODES: ReadonlySet<LangCode> = new Set<LangCode>(["ar"]);

/** True when the given language should be displayed right-to-left (Req: RTL). */
export function isRtlLang(lang: LangCode): boolean {
  return RTL_CODES.has(lang);
}

/** The text direction (`"rtl"` / `"ltr"`) for the given language. */
export function dirForLang(lang: LangCode): "rtl" | "ltr" {
  return isRtlLang(lang) ? "rtl" : "ltr";
}
