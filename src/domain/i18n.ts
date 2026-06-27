/**
 * Pure language label resolution with Japanese fallback (Req 1.6, 19.1, 19.3 /
 * Property 2). No I/O. Never throws, never returns null/undefined.
 */

import type { LangCode, LangDict } from "./types";

/**
 * Resolve a UI label for the requested language.
 *
 * Resolution order (Property 2):
 * 1. The value for `lang` if present.
 * 2. Otherwise the Japanese (`ja`) value if present.
 * 3. Otherwise the original `key` itself.
 *
 * The function is total: it tolerates a missing dictionary entry, a missing
 * language value, and a missing Japanese fallback, always returning a string
 * and never throwing.
 */
export function resolveLabel(
  dict: LangDict,
  lang: LangCode,
  key: string,
): string {
  const entry = dict?.[key];

  if (entry) {
    const value = entry[lang];
    if (typeof value === "string") {
      return value;
    }

    const ja = entry.ja;
    if (typeof ja === "string") {
      return ja;
    }
  }

  // No translation and no Japanese fallback: surface the key itself.
  return key;
}
