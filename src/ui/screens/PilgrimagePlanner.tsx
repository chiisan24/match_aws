/**
 * PilgrimagePlanner — the 今日のお遍路プラン screen for the お遍路モード
 * "mypage" tab (Req 12). This is a 後続フェーズ / Post-MVP feature, but it is
 * fully functional on the mock ChatPort (Req 12.5): the copy keeps its
 * later-phase nature clear while everything below works end to end.
 *
 * The flow:
 *
 *  - a condition form captures 出発地点・利用可能時間・移動手段・希望札所・体力
 *    レベル・観光を含むか and requests generation (Req 12.1) through the injected
 *    {@link ChatPort.generatePilgrimagePlan} (gateway.chat — mock by default,
 *    Req 12.5). It never reimplements the plan logic itself;
 *  - the generated plan renders as a 時刻付きタイムライン (Req 12.2). The stops are
 *    sorted ascending by time **defensively** here so the timeline always holds
 *    Property 22 regardless of adapter output, and an empty plan renders calmly
 *    without error;
 *  - choosing 観光を含む asks the mock to mix nearby スポット/飲食店 in with the
 *    temples (Req 12.3 — handled by the adapter's `includeSightseeing`);
 *  - on failure the screen shows an error message plus a retry that re-runs the
 *    exact same request (Req 12.4).
 *
 * 希望札所 candidates come from the selected 対象県's temples via the
 * {@link MapLocationPort} (mock by default — Req 8.5), so the picker always
 * agrees with the 札所マップ / 巡礼進捗 screens.
 */

import { useEffect, useMemo, useState } from "react";

import { usePilgrimage } from "../../app/PilgrimageContext";
import type {
  PilgrimagePlan,
  PlanInput,
  PlanStop,
  Temple,
} from "../../domain/types";
import type { ChatPort, MapLocationPort } from "../../ports";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";

export interface PilgrimagePlannerProps {
  /** AI backend; inject `gateway.chat` in the app, a fake in tests (Req 12.5). */
  chat: ChatPort;
  /** Map/location backend for the 希望札所 picker (mock by default — Req 8.5). */
  map: MapLocationPort;
}

type Transport = PlanInput["transport"];
type Fitness = PlanInput["fitnessLevel"];

/** Available-time choices, in hours (mapped to minutes for {@link PlanInput}). */
const HOUR_CHOICES = [3, 4, 6, 8] as const;
const TRANSPORT_CHOICES: readonly Transport[] = ["walk", "car", "bike"];
const FITNESS_CHOICES: readonly Fitness[] = ["low", "mid", "high"];

/** i18n keys for the small enum pickers. */
const TRANSPORT_KEY: Record<Transport, string> = {
  walk: "planner.transport.walk",
  car: "planner.transport.car",
  bike: "planner.transport.bike",
};
const FITNESS_KEY: Record<Fitness, string> = {
  low: "planner.fitness.low",
  mid: "planner.fitness.mid",
  high: "planner.fitness.high",
};
const KIND_KEY: Record<PlanStop["kind"], string> = {
  temple: "planner.kind.temple",
  spot: "planner.kind.spot",
  meal: "planner.kind.meal",
};
const KIND_ICON: Record<PlanStop["kind"], string> = {
  temple: "⛩️",
  spot: "📸",
  meal: "🍱",
};

/** Parse an `"HH:MM"` time string into minutes-from-midnight (NaN-tolerant). */
function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return Number.POSITIVE_INFINITY; // push unparseable times to the end
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Returns the stops sorted ascending by time — the defensive guarantee behind
 * Property 22. Stable for equal times; unparseable times sort last. Never
 * mutates the input array.
 */
function sortStopsByTime(stops: readonly PlanStop[]): PlanStop[] {
  return stops
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => {
      const delta = timeToMinutes(a.stop.time) - timeToMinutes(b.stop.time);
      return delta !== 0 ? delta : a.index - b.index;
    })
    .map((entry) => entry.stop);
}

export function PilgrimagePlanner({
  chat,
  map,
}: PilgrimagePlannerProps): JSX.Element {
  const { t } = useI18n();
  const { area } = usePilgrimage();

  // -- Condition form state -------------------------------------------------
  const [startPoint, setStartPoint] = useState("");
  const [hours, setHours] = useState<number>(HOUR_CHOICES[1]); // default 4h
  const [transport, setTransport] = useState<Transport>("car");
  const [desiredTemples, setDesiredTemples] = useState<string[]>([]);
  const [fitness, setFitness] = useState<Fitness>("mid");
  const [includeSightseeing, setIncludeSightseeing] = useState(false);

  // -- Temple candidates for the 希望札所 picker ----------------------------
  const [temples, setTemples] = useState<Temple[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await map.getTemples(area);
        if (!cancelled) setTemples(loaded);
      } catch {
        if (!cancelled) setTemples([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, area]);

  const orderedTemples = useMemo(
    () => [...temples].sort((a, b) => a.number - b.number),
    [temples],
  );

  // -- Generation state -----------------------------------------------------
  const [plan, setPlan] = useState<PilgrimagePlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  // The exact input of the last request, so retry re-runs it verbatim (Req 12.4).
  const [lastInput, setLastInput] = useState<PlanInput | null>(null);

  const buildInput = (): PlanInput => ({
    startPoint: startPoint.trim(),
    availableMinutes: hours * 60,
    transport,
    desiredTemples,
    fitnessLevel: fitness,
    includeSightseeing,
  });

  // Runs a single generation request (Req 12.1). Shared by the form submit and
  // the retry button — retry passes the stored input so it re-runs identically.
  const runGeneration = async (input: PlanInput): Promise<void> => {
    setGenerating(true);
    setError(false);
    setLastInput(input);
    try {
      const result = await chat.generatePilgrimagePlan(input);
      setPlan(result);
    } catch {
      // Surface an error + retry rather than throwing (Req 12.4).
      setError(true);
      setPlan(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (generating) return;
    void runGeneration(buildInput());
  };

  const handleRetry = (): void => {
    if (generating) return;
    // Re-run the same request (Req 12.4); fall back to the current form if none.
    void runGeneration(lastInput ?? buildInput());
  };

  const toggleTemple = (id: string): void => {
    setDesiredTemples((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <section className="planner" aria-labelledby="planner-heading">
      <SectionHeader
        eyebrow="OHENRO PLAN"
        title={<span id="planner-heading">{t("planner.title")}</span>}
      />
      <p className="planner__lead">{t("planner.lead")}</p>
      <p className="planner__phase">
        <Tag tone="accent">{t("planner.phaseNote")}</Tag>
      </p>

      <Card className="planner-form" blob raised>
        <form onSubmit={handleSubmit} aria-label={t("planner.title")}>
          {/* 出発地点 */}
          <label className="planner-field">
            <span className="planner-field__label">
              {t("planner.form.start")}
            </span>
            <input
              type="text"
              className="planner-field__control"
              value={startPoint}
              onChange={(e) => setStartPoint(e.target.value)}
              placeholder={t("planner.form.startPlaceholder")}
              data-testid="planner-start"
            />
          </label>

          {/* 利用できる時間 */}
          <label className="planner-field">
            <span className="planner-field__label">
              {t("planner.form.time")}
            </span>
            <select
              className="planner-field__control"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              data-testid="planner-hours"
            >
              {HOUR_CHOICES.map((h) => (
                <option key={h} value={h}>
                  {t("planner.form.hoursUnit").replace("{h}", String(h))}
                </option>
              ))}
            </select>
          </label>

          {/* 移動手段 */}
          <fieldset className="planner-field planner-field--group">
            <legend className="planner-field__label">
              {t("planner.form.transport")}
            </legend>
            <div className="planner-seg" role="group">
              {TRANSPORT_CHOICES.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant={opt === transport ? "primary" : "ghost"}
                  size="sm"
                  aria-pressed={opt === transport}
                  onClick={() => setTransport(opt)}
                >
                  {t(TRANSPORT_KEY[opt])}
                </Button>
              ))}
            </div>
          </fieldset>

          {/* 体力レベル */}
          <fieldset className="planner-field planner-field--group">
            <legend className="planner-field__label">
              {t("planner.form.fitness")}
            </legend>
            <div className="planner-seg" role="group">
              {FITNESS_CHOICES.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant={opt === fitness ? "primary" : "ghost"}
                  size="sm"
                  aria-pressed={opt === fitness}
                  onClick={() => setFitness(opt)}
                >
                  {t(FITNESS_KEY[opt])}
                </Button>
              ))}
            </div>
          </fieldset>

          {/* 希望する札所 */}
          <fieldset className="planner-field planner-field--group">
            <legend className="planner-field__label">
              {t("planner.form.temples")}
            </legend>
            <span className="planner-field__hint">
              {t("planner.form.templesHint")}
            </span>
            {orderedTemples.length === 0 ? (
              <p className="planner-field__note">
                {t("planner.form.noTemples")}
              </p>
            ) : (
              <ul className="planner-temples" role="list">
                {orderedTemples.map((tm) => {
                  const checked = desiredTemples.includes(tm.id);
                  return (
                    <li key={tm.id} className="planner-temples__item">
                      <label className="planner-temple">
                        <input
                          type="checkbox"
                          className="planner-temple__check"
                          checked={checked}
                          onChange={() => toggleTemple(tm.id)}
                          data-testid="planner-temple"
                        />
                        <span className="planner-temple__no" aria-hidden="true">
                          {tm.number}
                        </span>
                        <span className="planner-temple__name">{tm.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          {/* 観光を含むか */}
          <label className="planner-toggle">
            <input
              type="checkbox"
              className="planner-toggle__check"
              checked={includeSightseeing}
              onChange={(e) => setIncludeSightseeing(e.target.checked)}
              data-testid="planner-sightseeing"
            />
            <span className="planner-toggle__body">
              <span className="planner-toggle__label">
                {t("planner.form.sightseeing")}
              </span>
              <span className="planner-toggle__hint">
                {t("planner.form.sightseeingHint")}
              </span>
            </span>
          </label>

          <Button
            type="submit"
            variant="accent"
            block
            leading="✨"
            disabled={generating}
          >
            {generating ? t("planner.generating") : t("planner.generate")}
          </Button>
        </form>
      </Card>

      {/* Error + retry (Req 12.4) */}
      {error && (
        <Card className="planner-error" blob>
          <p className="planner-error__text" role="alert">
            {t("planner.error")}
          </p>
          <Button
            variant="primary"
            block
            leading="↻"
            onClick={handleRetry}
            disabled={generating}
            data-testid="planner-retry"
          >
            {t("planner.retry")}
          </Button>
        </Card>
      )}

      {/* Generated timeline (Req 12.2) */}
      {plan && !error && (
        <PlanTimeline plan={plan} onRemake={() => setPlan(null)} t={t} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Timeline (Req 12.2 / Property 22) — stops always ascending by time
// ---------------------------------------------------------------------------

interface PlanTimelineProps {
  plan: PilgrimagePlan;
  onRemake: () => void;
  t: (key: string) => string;
}

function PlanTimeline({ plan, onRemake, t }: PlanTimelineProps): JSX.Element {
  // Defensive sort so the rendered timeline is always ascending (Property 22).
  const stops = useMemo(() => sortStopsByTime(plan.stops), [plan.stops]);

  return (
    <Card className="planner-result" blob raised>
      <h3 className="planner-result__title">{t("planner.result.title")}</h3>

      {stops.length === 0 ? (
        // An empty plan must render calmly without error (Req 12.2 / Property 22).
        <p className="planner-result__empty" data-testid="planner-empty">
          {t("planner.result.empty")}
        </p>
      ) : (
        <ol className="planner-timeline" data-testid="planner-timeline">
          {stops.map((stop, i) => (
            <li key={i} className="planner-timeline__item">
              <span className="planner-timeline__time" data-testid="planner-time">
                {stop.time}
              </span>
              <span
                className="planner-timeline__dot"
                data-kind={stop.kind}
                aria-hidden="true"
              >
                {KIND_ICON[stop.kind]}
              </span>
              <span className="planner-timeline__body">
                <span className="planner-timeline__label">{stop.label}</span>
                <Tag tone={stop.kind === "temple" ? "teal" : "accent"}>
                  {t(KIND_KEY[stop.kind])}
                </Tag>
              </span>
            </li>
          ))}
        </ol>
      )}

      <Button variant="ghost" block leading="✎" onClick={onRemake}>
        {t("planner.regenerate")}
      </Button>
    </Card>
  );
}
