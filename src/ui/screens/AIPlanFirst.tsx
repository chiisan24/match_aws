import { useCallback, useEffect, useState } from "react";

import type {
  ChatPort,
  LangCode,
  PlacePhotoAttribution,
  RecommendedPlan,
} from "../../ports";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Tag, type TagTone } from "../components/Tag";

export interface AIPlanFirstProps {
  chat: ChatPort;
  onStart: (plan: RecommendedPlan) => void;
}

const FALLBACK_IMAGES = [
  "/images/ehime/matsuyama-castle.jpg",
  "/images/ehime/onsen-bath.jpg",
  "/images/ehime/uchiko-townscape.jpg",
  "/images/ehime/setouchi-shrine.jpg",
  "/images/ehime/kurushima-bridge.jpg",
] as const;
const TONES: TagTone[] = ["accent", "teal", "moss", "outline", "accent"];

const requestCache = new WeakMap<
  ChatPort,
  Map<LangCode, Promise<RecommendedPlan[]>>
>();
const RECOMMENDATIONS_CACHE_VERSION = "v4-tourism-only";

function isTourismRecommendations(value: unknown): value is RecommendedPlan[] {
  return Array.isArray(value)
    && value.length === 5
    && value.every((plan) => (
      plan != null
      && typeof plan === "object"
      && (plan as { mode?: unknown }).mode === "tourism"
    ));
}

function recommendationDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function storageKey(lang: LangCode): string {
  return `ehime-recommendations:${RECOMMENDATIONS_CACHE_VERSION}:${recommendationDate()}:${lang}`;
}

function readStoredRecommendations(lang: LangCode): RecommendedPlan[] | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(lang));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isTourismRecommendations(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredRecommendations(
  lang: LangCode,
  plans: RecommendedPlan[],
): void {
  try {
    window.sessionStorage.setItem(storageKey(lang), JSON.stringify(plans));
  } catch {
    // Storage may be unavailable in private browsing or constrained webviews.
  }
}

function clearStoredRecommendations(lang: LangCode): void {
  try {
    window.sessionStorage.removeItem(storageKey(lang));
  } catch {
    // A failed removal is harmless because force refresh still bypasses the API caches.
  }
}

function recommendations(
  chat: ChatPort,
  lang: LangCode,
  force = false,
): Promise<RecommendedPlan[]> {
  let byLanguage = requestCache.get(chat);
  if (!byLanguage) {
    byLanguage = new Map();
    requestCache.set(chat, byLanguage);
  }
  if (force) {
    byLanguage.delete(lang);
    clearStoredRecommendations(lang);
  } else {
    const stored = readStoredRecommendations(lang);
    if (stored) {
      if (!byLanguage.has(lang)) {
        const refresh = chat.generateRecommendedPlans({ lang, count: 5 });
        byLanguage.set(lang, refresh);
        void refresh.then(
          (plans) => writeStoredRecommendations(lang, plans),
          () => {
            if (byLanguage?.get(lang) === refresh) byLanguage.delete(lang);
          },
        );
      }
      return Promise.resolve(stored);
    }
  }

  const cached = byLanguage.get(lang);
  if (cached) return cached;

  const request = chat
    .generateRecommendedPlans({ lang, count: 5, refresh: force })
    .then((plans) => {
      writeStoredRecommendations(lang, plans);
      return plans;
    });
  byLanguage.set(lang, request);
  void request.catch(() => {
    if (byLanguage?.get(lang) === request) byLanguage.delete(lang);
  });
  return request;
}

function PhotoAttribution({
  items,
}: {
  items?: PlacePhotoAttribution[];
}): JSX.Element | null {
  if (!items?.length) return null;
  return (
    <small className="plan-first-photo-credit">
      Photo: {items.map((item, index) => (
        <span key={`${item.displayName}-${index}`}>
          {index > 0 ? ", " : ""}
          {item.uri ? (
            <a href={item.uri} target="_blank" rel="noreferrer">
              {item.displayName}
            </a>
          ) : item.displayName}
        </span>
      ))}
    </small>
  );
}

export function AIPlanFirst({ chat, onStart }: AIPlanFirstProps): JSX.Element {
  const { t, lang } = useI18n();
  const [plans, setPlans] = useState<RecommendedPlan[]>([]);
  const [selected, setSelected] = useState<RecommendedPlan | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async (force = false): Promise<void> => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const next = await recommendations(chat, lang, force);
      if (!isTourismRecommendations(next)) {
        throw new Error(t("planFirst.loadError"));
      }
      setPlans(next);
      setSelected(null);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("planFirst.loadError"));
      setStatus("error");
    }
  }, [chat, lang, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPlan = (plan: RecommendedPlan): void => {
    setSelected(plan);
  };

  if (selected) {
    const planIndex = Math.max(0, plans.findIndex((plan) => plan.id === selected.id));
    const fallbackImage = FALLBACK_IMAGES[planIndex % FALLBACK_IMAGES.length];
    return (
      <section className="plan-first plan-first--detail" aria-labelledby="plan-first-detail-title">
        <Button variant="ghost" size="sm" leading="←" onClick={() => setSelected(null)}>
          {t("planFirst.back")}
        </Button>

        <div className="plan-first-personalized">
          <p className="plan-first__kicker">YOUR EHIME JOURNEY</p>
          <h1 id="plan-first-detail-title" className="plan-first-personalized__title">
            {t("planFirst.personalizedTitle")}
          </h1>
          <p>{t("planFirst.personalizedLead")}</p>
        </div>

        <Card className="plan-first-detail" raised padded={false}>
          <img
            className="plan-first-detail__image"
            src={selected.imageUrl ?? fallbackImage}
            alt={selected.title}
            onError={(event) => { event.currentTarget.src = fallbackImage; }}
          />
          <PhotoAttribution items={selected.imageAttributions} />
          <div className="plan-first-detail__body">
            <div className="plan-first-card__tags">
              <Tag tone={TONES[planIndex % TONES.length]} leading={selected.icon}>
                {t("mode.tag.tourism")}
              </Tag>
              <Tag tone="outline">{t("planFirst.customized")}</Tag>
            </div>
            <h2 className="plan-first-detail__title">{selected.title}</h2>
            <p className="plan-first-detail__summary">{selected.summary}</p>

            <dl className="plan-first-meta plan-first-meta--detail">
              <div><dt>⏱</dt><dd>{selected.duration}</dd></div>
              <div><dt>🧭</dt><dd>{selected.transport}</dd></div>
              <div><dt>👟</dt><dd>{selected.intensity}</dd></div>
            </dl>

            <aside className="plan-first-reason">
              <span className="plan-first-reason__icon" aria-hidden="true">✨</span>
              <div>
                <h2>{t("planFirst.reasonTitle")}</h2>
                <p>{selected.reason}</p>
              </div>
            </aside>

            <aside className="plan-first-reason plan-first-theme-next">
              <span className="plan-first-reason__icon" aria-hidden="true">🃏</span>
              <div>
                <h2>{t("planFirst.themeNextTitle")}</h2>
                <p>{t("planFirst.themeNextLead")}</p>
              </div>
            </aside>

            <Button variant="accent" size="lg" block leading="▶" onClick={() => onStart(selected)}>
              {t("planFirst.start")}
            </Button>
            <p className="plan-first-detail__note">{t("planFirst.startNote")}</p>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="plan-first" aria-labelledby="plan-first-title">
      <header className="plan-first__header">
        <p className="plan-first__kicker">AI TRIP PICKS</p>
        <h1 id="plan-first-title" className="plan-first__title">
          {t("planFirst.title")}
        </h1>
        <p className="plan-first__lead">{t("planFirst.lead")}</p>
        <div className="plan-first__promise" role="note">
          <span aria-hidden="true">✨</span>
          <span>{t("planFirst.promise")}</span>
        </div>
      </header>

      {status === "loading" && (
        <Card className="plan-first-status" raised>
          <span className="plan-first-status__spinner" aria-hidden="true" />
          <p role="status">{t("planFirst.loading")}</p>
        </Card>
      )}

      {status === "error" && (
        <Card className="plan-first-status plan-first-status--error" raised>
          <p role="alert">{errorMessage || t("planFirst.loadError")}</p>
          <Button variant="soft" onClick={() => void load(true)}>
            {t("planFirst.retry")}
          </Button>
        </Card>
      )}

      {status === "ready" && (
        <>
          <div className="plan-first__count">
            <span>{t("planFirst.today")}</span>
            <span>{t("planFirst.count").replace("{count}", String(plans.length))}</span>
          </div>

          <ul className="plan-first__list" role="list">
            {plans.map((plan, index) => {
              const fallbackImage = FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
              return (
                <li key={plan.id}>
                  <Card className="plan-first-card-wrap" interactive raised padded={false}>
                    <button
                      type="button"
                      className="plan-first-card"
                      onClick={() => openPlan(plan)}
                      aria-label={`${t("planFirst.open")}: ${plan.title}`}
                    >
                      <span className="plan-first-card__media">
                        <img
                          className="plan-first-card__image"
                          src={plan.imageUrl ?? fallbackImage}
                          alt=""
                          onError={(event) => { event.currentTarget.src = fallbackImage; }}
                        />
                        <PhotoAttribution items={plan.imageAttributions} />
                      </span>
                      <span className="plan-first-card__body">
                        <span className="plan-first-card__tags">
                          <Tag tone={TONES[index % TONES.length]} leading={plan.icon}>
                            {t("mode.tag.tourism")}
                          </Tag>
                          <Tag tone="outline">{t("planFirst.aiPick")}</Tag>
                        </span>
                        <span className="plan-first-card__title">{plan.title}</span>
                        <span className="plan-first-card__summary">{plan.summary}</span>
                        <span className="plan-first-meta" aria-label={t("planFirst.metaLabel")}>
                          <span>⏱ {plan.duration}</span>
                          <span>🧭 {plan.transport}</span>
                          <span>👟 {plan.intensity}</span>
                        </span>
                        <span className="plan-first-card__open">
                          {t("planFirst.viewDetail")} <span aria-hidden="true">→</span>
                        </span>
                      </span>
                    </button>
                  </Card>
                </li>
              );
            })}
          </ul>

          <p className="plan-first__footer">{t("planFirst.footer")}</p>
        </>
      )}
    </section>
  );
}