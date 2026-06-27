/**
 * ChatAdvisor — the AI travel-chat screen for the 通常観光モード "chat" tab
 * (Req 3.1, 3.2, 3.4, 3.5, 3.6).
 *
 * Behaviour:
 *  - Sends/receives messages through the shared {@link useTourism} store, which
 *    talks to the injected {@link ChatPort} (mock by default — Req 3.6). The
 *    transcript is rendered as warm, friendly bubbles; the copy itself comes
 *    from the adapter and is intentionally non-robotic (Req 3.5 / 18.3).
 *  - When a reply reaches a destination-discovery moment it carries spot
 *    candidates; those are stored in the tourism store and this screen surfaces
 *    a "スワイプで見る" affordance so the user can hand off to Swipe_Discovery
 *    (Req 3.2). The actual swipe deck is task 8.3.
 *  - On a ChatPort failure it shows an error message and a retry action that
 *    re-runs the same request (Req 3.4).
 *
 * The screen is purely presentational over the store, so it stays testable: a
 * test wraps it in a {@link TourismProvider} with a fake ChatPort.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";

import { useTourism } from "../../app/TourismContext";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";

export interface ChatAdvisorProps {
  /** Jump to the swipe tab to consume the handed-off candidates (Req 3.2). */
  onOpenSwipe?: () => void;
}

export function ChatAdvisor({ onOpenSwipe }: ChatAdvisorProps): JSX.Element {
  const { t } = useI18n();
  const {
    messages,
    isSending,
    hasError,
    hasCandidates,
    swipeCandidates,
    sendMessage,
    retry,
  } = useTourism();

  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Keep the latest turn in view as the conversation grows.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isSending, hasError]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const text = draft;
    if (text.trim().length === 0 || isSending) return;
    setDraft("");
    void sendMessage(text);
  };

  const isEmpty = messages.length === 0;

  return (
    <section className="chat" aria-labelledby="chat-heading">
      <header className="chat__header">
        <h2 id="chat-heading" className="chat__title">
          {t("chat.title")}
        </h2>
        <p className="chat__lead">{t("chat.lead")}</p>
      </header>

      <div
        ref={transcriptRef}
        className="chat__transcript"
        role="log"
        aria-live="polite"
        aria-label={t("chat.title")}
      >
        {/* A warm opening line so the screen never feels empty or robotic. */}
        {isEmpty && (
          <div className="chat__bubble chat__bubble--assistant">
            <span className="chat__avatar" aria-hidden="true">
              🍊
            </span>
            <p className="chat__text">{t("chat.greeting")}</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat__bubble chat__bubble--${m.role}`}
            data-testid={`chat-bubble-${m.role}`}
          >
            {m.role === "assistant" && (
              <span className="chat__avatar" aria-hidden="true">
                🍊
              </span>
            )}
            <p className="chat__text">{m.text}</p>
          </div>
        ))}

        {isSending && (
          <div
            className="chat__bubble chat__bubble--assistant chat__bubble--typing"
            data-testid="chat-typing"
          >
            <span className="chat__avatar" aria-hidden="true">
              🍊
            </span>
            <p className="chat__text">{t("chat.thinking")}</p>
          </div>
        )}
      </div>

      {/* Destination-discovery hand-off to Swipe_Discovery (Req 3.2). */}
      {hasCandidates && (
        <div className="chat__handoff" data-testid="chat-handoff">
          <p className="chat__handoff-text">
            {t("chat.candidatesReady").replace(
              "{count}",
              String(swipeCandidates.length),
            )}
          </p>
          <Button
            variant="accent"
            leading="🃏"
            onClick={() => onOpenSwipe?.()}
            disabled={!onOpenSwipe}
          >
            {t("chat.toSwipe")}
          </Button>
        </div>
      )}

      {/* Failure + retry (Req 3.4). */}
      {hasError && (
        <div className="chat__error" role="alert" data-testid="chat-error">
          <p className="chat__error-text">{t("chat.error")}</p>
          <Button variant="soft" onClick={() => void retry()} disabled={isSending}>
            {t("chat.retry")}
          </Button>
        </div>
      )}

      <form className="chat__compose" onSubmit={handleSubmit}>
        <input
          className="chat__input"
          type="text"
          name="message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={isSending || draft.trim().length === 0}
        >
          {isSending ? t("chat.sending") : t("chat.send")}
        </Button>
      </form>
    </section>
  );
}
