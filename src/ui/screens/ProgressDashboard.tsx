/**
 * ProgressDashboard — the 巡礼進捗ダッシュボード for the お遍路モード "home" tab
 * (Req 9). This is the screen that turns "巡れば巡るほど達成感が貯まる" into
 * something the user can see at a glance, matching the mockup home:
 *
 *  - two 進捗リング: 愛媛県(=selected 対象県) {visited}/{total} {rate}% (Req 9.1)
 *    and 四国全体 {visited}/88 {rate}% (Req 9.2), both using the floored-percent
 *    {@link achievementRate} via the domain helpers (Req 9.3),
 *  - a stat row: 今日巡った札所 / 今月巡った札所 / 残りの札所 (Req 9.5),
 *  - a 対象県 selector (四国 4 県, default 愛媛) that scopes the area ring/残数
 *    (Req 9.6),
 *  - a 次の札所ナビ card — the next unvisited 札所 with distance / 所要時間 /
 *    見どころ and a button through to the 札所マップ, and
 *  - a 今日のおすすめAIプラン teaser (the AI plan itself is task 11.1 /
 *    post-MVP, so this is a calm placeholder).
 *
 * All progress numbers are derived from the shared {@link usePilgrimage} store
 * via the pure `domain/progress` functions — this screen never reimplements the
 * arithmetic, so design Properties 17–20 govern its output. Recomputation on
 * visit changes (Req 9.4) is automatic: the visited set lives in React state,
 * so toggling a visit re-renders this screen with fresh numbers.
 */

import { useEffect, useMemo, useState } from "react";

import { usePilgrimage, SHIKOKU_PREFECTURES } from "../../app/PilgrimageContext";
import {
  areaAchievementRate,
  areaTotal,
  remainingInArea,
  shikokuAchievementRate,
  shikokuRemaining,
  shikokuVisitedCount,
  visitedCountInArea,
  visitedThisMonthCount,
  visitedTodayCount,
} from "../../domain/progress";
import type {
  GeoPoint,
  NextTempleNavEstimate,
  ShikokuPrefecture,
  Temple,
} from "../../domain/types";
import { cleanTempleAddress } from "../../domain/templeNav";
import type { ChatPort, MapLocationPort } from "../../ports";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ProgressRing } from "../components/ProgressRing";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";

export interface ProgressDashboardProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
  /** AI backend used to estimate the 次の札所ナビ figures (mock by default). */
  chat: ChatPort;
  /** Jump to the 札所マップ tab (the 次の札所ナビ route button). */
  onOpenMap: () => void;
  /** Open the 今日のお遍路プラン screen (the AIプラン teaser, Req 12 — task 11.1). */
  onOpenPlan?: () => void;
}

/** i18n key for each prefecture's display name. */
const PREFECTURE_NAME_KEY: Record<ShikokuPrefecture, string> = {
  tokushima: "progress.pref.tokushima",
  kochi: "progress.pref.kochi",
  ehime: "progress.pref.ehime",
  kagawa: "progress.pref.kagawa",
};

export function ProgressDashboard({
  map,
  chat,
  onOpenMap,
  onOpenPlan,
}: ProgressDashboardProps): JSX.Element {
  const { t, lang } = useI18n();
  const { progress, area, setArea, visited, visitRecords } = usePilgrimage();

  const [temples, setTemples] = useState<Temple[]>([]);
  const [current, setCurrent] = useState<GeoPoint | null>(null);

  // Load the selected area's temples + a current location for the 次の札所ナビ
  // card (mock by default — Req 8.5). Re-runs when the 対象県 changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [loadedTemples, loadedLocation] = await Promise.all([
          map.getTemples(area),
          map.getCurrentLocation(),
        ]);
        if (cancelled) return;
        setTemples(loadedTemples);
        setCurrent(loadedLocation);
      } catch {
        if (!cancelled) {
          setTemples([]);
          setCurrent(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, area]);

  // -- Progress numbers (pure domain helpers — Properties 17–20) ------------
  const areaName = t(PREFECTURE_NAME_KEY[area]);
  const areaVisited = visitedCountInArea(progress);
  const areaCount = areaTotal(progress);
  const areaRate = areaAchievementRate(progress);
  const areaRemaining = remainingInArea(progress);

  const shikokuVisited = shikokuVisitedCount(progress);
  const shikokuRate = shikokuAchievementRate(progress);
  const shikokuLeft = shikokuRemaining(progress);

  // 今日 / 今月 tallies come from the recorded visits (Req 9.5). `now` is read
  // once per render; the underlying counting is a pure domain function.
  const now = useMemo(() => new Date(), []);
  const todayCount = visitedTodayCount(visitRecords, now);
  const monthCount = visitedThisMonthCount(visitRecords, now);

  // -- 次の札所ナビ: the lowest-numbered unvisited 札所 in the selected area --
  const nextTemple = useMemo<Temple | null>(() => {
    const candidates = temples
      .filter((tm) => !visited.has(tm.id))
      .sort((a, b) => a.number - b.number);
    return candidates[0] ?? null;
  }, [temples, visited]);

  // AI-estimated navigation figures for the 次の札所ナビ card (距離・所要時間・
  // 見どころ・注意書き). These are 目安/参考情報 — the card labels them as such.
  // Never throws: the port falls back to a local estimate on any failure.
  const [navEstimate, setNavEstimate] = useState<NextTempleNavEstimate | null>(
    null,
  );
  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    if (!nextTemple) {
      setNavEstimate(null);
      setNavLoading(false);
      return;
    }
    let cancelled = false;
    setNavLoading(true);
    void (async () => {
      try {
        const estimate = await chat.estimateNextTempleNav({
          from: current,
          temple: {
            id: nextTemple.id,
            name: nextTemple.name,
            number: nextTemple.number,
            location: nextTemple.location,
            address: nextTemple.address,
            highlights: nextTemple.highlights,
          },
          lang,
        });
        if (!cancelled) setNavEstimate(estimate);
      } catch {
        // Defensive: the port shouldn't throw, but never break the dashboard.
        if (!cancelled) setNavEstimate(null);
      } finally {
        if (!cancelled) setNavLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chat, nextTemple, current, lang]);

  return (
    <section className="progress-dash" aria-labelledby="progress-dash-heading">
      <SectionHeader
        eyebrow="OHENRO"
        title={<span id="progress-dash-heading">{t("progress.title")}</span>}
      />
      <p className="progress-dash__lead">{t("progress.lead")}</p>

      {/* 対象県 selector (Req 9.6) */}
      <AreaSelector area={area} onSelect={setArea} t={t} />

      {/* 進捗リング: 対象県(愛媛) と 四国全体 (Req 9.1, 9.2) */}
      <div className="progress-dash__rings">
        <Card className="progress-ring-card" blob raised>
          <ProgressRing
            value={areaRate}
            caption={t("progress.achieved")}
            label={t("progress.areaRingLabel").replace("{area}", areaName)}
          />
          <div className="progress-ring-card__meta">
            <p className="progress-ring-card__scope">
              {areaName}
              <span className="progress-ring-card__total">
                {t("progress.ofCount").replace("{total}", String(areaCount))}
              </span>
            </p>
            <p
              className="progress-ring-card__count"
              data-testid="area-progress-count"
            >
              {t("progress.visitedFraction")
                .replace("{visited}", String(areaVisited))
                .replace("{total}", String(areaCount))}
            </p>
          </div>
        </Card>

        <Card className="progress-ring-card" blob raised>
          <ProgressRing
            value={shikokuRate}
            caption={t("progress.achieved")}
            label={t("progress.shikokuRingLabel")}
          />
          <div className="progress-ring-card__meta">
            <p className="progress-ring-card__scope">
              {t("progress.shikoku")}
              <span className="progress-ring-card__total">
                {t("progress.ofCount").replace(
                  "{total}",
                  String(progress.shikokuTotal),
                )}
              </span>
            </p>
            <p
              className="progress-ring-card__count"
              data-testid="shikoku-progress-count"
            >
              {t("progress.visitedFraction")
                .replace("{visited}", String(shikokuVisited))
                .replace("{total}", String(progress.shikokuTotal))}
            </p>
          </div>
        </Card>
      </div>

      {/* 今日 / 今月 / 残り (Req 9.5) */}
      <ul className="progress-dash__stats" role="list">
        <StatTile
          label={t("progress.stat.today")}
          value={todayCount}
          unit={t("progress.stat.unit")}
          testId="stat-today"
        />
        <StatTile
          label={t("progress.stat.month")}
          value={monthCount}
          unit={t("progress.stat.unit")}
          testId="stat-month"
        />
        <StatTile
          label={t("progress.stat.remaining")}
          value={areaRemaining}
          unit={t("progress.stat.unit")}
          testId="stat-remaining"
        />
      </ul>

      {/* 次の札所ナビ */}
      <NextTempleCard
        temple={nextTemple}
        estimate={navEstimate}
        loading={navLoading}
        allVisited={areaCount > 0 && areaRemaining === 0}
        shikokuLeft={shikokuLeft}
        onOpenMap={onOpenMap}
        t={t}
      />

      {/* 今日のおすすめAIプラン — opens the 今日のお遍路プラン screen (task 11.1) */}
      <Card className="progress-plan-teaser" blob>
        <div className="progress-plan-teaser__head">
          <span className="progress-plan-teaser__icon" aria-hidden="true">
            ✨
          </span>
          <div>
            <h3 className="progress-plan-teaser__title">
              {t("progress.plan.title")}
            </h3>
            <p className="progress-plan-teaser__lead">
              {t("progress.plan.lead")}
            </p>
          </div>
        </div>
        {onOpenPlan ? (
          <Button
            variant="primary"
            block
            leading="🗓"
            onClick={onOpenPlan}
            data-testid="open-plan"
          >
            {t("planner.title")}
          </Button>
        ) : (
          <p className="progress-plan-teaser__soon">{t("progress.plan.soon")}</p>
        )}
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 対象県 selector (Req 9.6)
// ---------------------------------------------------------------------------

interface AreaSelectorProps {
  area: ShikokuPrefecture;
  onSelect: (area: ShikokuPrefecture) => void;
  t: (key: string) => string;
}

function AreaSelector({ area, onSelect, t }: AreaSelectorProps): JSX.Element {
  return (
    <div className="progress-areas" data-testid="area-selector">
      <span className="progress-areas__label" id="progress-area-label">
        {t("progress.areaLabel")}
      </span>
      <div
        className="progress-areas__seg"
        role="group"
        aria-labelledby="progress-area-label"
      >
        {SHIKOKU_PREFECTURES.map((pref) => (
          <Button
            key={pref}
            variant={pref === area ? "primary" : "ghost"}
            size="sm"
            aria-pressed={pref === area}
            onClick={() => onSelect(pref)}
          >
            {t(PREFECTURE_NAME_KEY[pref])}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile (今日 / 今月 / 残り)
// ---------------------------------------------------------------------------

interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  testId: string;
}

function StatTile({ label, value, unit, testId }: StatTileProps): JSX.Element {
  return (
    <li className="progress-stat">
      <span className="progress-stat__value" data-testid={testId}>
        {value}
        <span className="progress-stat__unit">{unit}</span>
      </span>
      <span className="progress-stat__label">{label}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// 次の札所ナビ
// ---------------------------------------------------------------------------

interface NextTempleCardProps {
  temple: Temple | null;
  estimate: NextTempleNavEstimate | null;
  loading: boolean;
  allVisited: boolean;
  shikokuLeft: number;
  onOpenMap: () => void;
  t: (key: string) => string;
}

/** Human-readable distance from an estimated kilometer figure. */
function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Format a minute count as an hours-and-minutes duration in the active language
 * (e.g. 195 → 「約3時間15分」/ "about 3 h 15 min"). Under an hour it falls back
 * to the minutes-only label; an exact hour omits the minutes part.
 */
function formatDuration(totalMinutes: number, t: (key: string) => string): string {
  if (totalMinutes < 60) {
    return t("progress.next.minutesUnit").replace("{min}", String(totalMinutes));
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return t("progress.next.durationH").replace("{h}", String(hours));
  }
  return t("progress.next.durationHm")
    .replace("{h}", String(hours))
    .replace("{m}", String(mins));
}

function NextTempleCard({
  temple,
  estimate,
  loading,
  allVisited,
  shikokuLeft,
  onOpenMap,
  t,
}: NextTempleCardProps): JSX.Element {
  // Everything in the selected area is done — celebrate rather than navigate.
  if (allVisited) {
    return (
      <Card className="next-temple next-temple--done" blob raised>
        <h3 className="next-temple__heading">{t("progress.next.title")}</h3>
        <p className="next-temple__congrats" data-testid="next-temple-done">
          {t("progress.next.allDone")}
        </p>
        {shikokuLeft > 0 && (
          <p className="next-temple__more">
            {t("progress.next.shikokuLeft").replace(
              "{count}",
              String(shikokuLeft),
            )}
          </p>
        )}
      </Card>
    );
  }

  // No temple data for the selected area yet (e.g. a non-Ehime prefecture).
  if (!temple) {
    return (
      <Card className="next-temple next-temple--empty" blob>
        <h3 className="next-temple__heading">{t("progress.next.title")}</h3>
        <p className="next-temple__empty" data-testid="next-temple-empty">
          {t("progress.next.empty")}
        </p>
      </Card>
    );
  }

  // All figures below are AI/heuristic estimates surfaced with a disclaimer.
  const distance =
    estimate?.distanceKm != null ? formatKm(estimate.distanceKm) : "—";
  const carMin = estimate?.carMinutes ?? null;
  const walkMin = estimate?.walkMinutes ?? null;
  // Prefer the AI-provided real address; fall back to the temple's own address
  // with any development-only "（モックデータ）" marker stripped.
  const address =
    estimate?.address && estimate.address.trim() !== ""
      ? estimate.address
      : cleanTempleAddress(temple.address);
  // Prefer AI-provided highlights; fall back to the temple's own list.
  const highlights =
    estimate?.highlights && estimate.highlights.length > 0
      ? estimate.highlights
      : temple.highlights;

  return (
    <Card className="next-temple" data-testid="next-temple" blob raised>
      <div className="next-temple__head">
        <h3 className="next-temple__heading">{t("progress.next.title")}</h3>
        <span className="next-temple__badge" aria-hidden="true">
          {temple.number}
        </span>
      </div>

      <p className="next-temple__name">
        <span className="next-temple__no">
          {t("map.detail.number")} {temple.number}
        </span>
        {temple.name}
      </p>
      {address && <p className="next-temple__address">{address}</p>}

      <dl className="next-temple__facts">
        <div className="next-temple__fact">
          <dt>{t("map.detail.distance")}</dt>
          <dd data-testid="next-temple-distance">
            {loading ? t("progress.next.estimating") : distance}
          </dd>
        </div>
        {carMin != null && (
          <div className="next-temple__fact">
            <dt>{t("map.detail.carTime")}</dt>
            <dd>{formatDuration(carMin, t)}</dd>
          </div>
        )}
        {walkMin != null && (
          <div className="next-temple__fact">
            <dt>{t("map.detail.walkTime")}</dt>
            <dd>{formatDuration(walkMin, t)}</dd>
          </div>
        )}
      </dl>

      {highlights.length > 0 && (
        <div className="next-temple__highlights">
          <span className="next-temple__highlights-label">
            {t("progress.next.highlights")}
          </span>
          <div className="next-temple__tags">
            {highlights.map((h) => (
              <Tag key={h} tone="teal">
                {h}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* AI-provided access / advice note (目安/参考情報). */}
      {estimate?.note && (
        <p className="next-temple__note" data-testid="next-temple-note">
          {estimate.note}
        </p>
      )}

      {/* Disclaimer: these figures are an AI estimate for reference only. */}
      <p className="next-temple__disclaimer" role="note">
        {t("progress.next.aiNote")}
      </p>

      <Button variant="accent" block leading="🧭" onClick={onOpenMap}>
        {t("progress.next.route")}
      </Button>
    </Card>
  );
}
