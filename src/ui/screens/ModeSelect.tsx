/**
 * ModeSelect — the mode-selection screen shown right after language selection
 * (Req 2.1). Presents 通常観光モード and お遍路モード as two large, hand-crafted
 * cards; choosing one routes into that mode's layout (Req 2.2 / 2.3). The header
 * and settings toggles let the user switch later, so this screen is only the
 * first-run entry point.
 */

import { useState } from "react";

import type { AppMode } from "../../app/modeManager";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { Tag } from "../components/Tag";

export interface ModeSelectProps {
  /** Invoked with the chosen mode once the user commits. */
  onChoose: (mode: AppMode) => void;
}

interface ModeOption {
  mode: AppMode;
  motif: "temple" | "spot";
  /** Real photo loaded from `public/images/screens/`; falls back gracefully. */
  image: string;
  nameKey: string;
  descKey: string;
}

const OPTIONS: ModeOption[] = [
  {
    mode: "tourism",
    motif: "spot",
    image: "/images/screens/mode-tourism.jpg",
    nameKey: "mode.tourism.name",
    descKey: "mode.tourism.desc",
  },
  {
    mode: "pilgrimage",
    motif: "temple",
    image: "/images/screens/mode-pilgrimage.jpg",
    nameKey: "mode.pilgrimage.name",
    descKey: "mode.pilgrimage.desc",
  },
];

export function ModeSelect({ onChoose }: ModeSelectProps): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="mode-select" aria-labelledby="mode-select-heading">
      <div className="mode-select__intro">
        <p className="mode-select__kicker">{t("mode.select.kicker")}</p>
        <h1 id="mode-select-heading" className="mode-select__title">
          {t("mode.select.title")}
        </h1>
        <p className="mode-select__lead">{t("mode.select.lead")}</p>
      </div>

      <ul className="mode-select__list" role="list">
        {OPTIONS.map((opt) => (
          <li key={opt.mode}>
            <Card blob raised interactive className="mode-card">
              <div className="mode-card__hero">
                <ModeHero
                  src={opt.image}
                  motif={opt.motif}
                  label={t(opt.nameKey)}
                />
              </div>
              <div className="mode-card__body">
                <Tag tone={opt.mode === "pilgrimage" ? "accent" : "teal"}>
                  {opt.mode === "pilgrimage" ? "お遍路" : "観光"}
                </Tag>
                <h2 className="mode-card__name">{t(opt.nameKey)}</h2>
                <p className="mode-card__desc">{t(opt.descKey)}</p>
                <Button
                  variant="accent"
                  block
                  onClick={() => onChoose(opt.mode)}
                >
                  {t("mode.start")}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ModeHeroProps {
  src: string;
  motif: "temple" | "spot";
  label: string;
}

/**
 * Mode card hero image. Renders the real photo from `public/images/screens/`
 * when it resolves and falls back to the on-brand {@link PlaceholderImage} on
 * load error — mirroring the WelcomeHero pattern (Req 4.7) so a missing file
 * never breaks the screen.
 */
function ModeHero({ src, motif, label }: ModeHeroProps): JSX.Element {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <PlaceholderImage motif={motif} label={label} aspectRatio="16 / 9" />
    );
  }
  return (
    <img
      className="mode-card__hero-img"
      src={src}
      alt={label}
      style={{ aspectRatio: "16 / 9", width: "100%", objectFit: "cover" }}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
