/**
 * PlanShare — プラン共有 for the 通常観光モード "shiori" tab (Req 7.1–7.3).
 *
 * Embedded inside {@link ShioriEditor}, it turns the current しおり into a
 * shareable plan two ways:
 *
 *  - **Generate** a share link / code from the plan (Req 7.1) using the pure
 *    {@link buildShareLink} / {@link encodeSharePlan}. The link carries the whole
 *    plan in its hash, so the recipient needs no server lookup. A copy button is
 *    offered (best-effort — it degrades gracefully where the Clipboard API is
 *    unavailable).
 *  - **Open** a pasted link / code (Req 7.2): {@link openSharedPlan} decodes it
 *    back into a plan and the reconstructed itinerary is displayed. An empty /
 *    malformed token resolves to `null`, so we show 「プランが見つからない」
 *    (Req 7.3).
 *
 * All encode/decode is pure domain logic ({@link encodeSharePlan} /
 * {@link decodeSharePlan}), so the encode→decode round-trip (Property 13) holds
 * independently of this UI.
 */

import { useState } from "react";

import {
  buildShareLink,
  openSharedPlan,
  type SharePlan,
} from "../../domain/share";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";

export interface PlanShareProps {
  /** The plan (built from the current しおり) to offer for sharing. */
  plan: SharePlan;
}

/** Outcome of trying to open a pasted share token. */
type OpenState =
  | { status: "idle" }
  | { status: "found"; plan: SharePlan }
  | { status: "notFound" };

export function PlanShare({ plan }: PlanShareProps): JSX.Element {
  const { t } = useI18n();

  const hasPlan = plan.items.length > 0;

  // Generated share link, shown once the user asks to share (Req 7.1).
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The token the user pastes to open a shared plan, and the open outcome.
  const [tokenInput, setTokenInput] = useState("");
  const [open, setOpen] = useState<OpenState>({ status: "idle" });

  const handleGenerate = (): void => {
    // Encode the live plan into a link carrying it in the hash (Req 7.1).
    setShareLink(buildShareLink(plan));
    setCopied(false);
  };

  const handleCopy = async (): Promise<void> => {
    if (!shareLink) return;
    try {
      await navigator.clipboard?.writeText(shareLink);
      setCopied(true);
    } catch {
      // Clipboard unavailable / denied — the link stays visible to copy by hand.
      setCopied(false);
    }
  };

  const handleOpen = (): void => {
    // Decode the pasted link / code back into a plan (Req 7.2); null → not found
    // (Req 7.3).
    const opened = openSharedPlan(tokenInput);
    setOpen(opened ? { status: "found", plan: opened } : { status: "notFound" });
  };

  return (
    <section className="plan-share" aria-labelledby="plan-share-heading">
      <h3 id="plan-share-heading" className="plan-share__title">
        {t("share.title")}
      </h3>
      <p className="plan-share__lead">{t("share.lead")}</p>

      {/* --- Generate a share link from the current しおり (Req 7.1) --------- */}
      <div className="plan-share__generate">
        <Button
          variant="accent"
          onClick={handleGenerate}
          disabled={!hasPlan}
          data-testid="plan-share-generate"
        >
          {t("share.generate")}
        </Button>
        {!hasPlan && (
          <p className="plan-share__hint" data-testid="plan-share-empty">
            {t("share.emptyHint")}
          </p>
        )}

        {shareLink && (
          <div className="plan-share__link" data-testid="plan-share-link">
            <label className="plan-share__link-label" htmlFor="plan-share-url">
              {t("share.linkLabel")}
            </label>
            <input
              id="plan-share-url"
              className="plan-share__link-input"
              type="text"
              readOnly
              value={shareLink}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="soft"
              onClick={handleCopy}
              data-testid="plan-share-copy"
            >
              {copied ? t("share.copied") : t("share.copy")}
            </Button>
          </div>
        )}
      </div>

      {/* --- Open a shared plan from a pasted link / code (Req 7.2, 7.3) ---- */}
      <div className="plan-share__open">
        <label className="plan-share__open-label" htmlFor="plan-share-token">
          {t("share.openLabel")}
        </label>
        <div className="plan-share__open-row">
          <input
            id="plan-share-token"
            className="plan-share__open-input"
            type="text"
            value={tokenInput}
            placeholder={t("share.openPlaceholder")}
            onChange={(e) => {
              setTokenInput(e.target.value);
              setOpen({ status: "idle" });
            }}
            data-testid="plan-share-token-input"
          />
          <Button
            variant="primary"
            onClick={handleOpen}
            disabled={tokenInput.trim().length === 0}
            data-testid="plan-share-open"
          >
            {t("share.open")}
          </Button>
        </div>

        {open.status === "notFound" && (
          <p
            className="plan-share__not-found"
            role="alert"
            data-testid="plan-share-not-found"
          >
            {t("share.notFound")}
          </p>
        )}

        {open.status === "found" && (
          <SharedPlanView plan={open.plan} />
        )}
      </div>
    </section>
  );
}

/** Read-only display of a reconstructed shared plan (Req 7.2). */
function SharedPlanView({ plan }: { plan: SharePlan }): JSX.Element {
  const { t } = useI18n();
  return (
    <section
      className="plan-share__opened"
      aria-labelledby="plan-share-opened-heading"
      data-testid="plan-share-opened"
    >
      <h4 id="plan-share-opened-heading" className="plan-share__opened-title">
        {plan.title}
      </h4>
      {plan.items.length === 0 ? (
        <p className="plan-share__opened-empty">{t("share.openedEmpty")}</p>
      ) : (
        <ol className="plan-share__opened-list">
          {plan.items.map((item, i) => (
            <li key={`${item.id}-${i}`} className="plan-share__opened-item">
              <span className="plan-share__opened-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="plan-share__opened-name">{item.name}</span>
              {item.note && (
                <span className="plan-share__opened-note">{item.note}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
