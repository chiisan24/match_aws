/**
 * Login — the お遍路モード sign-in screen (Req 15.1, 15.2, 15.3).
 *
 * Mirrors the pilgrimage login mockup, with a calm forest/temple mood that is
 * deliberately distinct from the bright tourism welcome:
 *   - a brand area "お遍路モード / 四国八十八ヶ所巡礼の世界へ",
 *   - an ID / email field and a password field with a show/hide toggle,
 *   - a "ログイン状態を保持する" checkbox (the remember flag, Req 15.2),
 *   - a primary ログイン button,
 *   - forgot-password & new-account links (placeholders for MVP),
 *   - a closing tagline "巡礼の旅、あなたと共に".
 *
 * Submitting calls {@link useAuth}'s `login`, which establishes a session only
 * when the credentials are valid (Req 15.1). On invalid credentials the form
 * shows a failure message and keeps the user on the screen (Req 15.3). The
 * remember choice is forwarded so a remembered session survives the next launch
 * (Req 15.2). A "観光モードに戻る" affordance lets the user step back rather than
 * being trapped behind the gate.
 */

import { useState, type FormEvent } from "react";

import { useAuth } from "../../app/AuthContext";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";

export interface LoginProps {
  /** Called after a session has been successfully established. */
  onSuccess?: () => void;
  /** Step back out of the auth gate (e.g. return to 通常観光モード). */
  onBack?: () => void;
}

export function Login({ onSuccess, onBack }: LoginProps): JSX.Element {
  const { t } = useI18n();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    setFailed(false);
    setSubmitting(true);
    try {
      const session = await login(email, password, remember);
      if (session) {
        onSuccess?.();
      } else {
        // Invalid credentials — surface the failure, stay on the screen (Req 15.3).
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="login" aria-labelledby="login-heading">
      {/* ---- Brand area (calm pilgrimage mood) ---- */}
      <div className="login__brand">
        <span className="login__crest" aria-hidden="true">
          ✦
        </span>
        <h1 id="login-heading" className="login__brand-name">
          {t("auth.brand.mode")}
        </h1>
        <p className="login__brand-tagline">{t("auth.brand.tagline")}</p>
      </div>

      <p className="login__intro">{t("auth.intro")}</p>

      <form className="login__form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        {failed && (
          <p className="login__error" role="alert">
            {t("auth.error")}
          </p>
        )}

        {/* ---- ID / email ---- */}
        <label className="login__field">
          <span className="login__field-label">{t("auth.idLabel")}</span>
          <input
            className="login__input"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="username"
            placeholder={t("auth.idPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={failed}
          />
        </label>

        {/* ---- Password with show/hide ---- */}
        <label className="login__field">
          <span className="login__field-label">{t("auth.passwordLabel")}</span>
          <span className="login__password">
            <input
              className="login__input"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={failed}
            />
            <button
              type="button"
              className="login__reveal"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            </button>
          </span>
        </label>

        {/* ---- Remember me (Req 15.2) ---- */}
        <label className="login__remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>{t("auth.remember")}</span>
        </label>

        <Button
          type="submit"
          variant="accent"
          size="lg"
          block
          disabled={submitting}
        >
          {submitting ? t("auth.loggingIn") : t("auth.login")}
        </Button>
      </form>

      {/* ---- Secondary links (placeholders for MVP) ---- */}
      <div className="login__links">
        <a className="login__link" href="#forgot" onClick={(e) => e.preventDefault()}>
          {t("auth.forgot")}
        </a>
        <a className="login__link" href="#new" onClick={(e) => e.preventDefault()}>
          {t("auth.newAccount")}
        </a>
      </div>

      {onBack && (
        <Button variant="ghost" block onClick={onBack}>
          {t("auth.backToTourism")}
        </Button>
      )}

      <p className="login__tagline">{t("auth.tagline")}</p>
    </section>
  );
}
