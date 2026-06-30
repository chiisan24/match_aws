/**
 * TempleMap — the 札所マップ screen for the お遍路モード "map" tab (Req 8.1–8.5).
 *
 * Behaviour:
 *  - Loads the Ehime temples (No. 40–65) and a current location through the
 *    injected {@link MapLocationPort}. With no AWS configured this is the mock
 *    adapter, which returns the 26 fixed temples and a mock position near Dogo
 *    Onsen (Req 8.5) — so the screen always renders something real.
 *  - Renders every (filtered) temple as a numbered pin projected onto a simple
 *    mock map surface (Req 8.1), plus a distinct current-location marker when a
 *    position is available (Req 8.4).
 *  - Selecting a pin opens a detail panel with the temple number (>=1), name,
 *    distance from the current location, walk/car travel time (>=0), parking and
 *    restroom flags, and nearby spots/restaurants (Req 8.2).
 *  - A filter bar (車/徒歩・時間・未訪問のみ) narrows the visible temples via the
 *    pure {@link filterTemples} domain helper (Req 8.3).
 *
 * The {@link MapLocationPort} is injected as a prop so the screen stays fully
 * testable — a test passes a fake port; the app passes `gateway.map`.
 */

import { useEffect, useMemo, useState } from "react";

import { EHIME_SPOTS } from "../../adapters/mock";
import {
  filterTemples,
  type TempleFilterCriteria,
  type TempleTravelTime,
} from "../../domain/filter";
import { haversineDistanceMeters } from "../../domain/geofence";
import type { GeoPoint, LangCode, Spot, Temple } from "../../domain/types";
import type { MapLocationPort } from "../../ports";
import { useI18n, useTranslate } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MapCanvas } from "../components/MapCanvas";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";

export interface TempleMapProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
  /**
   * Temple ids recorded as visited, consulted by the 未訪問のみ filter. Defaults
   * to empty (progress wiring lands in task 10.4/10.5); an empty set means every
   * temple counts as unvisited, which keeps the filter correct.
   */
  visited?: ReadonlySet<string>;
}

/** Assumed average speeds for mock travel-time estimates. */
const CAR_METERS_PER_MIN = 600; // ~36 km/h
const WALK_METERS_PER_MIN = 75; // ~4.5 km/h

/** Time-filter presets (minutes); `0` means "no time limit". */
const TIME_OPTIONS = [0, 60, 120, 180] as const;

/** Nearby spot search radius (metres) used for the detail panel. */
const NEARBY_RADIUS_METERS = 15_000;

/**
 * Curated おすすめの巡礼ルート — recommended pilgrimage routes shown in the
 * bottom-sheet carousel (matching the mockup). Each route is a themed run of
 * Ehime札所 identified by an inclusive temple-number range; the actual member
 * temples, distance and duration are derived from the loaded temple data so the
 * cards stay correct even if the dataset changes. These are recommendations,
 * independent of the 車/徒歩/時間/未訪問 filters above.
 */
interface RouteDef {
  id: string;
  /** i18n label key for the route name. */
  nameKey: string;
  /** Inclusive [low, high] 札所 number range that defines the route. */
  range: [number, number];
}

const ROUTE_DEFS: RouteDef[] = [
  { id: "south", nameKey: "map.route.south", range: [40, 43] },
  { id: "kuma", nameKey: "map.route.kuma", range: [44, 45] },
  { id: "matsuyama", nameKey: "map.route.matsuyama", range: [46, 53] },
  { id: "toyo", nameKey: "map.route.toyo", range: [54, 65] },
];

/** A route with its resolved member temples and derived distance/time. */
interface RouteSummary {
  def: RouteDef;
  temples: Temple[];
  /** Total straight-line path length over the members, in metres. */
  meters: number;
  /** Approximate driving minutes for the whole route (>= 0). */
  carMinutes: number;
}

/** Build route summaries from the loaded temples (members within each range). */
function buildRouteSummaries(temples: Temple[]): RouteSummary[] {
  return ROUTE_DEFS.map((def) => {
    const members = temples
      .filter((tm) => tm.number >= def.range[0] && tm.number <= def.range[1])
      .sort((a, b) => a.number - b.number);
    let meters = 0;
    for (let i = 1; i < members.length; i++) {
      meters += haversineDistanceMeters(
        members[i - 1].location,
        members[i].location,
      );
    }
    return {
      def,
      temples: members,
      meters,
      carMinutes: Math.max(0, Math.round(meters / CAR_METERS_PER_MIN)),
    };
  }).filter((route) => route.temples.length > 0);
}

/** Estimate walk/car minutes from a straight-line distance (>= 0, integer). */
function estimateTravelTime(distanceMeters: number): TempleTravelTime {
  return {
    car: Math.max(0, Math.round(distanceMeters / CAR_METERS_PER_MIN)),
    walk: Math.max(0, Math.round(distanceMeters / WALK_METERS_PER_MIN)),
  };
}

/** Human-readable distance: metres under 1 km, otherwise one-decimal km. */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function TempleMap({ map, visited }: TempleMapProps): JSX.Element {
  const { t, lang } = useI18n();

  const [temples, setTemples] = useState<Temple[]>([]);
  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter state (Req 8.3).
  const [transport, setTransport] = useState<"car" | "walk">("car");
  const [maxMinutes, setMaxMinutes] = useState<number>(0); // 0 = no limit
  const [unvisitedOnly, setUnvisitedOnly] = useState(false);

  // Selected recommended route (bottom-sheet carousel); null = none highlighted.
  const [routeId, setRouteId] = useState<string | null>(null);

  // Load temples + current location through the port (mock by default, Req 8.5).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [loadedTemples, loadedLocation] = await Promise.all([
          map.getTemples("ehime"),
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map]);

  // Per-temple travel times from the current location (drives the time filter
  // and the detail panel). Empty when no location is available.
  const travelMinutes = useMemo<Record<string, TempleTravelTime>>(() => {
    if (!current) return {};
    const out: Record<string, TempleTravelTime> = {};
    for (const temple of temples) {
      const meters = haversineDistanceMeters(current, temple.location);
      out[temple.id] = estimateTravelTime(meters);
    }
    return out;
  }, [temples, current]);

  // Apply the active filters via the pure domain helper (Req 8.3 / Property 16).
  const visibleTemples = useMemo<Temple[]>(() => {
    const criteria: TempleFilterCriteria = {
      transport,
      maxMinutes: maxMinutes > 0 ? maxMinutes : undefined,
      unvisitedOnly,
      visited: visited ?? new Set<string>(),
      travelMinutes,
    };
    return filterTemples(temples, criteria);
  }, [temples, transport, maxMinutes, unvisitedOnly, visited, travelMinutes]);

  // Stable projection bounds across all temples (+ current), so pins keep a
  // stable position regardless of which subset is filtered in.
  const boundsPoints = useMemo<GeoPoint[]>(() => {
    const points: GeoPoint[] = temples.map((tm) => tm.location);
    if (current) points.push(current);
    return points;
  }, [temples, current]);

  // Clear a selection that gets filtered out so the detail panel stays honest.
  useEffect(() => {
    if (selectedId && !visibleTemples.some((tm) => tm.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visibleTemples, selectedId]);

  const selected = useMemo(
    () => visibleTemples.find((tm) => tm.id === selectedId) ?? null,
    [visibleTemples, selectedId],
  );

  // Recommended routes derived from the full temple set (Req 8 mockup carousel).
  const routes = useMemo(() => buildRouteSummaries(temples), [temples]);

  // Member temple ids of the highlighted route, used to accent their pins.
  const routeMemberIds = useMemo<ReadonlySet<string>>(() => {
    const route = routes.find((r) => r.def.id === routeId);
    return new Set(route ? route.temples.map((tm) => tm.id) : []);
  }, [routes, routeId]);

  // Drop a highlighted route that no longer exists (e.g. after a data reload).
  useEffect(() => {
    if (routeId && !routes.some((r) => r.def.id === routeId)) {
      setRouteId(null);
    }
  }, [routes, routeId]);

  return (
    <section className="temple-map" aria-labelledby="temple-map-heading">
      <SectionHeader
        eyebrow="EHIME 88"
        title={<span id="temple-map-heading">{t("map.title")}</span>}
      />
      <p className="temple-map__lead">{t("map.lead")}</p>

      <TempleMapFilters
        transport={transport}
        maxMinutes={maxMinutes}
        unvisitedOnly={unvisitedOnly}
        onTransport={setTransport}
        onMaxMinutes={setMaxMinutes}
        onUnvisitedOnly={setUnvisitedOnly}
      />

      {loading ? (
        <p className="temple-map__status" role="status">
          {t("map.loading")}
        </p>
      ) : (
        <>
          <p className="temple-map__count" role="status">
            {t("map.countShown").replace("{count}", String(visibleTemples.length))}
          </p>

          <MapCanvas
            className="temple-map__surface"
            testId="temple-map-surface"
            ariaLabel={t("map.title")}
            items={visibleTemples}
            boundsPoints={boundsPoints}
            current={current}
            renderCurrent={(style) => (
              <span
                className="temple-map__here"
                data-testid="current-location-marker"
                style={style}
                aria-label={t("map.youAreHere")}
                title={t("map.currentLocation")}
              />
            )}
            renderItem={(temple, style) => {
              const isActive = temple.id === selectedId;
              const onRoute = routeMemberIds.has(temple.id);
              return (
                <button
                  type="button"
                  className={
                    "temple-map__pin" +
                    (isActive ? " temple-map__pin--active" : "") +
                    (onRoute ? " temple-map__pin--route" : "")
                  }
                  data-testid="temple-pin"
                  style={style}
                  aria-pressed={isActive}
                  aria-label={`${temple.number} ${temple.name}`}
                  onClick={() => setSelectedId(temple.id)}
                >
                  {temple.number}
                </button>
              );
            }}
          >
            {visibleTemples.length === 0 && (
              <p className="temple-map__empty">{t("map.empty")}</p>
            )}
          </MapCanvas>

          {selected ? (
            <TempleDetail
              temple={selected}
              current={current}
              lang={lang}
              travel={travelMinutes[selected.id]}
              closeLabel={t("map.detail.close")}
              t={t}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <p className="temple-map__hint">{t("map.detail.selectHint")}</p>
          )}

          <RouteCarousel
            routes={routes}
            activeRouteId={routeId}
            onSelectRoute={(id) =>
              setRouteId((prev) => (prev === id ? null : id))
            }
            onClear={() => setRouteId(null)}
            t={t}
          />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recommended route carousel (mockup "おすすめの巡礼ルート" bottom sheet)
// ---------------------------------------------------------------------------

interface RouteCarouselProps {
  routes: RouteSummary[];
  activeRouteId: string | null;
  onSelectRoute: (id: string) => void;
  onClear: () => void;
  t: (key: string) => string;
}

/**
 * Horizontally-scrolling carousel of recommended pilgrimage routes (Req 8
 * mockup). Selecting a card accents that route's pins on the map above; tapping
 * the active card again (or 解除) clears the highlight. Cards are real buttons
 * with `aria-pressed`, so the carousel is keyboard- and screen-reader-friendly.
 */
function RouteCarousel({
  routes,
  activeRouteId,
  onSelectRoute,
  onClear,
  t,
}: RouteCarouselProps): JSX.Element | null {
  if (routes.length === 0) return null;

  const km = (meters: number): string => (meters / 1000).toFixed(1);

  return (
    <section
      className="pilgrimage-routes"
      data-testid="route-carousel"
      aria-labelledby="pilgrimage-routes-heading"
    >
      <div className="pilgrimage-routes__head">
        <h3 id="pilgrimage-routes-heading" className="pilgrimage-routes__title">
          {t("map.routes.title")}
        </h3>
        {activeRouteId && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t("map.routes.clear")}
          </Button>
        )}
      </div>
      <p className="pilgrimage-routes__lead">{t("map.routes.lead")}</p>

      <ul
        className="pilgrimage-routes__track"
        role="list"
        aria-label={t("map.routes.title")}
      >
        {routes.map((route) => {
          const isActive = route.def.id === activeRouteId;
          const first = route.temples[0];
          const last = route.temples[route.temples.length - 1];
          return (
            <li key={route.def.id} className="pilgrimage-routes__item">
              <button
                type="button"
                className={
                  "pilgrimage-route-card" +
                  (isActive ? " pilgrimage-route-card--active" : "")
                }
                data-testid="route-card"
                aria-pressed={isActive}
                onClick={() => onSelectRoute(route.def.id)}
              >
                <span className="pilgrimage-route-card__range" aria-hidden="true">
                  {first.number}–{last.number}
                </span>
                <span className="pilgrimage-route-card__name">
                  {t(route.def.nameKey)}
                </span>
                <span className="pilgrimage-route-card__meta">
                  <span>
                    {t("map.routes.templesCount").replace(
                      "{count}",
                      String(route.temples.length),
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("map.routes.distance").replace("{km}", km(route.meters))}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("map.routes.carDuration").replace(
                      "{min}",
                      String(route.carMinutes),
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface TempleMapFiltersProps {
  transport: "car" | "walk";
  maxMinutes: number;
  unvisitedOnly: boolean;
  onTransport: (mode: "car" | "walk") => void;
  onMaxMinutes: (min: number) => void;
  onUnvisitedOnly: (on: boolean) => void;
}

function TempleMapFilters({
  transport,
  maxMinutes,
  unvisitedOnly,
  onTransport,
  onMaxMinutes,
  onUnvisitedOnly,
}: TempleMapFiltersProps): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="temple-map__filters" data-testid="temple-map-filters">
      <fieldset className="temple-map__filter">
        <legend className="temple-map__filter-label">
          {t("map.filter.transport")}
        </legend>
        <div className="temple-map__seg" role="group">
          <Button
            variant={transport === "car" ? "primary" : "ghost"}
            size="sm"
            leading="🚗"
            aria-pressed={transport === "car"}
            onClick={() => onTransport("car")}
          >
            {t("map.filter.car")}
          </Button>
          <Button
            variant={transport === "walk" ? "primary" : "ghost"}
            size="sm"
            leading="🚶"
            aria-pressed={transport === "walk"}
            onClick={() => onTransport("walk")}
          >
            {t("map.filter.walk")}
          </Button>
        </div>
      </fieldset>

      <div className="temple-map__filter">
        <label className="temple-map__filter-label" htmlFor="temple-map-time">
          {t("map.filter.time")}
        </label>
        <select
          id="temple-map-time"
          className="temple-map__select"
          value={String(maxMinutes)}
          onChange={(e) => onMaxMinutes(Number(e.target.value))}
        >
          {TIME_OPTIONS.map((min) => (
            <option key={min} value={String(min)}>
              {min === 0
                ? t("map.filter.timeAny")
                : t("map.filter.withinMinutes").replace("{min}", String(min))}
            </option>
          ))}
        </select>
      </div>

      <div className="temple-map__filter temple-map__filter--check">
        <label className="temple-map__check">
          <input
            type="checkbox"
            checked={unvisitedOnly}
            onChange={(e) => onUnvisitedOnly(e.target.checked)}
          />
          <span>{t("map.filter.unvisited")}</span>
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel (Req 8.2)
// ---------------------------------------------------------------------------

interface TempleDetailProps {
  temple: Temple;
  current: GeoPoint | null;
  lang: string;
  travel?: TempleTravelTime;
  closeLabel: string;
  t: (key: string) => string;
  onClose: () => void;
}

/** Up to three nearby spots/restaurants, by straight-line distance. */
function nearbySpots(temple: Temple): Spot[] {
  return EHIME_SPOTS.map((spot) => ({
    spot,
    meters: haversineDistanceMeters(temple.location, spot.location),
  }))
    .filter((row) => row.meters <= NEARBY_RADIUS_METERS)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 3)
    .map((row) => row.spot);
}

function TempleDetail({
  temple,
  current,
  lang,
  travel,
  closeLabel,
  t,
  onClose,
}: TempleDetailProps): JSX.Element {
  const distance =
    current != null
      ? formatDistance(haversineDistanceMeters(current, temple.location))
      : "—";
  const walk = travel?.walk ?? 0;
  const car = travel?.car ?? 0;
  const minutes = (min: number): string =>
    t("map.detail.minutesUnit").replace("{min}", String(min));
  const flag = (on: boolean): string =>
    on ? t("map.detail.available") : t("map.detail.unavailable");
  const localized =
    temple.localizedDescriptions[lang as keyof typeof temple.localizedDescriptions];
  const description = localized ?? temple.localizedDescriptions.ja ?? "";
  // The active language has no authored description and we fell back to
  // Japanese — offer on-demand content translation via the TranslatePort
  // (Req 19.2). Falls back to original text when the backend is unwired/fails.
  const canTranslate =
    lang !== "ja" && (localized === undefined || localized === "") && description !== "";
  const nearby = nearbySpots(temple);

  return (
    <Card className="temple-detail" data-testid="temple-detail" blob raised>
      <div className="temple-detail__head">
        <span className="temple-detail__badge" aria-hidden="true">
          {temple.number}
        </span>
        <div className="temple-detail__title">
          <p className="temple-detail__no">
            {t("map.detail.number")} {temple.number}
          </p>
          <h3 className="temple-detail__name">{temple.name}</h3>
          <p className="temple-detail__address">{temple.address}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>

      {description && (
        <TempleDescription
          key={`${temple.id}:${lang}`}
          original={description}
          targetLang={lang as LangCode}
          canTranslate={canTranslate}
          t={t}
        />
      )}

      <dl className="temple-detail__facts">
        <div className="temple-detail__fact">
          <dt>{t("map.detail.distance")}</dt>
          <dd data-testid="temple-detail-distance">{distance}</dd>
        </div>
        <div className="temple-detail__fact">
          <dt>{t("map.detail.walkTime")}</dt>
          <dd data-testid="temple-detail-walk">{minutes(walk)}</dd>
        </div>
        <div className="temple-detail__fact">
          <dt>{t("map.detail.carTime")}</dt>
          <dd data-testid="temple-detail-car">{minutes(car)}</dd>
        </div>
      </dl>

      <div className="temple-detail__tags">
        <Tag tone={temple.parking ? "moss" : "outline"} leading="🅿️">
          {t("map.detail.parking")}：{flag(temple.parking)}
        </Tag>
        <Tag tone={temple.restrooms ? "moss" : "outline"} leading="🚻">
          {t("map.detail.restrooms")}：{flag(temple.restrooms)}
        </Tag>
      </div>

      <div className="temple-detail__nearby">
        <h4 className="temple-detail__nearby-title">{t("map.detail.nearby")}</h4>
        {nearby.length > 0 ? (
          <ul className="temple-detail__nearby-list">
            {nearby.map((spot) => (
              <li key={spot.id} className="temple-detail__nearby-item">
                <span className="temple-detail__nearby-name">{spot.name}</span>
                <Tag tone="teal">{spot.category}</Tag>
              </li>
            ))}
          </ul>
        ) : (
          <p className="temple-detail__nearby-empty">{t("map.detail.noNearby")}</p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Translatable temple description (Req 19.2, 19.3)
// ---------------------------------------------------------------------------

interface TempleDescriptionProps {
  /** The description text shown by default (already Japanese-fallback resolved). */
  original: string;
  /** Language to translate the content into (the active display language). */
  targetLang: LangCode;
  /**
   * Whether a "翻訳" affordance should be offered — true when the active
   * language has no authored description so we fell back to Japanese.
   */
  canTranslate: boolean;
  t: (key: string) => string;
}

/**
 * Renders a temple description with an optional on-demand translation control
 * (Req 19.2). When the active language has no authored description we show the
 * Japanese text plus a 翻訳 button; tapping it routes the original text through
 * the injected TranslatePort via {@link useTranslate}. With no AWS backend
 * configured the mock adapter returns a canned translation or the original text
 * (Req 19.3) and the call never throws, so the panel degrades gracefully.
 */
function TempleDescription({
  original,
  targetLang,
  canTranslate,
  t,
}: TempleDescriptionProps): JSX.Element {
  const translateContent = useTranslate();
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const onTranslate = async (): Promise<void> => {
    setBusy(true);
    try {
      // translateContent never throws — it falls back to the original text when
      // the backend is unwired or fails (Req 19.3).
      const result = await translateContent(original, targetLang);
      setTranslated(result);
      setShowOriginal(false);
    } finally {
      setBusy(false);
    }
  };

  const displayed = translated !== null && !showOriginal ? translated : original;
  const isFallback = translated !== null && translated.trim() === original.trim();

  return (
    <div className="temple-detail__desc-block">
      <p className="temple-detail__desc" data-testid="temple-detail-desc">
        {displayed}
      </p>
      {canTranslate && (
        <div className="temple-detail__translate">
          {translated === null ? (
            <Button
              variant="ghost"
              size="sm"
              leading="🌐"
              disabled={busy}
              data-testid="temple-translate-button"
              onClick={() => void onTranslate()}
            >
              {busy ? t("map.detail.translating") : t("map.detail.translate")}
            </Button>
          ) : (
            <div className="temple-detail__translate-done">
              <span className="temple-detail__translate-note">
                {isFallback
                  ? t("map.detail.translateUnavailable")
                  : t("map.detail.translated")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOriginal((prev) => !prev)}
              >
                {showOriginal
                  ? t("map.detail.showTranslation")
                  : t("map.detail.showOriginal")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
