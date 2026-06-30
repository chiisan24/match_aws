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

import { useState } from "react";

import type { LangCode } from "../../domain/types";
import { useI18n } from "../../i18n";
import {
  LANGUAGE_OPTIONS,
  dirForLang,
  type LanguageOption,
} from "../../i18n/languages";
import { Button } from "../components/Button";
import { PlaceholderImage } from "../components/PlaceholderImage";

export interface LanguageSelectProps {
  /**
   * Called after the chosen language has been committed and persisted. The next
   * phase (mode selection) is wired up in task 6.4; a placeholder callback is
   * sufficient here.
   */
  onComplete?: (lang: LangCode) => void;
}

export function LanguageSelect({
  onComplete,
}: LanguageSelectProps): JSX.Element {
  const { lang, t, setLanguage } = useI18n();

  // Pre-select the active language so 次へ進む is always actionable.
  const [selected, setSelected] = useState<LangCode>(lang);
  const [showOtherNote, setShowOtherNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    <section className="lang-select" aria-labelledby="lang-heading">
      {/* ---- Welcome banner: ようこそ愛媛へ + Ehime image ---- */}
      <div className="lang-select__welcome">
        <div className="lang-select__hero">
          <WelcomeHero />
        </div>
        <p className="lang-select__kicker">{t("welcome.kicker")}</p>
        <h1 className="lang-select__welcome-title">{t("welcome.place")}</h1>
        <p className="lang-select__lead">{t("welcome.lead")}</p>
      </div>

      {/* ---- Heading (bilingual, Req 1.1) ---- */}
      <div className="lang-select__heading">
        <h2 id="lang-heading" className="lang-select__heading-main">
          {t("lang.heading")}
        </h2>
        <p className="lang-select__heading-sub">{t("lang.headingSub")}</p>
      </div>

      {/* ---- Language grid (Req 1.2) ---- */}
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

      {/* ---- Other languages affordance (Req 1.2) ---- */}
      <div className="lang-select__other">
        <Button
          variant="ghost"
          block
          aria-expanded={showOtherNote}
          onClick={() => setShowOtherNote((v) => !v)}
        >
          {t("lang.other")}
        </Button>
        {showOtherNote && (
          <p className="lang-select__other-note" role="status">
            {t("lang.otherComingSoon")}
          </p>
        )}
      </div>

      {/* ---- Reassuring note (Req 1.4 hint) ---- */}
      <p className="lang-select__note">{t("lang.note")}</p>

      {/* ---- Continue (Req 1.3) ---- */}
      <Button
        variant="accent"
        size="lg"
        block
        disabled={submitting}
        onClick={() => void handleContinue()}
      >
        {t("lang.next")}
      </Button>
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
 * Expects the photo at `public/images/ehime/welcome-ehime.jpg` (a portrait
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
  return (
    <img
      className="lang-select__hero-img"
      src="/images/ehime/welcome-ehime.jpg"
      alt={alt}
      style={{ aspectRatio: "3 / 4", width: "100%", objectFit: "cover" }}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
