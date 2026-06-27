/**
 * Resilient batch label resolution (Req 1.5, 1.7).
 *
 * When the display language changes the app re-resolves the visible labels.
 * Req 1.7 requires that if *some* labels fail to update, the rest are still
 * updated and the language change continues rather than aborting wholesale.
 *
 * The pure `resolveLabel` never throws, so in normal operation every key
 * resolves. To honour Req 1.7 robustly this helper resolves each key
 * independently inside a try/catch: a failure on one key (e.g. from a custom
 * resolver, or an unexpected runtime error) is recorded and skipped, while
 * every other key is still resolved to the selected language. The function
 * therefore always returns a usable label map plus the list of keys that could
 * not be updated.
 */

import { resolveLabel } from "../domain/i18n";
import type { LangCode, LangDict } from "../domain/types";

/** A resolver with the same shape as the domain `resolveLabel`. */
export type LabelResolver = (
  dict: LangDict,
  lang: LangCode,
  key: string,
) => string;

export interface ResolveLabelsResult {
  /** Successfully resolved `key -> localized string` pairs. */
  labels: Record<string, string>;
  /** Keys whose resolution threw and were skipped (partial-update case). */
  failedKeys: string[];
}

/**
 * Resolve many label keys for one language, continuing past individual
 * failures (Req 1.7). Keys that throw are collected in `failedKeys` and omitted
 * from `labels`; callers can keep the previous value for those keys so the UI
 * stays usable.
 *
 * @param dict     the label dictionary
 * @param lang     the target language
 * @param keys     the label keys to resolve
 * @param resolver label resolver (defaults to the pure domain `resolveLabel`)
 */
export function resolveLabels(
  dict: LangDict,
  lang: LangCode,
  keys: Iterable<string>,
  resolver: LabelResolver = resolveLabel,
): ResolveLabelsResult {
  const labels: Record<string, string> = {};
  const failedKeys: string[] = [];

  for (const key of keys) {
    try {
      labels[key] = resolver(dict, lang, key);
    } catch {
      // Partial-update resilience: skip this key, keep going (Req 1.7).
      failedKeys.push(key);
    }
  }

  return { labels, failedKeys };
}
