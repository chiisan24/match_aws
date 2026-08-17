/**
 * LanguageSelect — the first-run language selection screen (Req 1.1, 1.2, 1.3).
 *
 * Mirrors the mockup: a "ようこそ愛媛へ" welcome with an Ehime image, a
 * bilingual "言語を選択してください / Please select your language" heading, a grid
 * of language options (Req 1.2 order) with a recommended 伊予弁 entry and an
 * "その他の言語" affordance, a reassuring note that the language can be changed
 * later from settings, and a "次へ進む" button.
 *
 * Selecting a language and pressing 次へ進む commits the choice through the i18n
 * context — which persists it via the injected StoragePort under the
 * `"language"` key (Req 1.3) — then invokes `onComplete` to advance to the next
 * screen (mode selection; the real ModeManager arrives in task 6.4).
 */

import { useEffect, useState } from "react";

import type { LangCode } from "../../domain/types";
import { useI18n } from "../../i18n";
import {
  LANGUAGE_OPTIONS,
  dirForLang,
  type LanguageOption,
} from "../../i18n/languages";
import { Button } from "../components/Button";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { screenSrcSet, screenFallback } from "./screenImage";

export interface LanguageSelectProps {
  /** Called after the active language is persisted and the journey starts. */
  onComplete?: (lang: LangCode) => void;
}

export function LanguageSelect({
  onComplete,
}: LanguageSelectProps): JSX.Element {
  const { lang, t, setLanguage } = useI18n();
  const [selected, setSelected] = useState<LangCode>(lang);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showOtherNote, setShowOtherNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rehydration may restore a saved language after the first render.
  useEffect(() => setSelected(lang), [lang]);

  const handleContinue = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await setLanguage(selected);
      onComplete?.(selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="lang-select" aria-labelledby="welcome-title">
      <div className="lang-select__hero">
        <WelcomeHero />
        <div className="lang-select__scrim" aria-hidden="true" />
        <div className="lang-select__welcome">
          <div className="lang-select__brand" aria-label="Ehime Journey">
            <span className="lang-select__brand-mark" aria-hidden="true">✦</span>
            <span>Ehime<br />Journey</span>
          </div>
          <div className="lang-select__copy">
            <p className="lang-select__kicker">{t("welcome.kicker")}</p>
            <h1 id="welcome-title" className="lang-select__welcome-title">
              {t("welcome.tagline")}
            </h1>
            <p className="lang-select__lead">{t("welcome.lead")}</p>
          </div>
          <div className="lang-select__actions">
            <Button
              variant="accent"
              size="lg"
              block
              disabled={submitting}
              onClick={() => void handleContinue()}
            >
              {t("welcome.start")}
            </Button>
            <Button
              variant="ghost"
              block
              className="lang-select__language-button"
              aria-expanded={showLanguagePicker}
              aria-controls="language-picker"
              onClick={() => setShowLanguagePicker((open) => !open)}
            >
              🌐 {t("welcome.changeLanguage")}
            </Button>
          </div>
        </div>
      </div>

      {showLanguagePicker && (
        <div id="language-picker" className="lang-select__picker">
          <div className="lang-select__heading">
            <h2 className="lang-select__heading-main">{t("lang.heading")}</h2>
            <p className="lang-select__heading-sub">{t("lang.headingSub")}</p>
          </div>
          <ul className="lang-select__grid" role="list">
            {LANGUAGE_OPTIONS.map((opt) => (
              <li key={opt.code}>
                <LanguageTile
                  option={opt}
                  selected={selected === opt.code}
                  recommendedLabel={t("lang.recommended")}
                  onSelect={() => setSelected(opt.code)}
                />
              </li>
            ))}
          </ul>
          <div className="lang-select__other">
            <Button
              variant="ghost"
              block
              aria-expanded={showOtherNote}
              onClick={() => setShowOtherNote((value) => !value)}
            >
              {t("lang.other")}
            </Button>
            {showOtherNote && (
              <p className="lang-select__other-note" role="status">
                {t("lang.otherComingSoon")}
              </p>
            )}
          </div>
          <p className="lang-select__note">{t("lang.note")}</p>
          <Button
            variant="accent"
            size="lg"
            block
            disabled={submitting}
            onClick={() => void handleContinue()}
          >
            {t("lang.next")}
          </Button>
        </div>
      )}
    </section>
  );
}

interface LanguageTileProps {
  option: LanguageOption;
  selected: boolean;
  recommendedLabel: string;
  onSelect: () => void;
}

function LanguageTile({
  option,
  selected,
  recommendedLabel,
  onSelect,
}: LanguageTileProps): JSX.Element {
  const classes = [
    "lang-tile",
    selected ? "lang-tile--selected" : "",
    option.recommended ? "lang-tile--recommended" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {option.recommended && (
        <span className="lang-tile__badge">★ {recommendedLabel}</span>
      )}
      {/* Native name is shown in its own script & direction so it is always
          recognisable regardless of the active UI language. */}
      <span className="lang-tile__name" dir={dirForLang(option.code)}>
        {option.nativeName}
      </span>
      {option.sublabel && (
        <span className="lang-tile__sub">{option.sublabel}</span>
      )}
    </button>
  );
}

/**
 * Welcome hero image. Renders the real Ehime photo when it resolves and falls
 * back to the on-brand {@link PlaceholderImage} on load error — mirroring the
 * SpotPhoto pattern (Req 4.7), so a missing file never breaks the screen.
 *
 * Expects the photo at `public/images/screens/welcome.jpg` (a portrait
 * Ehime scene — castle over the Seto Inland Sea with the Shimanami bridges and
 * mikan). Sized as a tall hero so the portrait image is shown without heavy
 * cropping.
 */
function WelcomeHero(): JSX.Element {
  const [errored, setErrored] = useState(false);
  const alt = "愛媛の風景（瀬戸内海・しまなみ海道の橋・城・みかん）";

  if (errored) {
    return (
      <PlaceholderImage
        motif="temple"
        label="愛媛へようこそ"
        sublabel="写真は準備中です"
        aspectRatio="3 / 4"
      />
    );
  }
  const src = "/images/screens/welcome.jpg";
  const widths = [400, 640, 900];
  // Displayed at the app column width (≤ ~26rem); mobile takes most of the
  // viewport. The browser picks the lightest variant that fits.
  const sizes = "(max-width: 30rem) 92vw, 26rem";
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={screenSrcSet(src, widths, "webp")}
        sizes={sizes}
      />
      <img
        className="lang-select__hero-img"
        src={screenFallback(src, 640)}
        srcSet={screenSrcSet(src, widths, "jpg")}
        sizes={sizes}
        alt={alt}
        width={900}
        height={1200}
        style={{ aspectRatio: "3 / 4", width: "100%", objectFit: "cover" }}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
      />
    </picture>
  );
}
