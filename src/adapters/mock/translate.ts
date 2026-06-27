/**
 * Mock TranslatePort adapter.
 *
 * Returns a canned mock translation when one exists for the target language,
 * otherwise falls back to the original text (Req 19.3). Pure and deterministic
 * — no network. Empty/whitespace input is returned unchanged.
 */

import type { LangCode, TranslatePort } from "../../ports";

/**
 * Tiny phrase book keyed by source text → target language → translation.
 * Enough to demonstrate translation wiring; anything not listed falls back to
 * the original text.
 */
const MOCK_PHRASES: Record<string, Partial<Record<LangCode, string>>> = {
  こんにちは: { en: "Hello", ko: "안녕하세요", "zh-Hans": "你好", iyo: "こんにちは（伊予弁）" },
  ありがとう: { en: "Thank you", ko: "감사합니다", "zh-Hans": "谢谢" },
  札所: { en: "pilgrimage temple", "zh-Hans": "札所" },
};

export class MockTranslateAdapter implements TranslatePort {
  async translate(text: string, target: LangCode): Promise<string> {
    if (text.trim() === "") return text;

    const entry = MOCK_PHRASES[text.trim()];
    const translated = entry?.[target];
    if (translated !== undefined) return translated;

    // No mock translation available — fall back to the original text so the UI
    // always has something to show (Req 19.3).
    return text;
  }
}
