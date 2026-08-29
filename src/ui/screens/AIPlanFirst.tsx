import { useCallback, useEffect, useState } from "react";

import type {
  ChatPort,
  LangCode,
  PlacePhotoAttribution,
  RecommendationExclusion,
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
const RECOMMENDATIONS_CACHE_VERSION = "v6-itinerary-v1";
const ITINERARY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ITINERARY_KINDS = new Set(["sightseeing", "food", "cafe", "custom"]);

function isTourismRecommendations(value: unknown): value is RecommendedPlan[] {
  return Array.isArray(value)
    && value.length === 5
    && value.every((plan) => {
      if (plan == null || typeof plan !== "object") return false;
      const candidate = plan as { mode?: unknown; stops?: unknown };
      let previousTime = "";
      return candidate.mode === "tourism"
        && Array.isArray(candidate.stops)
        && candidate.stops.length >= 2
        && candidate.stops.length <= 4
        && candidate.stops.every((stop) => {
          if (stop == null || typeof stop !== "object") return false;
          const item = stop as {
            time?: unknown;
            kind?: unknown;
            title?: unknown;
            place?: { location?: { lat?: unknown; lng?: unknown } };
          };
          const time = String(item.time ?? "");
          const location = item.place?.location;
          const valid = ITINERARY_TIME_PATTERN.test(time)
            && (!previousTime || time > previousTime)
            && typeof item.kind === "string"
            && ITINERARY_KINDS.has(item.kind)
            && typeof item.title === "string"
            && item.title.trim() !== ""
            && Number.isFinite(location?.lat)
            && Number.isFinite(location?.lng);
          previousTime = time;
          return valid;
        });
    });
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

function recommendations(
  chat: ChatPort,
  lang: LangCode,
  force = false,
  exclude: RecommendationExclusion[] = [],
): Promise<RecommendedPlan[]> {
  let byLanguage = requestCache.get(chat);
  if (!byLanguage) {
    byLanguage = new Map();
    requestCache.set(chat, byLanguage);
  }
  if (force) {
    byLanguage.delete(lang);
  } else {
    const stored = readStoredRecommendations(lang);
    if (stored) {
      if (!byLanguage.has(lang)) {
        const refresh = chat.generateRecommendedPlans({
          lang,
          count: 5,
          date: recommendationDate(),
        });
        byLanguage.set(lang, refresh);
        void refresh.then(
          (plans) => {
            if (byLanguage?.get(lang) === refresh && isTourismRecommendations(plans)) {
              writeStoredRecommendations(lang, plans);
            }
          },
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
    .generateRecommendedPlans({
      lang,
      count: 5,
      date: recommendationDate(),
      refresh: force,
      ...(force && exclude.length > 0 ? { exclude } : {}),
    })
    .then((plans) => {
      if (!isTourismRecommendations(plans)) {
        throw new Error("Invalid itinerary recommendations payload.");
      }
      writeStoredRecommendations(lang, plans);
      return plans;
    });
  byLanguage.set(lang, request);
  void request.catch(() => {
    if (byLanguage?.get(lang) === request) byLanguage.delete(lang);
  });
  return request;
}

function exclusionsFrom(plans: RecommendedPlan[]): RecommendationExclusion[] {
  return plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    place: plan.stops[0]?.searchQuery ?? "",
    ...(plan.stops[0]?.place?.id ? { placeId: plan.stops[0].place.id } : {}),
  }));
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

function TravelerLoadingIllustration(): JSX.Element {
  return (
    <div className="plan-first-status__journey" aria-hidden="true">
      <svg
        className="plan-first-journey__canvas"
        viewBox="0 0 320 120"
        focusable="false"
      >
        <circle className="plan-first-journey__sun" cx="270" cy="25" r="12" />
        <g className="plan-first-journey__cloud">
          <circle cx="34" cy="25" r="8" />
          <circle cx="44" cy="20" r="11" />
          <circle cx="56" cy="26" r="8" />
          <rect x="34" y="25" width="22" height="8" rx="4" />
        </g>
        <path className="plan-first-journey__hill plan-first-journey__hill--back" d="M0 77 Q48 35 94 77 T188 77 T282 77 T376 77 V120 H0 Z" />
        <path className="plan-first-journey__hill" d="M0 91 Q55 57 110 91 T220 91 T330 91 V120 H0 Z" />
        <path className="plan-first-journey__road" d="M-10 105 C70 87 145 113 330 92" />
        <path className="plan-first-journey__road-dash" d="M-10 105 C70 87 145 113 330 92" />
        <g className="plan-first-journey__traveler">
          <g className="plan-first-journey__traveler-body">
            <rect className="plan-first-journey__backpack" x="3" y="54" width="13" height="24" rx="5" />
            <circle className="plan-first-journey__head" cx="22" cy="42" r="9" />
            <path className="plan-first-journey__hat" d="M12 40 Q22 27 32 40 Z M10 40 H35" />
            <path className="plan-first-journey__body" d="M20 52 L22 78" />
            <path className="plan-first-journey__arm" d="M20 57 L8 69 M21 57 L34 68" />
            <path className="plan-first-journey__leg plan-first-journey__leg--front" d="M22 77 L34 96" />
            <path className="plan-first-journey__leg plan-first-journey__leg--back" d="M22 77 L14 97" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function AIPlanFirst({ chat, onStart }: AIPlanFirstProps): JSX.Element {
  const { t, lang } = useI18n();
  const [plans, setPlans] = useState<RecommendedPlan[]>([]);
  const [selected, setSelected] = useState<RecommendedPlan | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const load = useCallback(async (
    force = false,
    exclude: RecommendationExclusion[] = [],
  ): Promise<void> => {
    if (force) {
      setRefreshing(true);
      setRefreshError("");
    } else {
      setStatus("loading");
      setErrorMessage("");
    }
    try {
      const next = await recommendations(chat, lang, force, exclude);
      if (!isTourismRecommendations(next)) {
        throw new Error(t("planFirst.loadError"));
      }
      setPlans(next);
      if (!force) setSelected(null);
      setStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("planFirst.loadError");
      if (force) {
        setRefreshError(message);
      } else {
        setErrorMessage(message);
        setStatus("error");
      }
    } finally {
      if (force) setRefreshing(false);
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

            <section aria-labelledby="plan-first-route-title">
              <h3 id="plan-first-route-title" className="plan-first-detail__section-title">
                {t("planFirst.routeTitle")}
              </h3>
              <ol className="plan-first-route plan-first-route--places">
                {selected.stops.map((stop, index) => (
                  <li key={`${stop.time}-${stop.title}`}>
                    <time className="plan-first-route__time" dateTime={stop.time}>{stop.time}</time>
                    <span className="plan-first-route__number">{index + 1}</span>
                    <div className={`plan-first-place${stop.place?.photoUrl ? "" : " plan-first-place--no-photo"}`}>
                      {stop.place?.photoUrl ? (
                        <div className="plan-first-place__photo-wrap">
                          <img
                            className="plan-first-place__photo"
                            src={stop.place.photoUrl}
                            alt={stop.place.name}
                            loading="lazy"
                          />
                          <PhotoAttribution items={stop.place.photoAttributions} />
                        </div>
                      ) : null}
                      <div className="plan-first-place__body">
                        <strong>{stop.title}</strong>
                        <p>{stop.description}</p>
                        {stop.place ? (
                          <div className="plan-first-place__google">
                            <span className="plan-first-place__verified">
                              {t("planFirst.googleVerified")}
                            </span>
                            <span>{stop.place.name}</span>
                            {stop.place.formattedAddress ? (
                              <address>{stop.place.formattedAddress}</address>
                            ) : null}
                            {stop.place.googleMapsUri ? (
                              <a href={stop.place.googleMapsUri} target="_blank" rel="noreferrer">
                                {t("planFirst.openGoogleMaps")} ↗
                              </a>
                            ) : null}
                          </div>
                        ) : (
                          <small className="plan-first-place__unavailable">
                            {t("planFirst.placeUnavailable")}
                          </small>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

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
          <TravelerLoadingIllustration />
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
            <span className="plan-first__count-actions">
              <span className="plan-first__count-value">
                {t("planFirst.count").replace("{count}", String(plans.length))}
              </span>
              <Button
                variant="soft"
                size="sm"
                leading="↻"
                disabled={refreshing}
                aria-busy={refreshing}
                onClick={() => void load(true, exclusionsFrom(plans))}
              >
                {t(refreshing ? "planFirst.refreshing" : "planFirst.refresh")}
              </Button>
            </span>
          </div>
          {refreshError ? (
            <p className="plan-first__refresh-error" role="alert">{refreshError}</p>
          ) : null}

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