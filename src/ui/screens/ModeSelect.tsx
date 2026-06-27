/**
 * ModeSelect — the mode-selection screen shown right after language selection
 * (Req 2.1). Presents 通常観光モード and お遍路モード as two large, hand-crafted
 * cards; choosing one routes into that mode's layout (Req 2.2 / 2.3). The header
 * and settings toggles let the user switch later, so this screen is only the
 * first-run entry point.
 */

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
  nameKey: string;
  descKey: string;
}

const OPTIONS: ModeOption[] = [
  {
    mode: "tourism",
    motif: "spot",
    nameKey: "mode.tourism.name",
    descKey: "mode.tourism.desc",
  },
  {
    mode: "pilgrimage",
    motif: "temple",
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
                <PlaceholderImage
                  motif={opt.motif}
                  label={t(opt.nameKey)}
                  aspectRatio="16 / 9"
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
