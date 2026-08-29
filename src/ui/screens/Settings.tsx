import type { LangCode } from "../../domain/types";
import { useI18n } from "../../i18n";
import { LANGUAGE_OPTIONS } from "../../i18n/languages";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { SectionHeader } from "../components/SectionHeader";

export interface SettingsProps {
  onClose: () => void;
}

/** Settings available in the tourism-only application. */
export function Settings({ onClose }: SettingsProps): JSX.Element {
  const { t, lang, setLanguage } = useI18n();

  return (
    <section className="settings" aria-labelledby="settings-heading">
      <SectionHeader
        as="h1"
        title={<span id="settings-heading">{t("settings.title")}</span>}
        action={
          <Button variant="ghost" onClick={onClose}>
            {t("common.done")}
          </Button>
        }
      />

      <Card className="settings__group">
        <h2 className="settings__group-title">{t("settings.language")}</h2>
        <p className="settings__hint">{t("settings.languageHint")}</p>
        <label className="settings__field">
          <span className="settings__field-label">{t("settings.language")}</span>
          <select
            className="settings__select"
            value={lang}
            onChange={(event) => void setLanguage(event.target.value as LangCode)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName}
                {option.sublabel ? `（${option.sublabel}）` : ""}
              </option>
            ))}
          </select>
        </label>
      </Card>
    </section>
  );
}
