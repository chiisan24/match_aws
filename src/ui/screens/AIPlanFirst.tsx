import { useState } from "react";

import type { AppMode } from "../../app/modeManager";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Tag, type TagTone } from "../components/Tag";

export interface AIPlanFirstProps {
  onStart: (mode: AppMode) => void;
}

interface RecommendedPlan {
  id: string;
  mode: AppMode;
  image: string;
  icon: string;
  tone: TagTone;
  titleKey: string;
  summaryKey: string;
  reasonKey: string;
  durationKey: string;
  transportKey: string;
  intensityKey: string;
  stopKeys: readonly string[];
}

const PLANS: readonly RecommendedPlan[] = [
  {
    id: "matsuyama-classic",
    mode: "tourism",
    image: "/images/ehime/matsuyama-castle.jpg",
    icon: "🏯",
    tone: "accent",
    titleKey: "planFirst.plan.classic.title",
    summaryKey: "planFirst.plan.classic.summary",
    reasonKey: "planFirst.plan.classic.reason",
    durationKey: "planFirst.meta.fourHours",
    transportKey: "planFirst.meta.tramWalk",
    intensityKey: "planFirst.meta.easy",
    stopKeys: [
      "planFirst.stop.matsuyamaCastle",
      "planFirst.stop.dogoOnsen",
      "planFirst.stop.localDinner",
    ],
  },
  {
    id: "dogo-slow",
    mode: "tourism",
    image: "/images/ehime/onsen-bath.jpg",
    icon: "♨️",
    tone: "teal",
    titleKey: "planFirst.plan.slow.title",
    summaryKey: "planFirst.plan.slow.summary",
    reasonKey: "planFirst.plan.slow.reason",
    durationKey: "planFirst.meta.threeHours",
    transportKey: "planFirst.meta.walk",
    intensityKey: "planFirst.meta.veryEasy",
    stopKeys: [
      "planFirst.stop.dogoTown",
      "planFirst.stop.onsen",
      "planFirst.stop.cafe",
    ],
  },
  {
    id: "uchiko-hidden",
    mode: "tourism",
    image: "/images/ehime/uchiko-townscape.jpg",
    icon: "🏘️",
    tone: "moss",
    titleKey: "planFirst.plan.hidden.title",
    summaryKey: "planFirst.plan.hidden.summary",
    reasonKey: "planFirst.plan.hidden.reason",
    durationKey: "planFirst.meta.fiveHours",
    transportKey: "planFirst.meta.trainWalk",
    intensityKey: "planFirst.meta.moderate",
    stopKeys: [
      "planFirst.stop.uchiko",
      "planFirst.stop.washi",
      "planFirst.stop.localCafe",
    ],
  },
  {
    id: "ohenro-first",
    mode: "pilgrimage",
    image: "/images/ehime/setouchi-shrine.jpg",
    icon: "⛩️",
    tone: "outline",
    titleKey: "planFirst.plan.ohenro.title",
    summaryKey: "planFirst.plan.ohenro.summary",
    reasonKey: "planFirst.plan.ohenro.reason",
    durationKey: "planFirst.meta.halfDay",
    transportKey: "planFirst.meta.carWalk",
    intensityKey: "planFirst.meta.moderate",
    stopKeys: [
      "planFirst.stop.ishiteji",
      "planFirst.stop.jodoji",
      "planFirst.stop.localLunch",
    ],
  },
  {
    id: "shimanami-surprise",
    mode: "tourism",
    image: "/images/ehime/kurushima-bridge.jpg",
    icon: "✨",
    tone: "accent",
    titleKey: "planFirst.plan.surprise.title",
    summaryKey: "planFirst.plan.surprise.summary",
    reasonKey: "planFirst.plan.surprise.reason",
    durationKey: "planFirst.meta.halfDay",
    transportKey: "planFirst.meta.carBike",
    intensityKey: "planFirst.meta.active",
    stopKeys: [
      "planFirst.stop.kurushima",
      "planFirst.stop.seaside",
      "planFirst.stop.sunset",
    ],
  },
];

const ADJUSTMENT_KEYS = [
  "planFirst.adjust.shorter",
  "planFirst.adjust.lessWalking",
  "planFirst.adjust.moreFood",
  "planFirst.adjust.moreHidden",
] as const;

export function AIPlanFirst({ onStart }: AIPlanFirstProps): JSX.Element {
  const { t } = useI18n();
  const [selected, setSelected] = useState<RecommendedPlan | null>(null);
  const [adjustments, setAdjustments] = useState<string[]>([]);

  const openPlan = (plan: RecommendedPlan): void => {
    setSelected(plan);
    setAdjustments([]);
  };

  const toggleAdjustment = (key: string): void => {
    setAdjustments((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  if (selected) {
    const stopTimes = ["09:00", "11:30", "14:00"];
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
          <img className="plan-first-detail__image" src={selected.image} alt="" />
          <div className="plan-first-detail__body">
            <div className="plan-first-card__tags">
              <Tag tone={selected.tone} leading={selected.icon}>
                {t(selected.mode === "pilgrimage" ? "mode.tag.pilgrimage" : "mode.tag.tourism")}
              </Tag>
              <Tag tone="outline">{t("planFirst.customized")}</Tag>
            </div>
            <h2 className="plan-first-detail__title">{t(selected.titleKey)}</h2>
            <p className="plan-first-detail__summary">{t(selected.summaryKey)}</p>

            <dl className="plan-first-meta plan-first-meta--detail">
              <div><dt>⏱</dt><dd>{t(selected.durationKey)}</dd></div>
              <div><dt>🧭</dt><dd>{t(selected.transportKey)}</dd></div>
              <div><dt>👟</dt><dd>{t(selected.intensityKey)}</dd></div>
            </dl>

            <section aria-labelledby="plan-first-route-title">
              <h3 id="plan-first-route-title" className="plan-first-detail__section-title">
                {t("planFirst.routeTitle")}
              </h3>
              <ol className="plan-first-route">
                {selected.stopKeys.map((key, index) => (
                  <li key={key}>
                    <time className="plan-first-route__time">{stopTimes[index]}</time>
                    <span className="plan-first-route__number">{index + 1}</span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ol>
            </section>

            <fieldset className="plan-first-adjust">
              <legend>{t("planFirst.adjustTitle")}</legend>
              <p>{t("planFirst.adjustLead")}</p>
              <div className="plan-first-adjust__options">
                {ADJUSTMENT_KEYS.map((key) => {
                  const active = adjustments.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`plan-first-adjust__chip${active ? " plan-first-adjust__chip--active" : ""}`}
                      aria-pressed={active}
                      onClick={() => toggleAdjustment(key)}
                    >
                      {active ? "✓ " : "+ "}{t(key)}
                    </button>
                  );
                })}
              </div>
              {adjustments.length > 0 && (
                <p className="plan-first-adjust__status" role="status">
                  {t("planFirst.adjustStatus").replace("{count}", String(adjustments.length))}
                </p>
              )}
            </fieldset>

            <Button variant="accent" size="lg" block leading="▶" onClick={() => onStart(selected.mode)}>
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

      <div className="plan-first__count">
        <span>{t("planFirst.today")}</span>
        <span>{t("planFirst.count").replace("{count}", String(PLANS.length))}</span>
      </div>

      <ul className="plan-first__list" role="list">
        {PLANS.map((plan) => (
          <li key={plan.id}>
            <Card className="plan-first-card-wrap" interactive raised padded={false}>
              <button
                type="button"
                className="plan-first-card"
                onClick={() => openPlan(plan)}
                aria-label={`${t("planFirst.open")}: ${t(plan.titleKey)}`}
              >
                <img className="plan-first-card__image" src={plan.image} alt="" />
                <span className="plan-first-card__body">
                  <span className="plan-first-card__tags">
                    <Tag tone={plan.tone} leading={plan.icon}>
                      {t(plan.mode === "pilgrimage" ? "mode.tag.pilgrimage" : "mode.tag.tourism")}
                    </Tag>
                    <Tag tone="outline">{t("planFirst.aiPick")}</Tag>
                  </span>
                  <span className="plan-first-card__title">{t(plan.titleKey)}</span>
                  <span className="plan-first-card__summary">{t(plan.summaryKey)}</span>
                  <span className="plan-first-meta" aria-label={t("planFirst.metaLabel")}>
                    <span>⏱ {t(plan.durationKey)}</span>
                    <span>🧭 {t(plan.transportKey)}</span>
                    <span>👟 {t(plan.intensityKey)}</span>
                  </span>
                  <span className="plan-first-card__open">
                    {t("planFirst.viewDetail")} <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            </Card>
          </li>
        ))}
      </ul>

      <p className="plan-first__footer">{t("planFirst.footer")}</p>
    </section>
  );
}