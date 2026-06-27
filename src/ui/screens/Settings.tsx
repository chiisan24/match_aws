/**
 * Settings — the second mode-switch surface (Q4: header + settings both) plus
 * the language-change entry point (Req 1.4, 1.5).
 *
 * The mode toggle here shares the exact same {@link ModeToggle} control and the
 * same `useMode` switching logic as the header, and the language picker reuses
 * the i18n `setLanguage` so every label updates live (Req 1.5). A "完了" button
 * returns to the current mode layout.
 */

import { useMode } from "../../app/ModeContext";
import { useAuth } from "../../app/AuthContext";
import type { LangCode } from "../../domain/types";
import { useI18n } from "../../i18n";
import { LANGUAGE_OPTIONS } from "../../i18n/languages";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ModeToggle } from "../components/ModeToggle";
import { SectionHeader } from "../components/SectionHeader";

export interface SettingsProps {
  /** Return to the current mode's layout. */
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps): JSX.Element {
  const { t, lang, setLanguage } = useI18n();
  const { mode, switchMode } = useMode();
  const { session, logout } = useAuth();

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

      {/* ---- Mode (Req 2.4 — settings toggle) ---- */}
      <Card className="settings__group">
        <h2 className="settings__group-title">{t("settings.mode")}</h2>
        <p className="settings__hint">{t("settings.modeHint")}</p>
        <ModeToggle
          mode={mode}
          tourismLabel={t("mode.tourism.name")}
          pilgrimageLabel={t("mode.pilgrimage.name")}
          onSelect={switchMode}
          ariaLabel={t("header.modeSwitch")}
        />
      </Card>

      {/* ---- Display language (Req 1.4, 1.5) ---- */}
      <Card className="settings__group">
        <h2 className="settings__group-title">{t("settings.language")}</h2>
        <p className="settings__hint">{t("settings.languageHint")}</p>
        <label className="settings__field">
          <span className="settings__field-label">{t("settings.language")}</span>
          <select
            className="settings__select"
            value={lang}
            onChange={(e) => void setLanguage(e.target.value as LangCode)}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.nativeName}
                {opt.sublabel ? `（${opt.sublabel}）` : ""}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {/* ---- Account (logout entry point, Req 15.4) ---- */}
      <Card className="settings__group">
        <h2 className="settings__group-title">{t("auth.account")}</h2>
        {session ? (
          <>
            <p className="settings__hint">
              <span className="settings__account-state">
                {t("auth.signedInAs")}
              </span>
              <span className="settings__account-email">{session.email}</span>
            </p>
            <p className="settings__hint">{t("auth.logoutHint")}</p>
            <Button variant="soft" onClick={() => void logout()}>
              {t("auth.logout")}
            </Button>
          </>
        ) : (
          <>
            <p className="settings__hint">{t("auth.signedOut")}</p>
            <p className="settings__hint">{t("auth.loginHint")}</p>
          </>
        )}
      </Card>
    </section>
  );
}
