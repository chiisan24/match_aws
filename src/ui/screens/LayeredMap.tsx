/**
 * LayeredMap — the 重ねるマップ（情報レイヤー）screen for the お遍路モード
 * "map" tab (Req 14.1–14.6).
 *
 * Behaviour:
 *  - Loads the Ehime temples + current location through the injected
 *    {@link MapLocationPort} (mock by default, Req 8.5) and derives the full
 *    feature set for every layer via the pure {@link buildLayerFeatures}
 *    (temples → お遍路 / トイレ pins; mock points → 休憩所 / サイクリング /
 *    グルメ / 防災).
 *  - Layer toggles let the user overlay (Req 14.1) and remove (Req 14.2) each
 *    layer; several layers can be active at once (Req 14.3). The displayed pins
 *    are computed with the pure {@link filterByLayers} domain helper, so what's
 *    on the map is *exactly* the features whose layer is active — Property 25.
 *  - Purpose presets activate a sensible layer combination and surface
 *    cross-attribute 周遊候補 (Req 14.4 — a simple post-MVP version).
 *  - When the 防災 layer is active, hazard areas are drawn as zones on the map
 *    (Req 14.5).
 *  - The basic MVP layers (お遍路 / トイレ / 休憩所) are presented prominently;
 *    サイクリング / グルメ / 防災 are clearly marked 後続フェーズ while staying
 *    functional with mock data (Req 14.6).
 *
 * The {@link MapLocationPort} is injected as a prop so the screen stays fully
 * testable — tests pass a fake port; the app passes `gateway.map`.
 */

import { useEffect, useMemo, useState } from "react";

import { buildLayerFeatures } from "../../adapters/mock";
import { filterByLayers } from "../../domain/layers";
import { haversineDistanceMeters } from "../../domain/geofence";
import type { GeoPoint, LayerKind, MapFeature, Temple } from "../../domain/types";
import type { MapLocationPort } from "../../ports";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";

export interface LayeredMapProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
}

/** Static metadata describing how each layer is labelled and styled. */
interface LayerMeta {
  key: LayerKind;
  labelKey: string;
  emoji: string;
  /** Hazard layers render a zone behind the pin (Req 14.5). */
  hazard?: boolean;
}

/** Basic MVP layers, shown first and prominently (Req 14.6). */
const BASIC_LAYERS: LayerMeta[] = [
  { key: "ohenro", labelKey: "lmap.layer.ohenro", emoji: "🛕" },
  { key: "restroom", labelKey: "lmap.layer.restroom", emoji: "🚻" },
  { key: "rest_area", labelKey: "lmap.layer.rest_area", emoji: "🅿️" },
];

/** 後続フェーズ (post-MVP) layers — functional here with mock data (Req 14.6). */
const POST_MVP_LAYERS: LayerMeta[] = [
  { key: "cycling", labelKey: "lmap.layer.cycling", emoji: "🚴" },
  { key: "gourmet", labelKey: "lmap.layer.gourmet", emoji: "🍊" },
  { key: "disaster", labelKey: "lmap.layer.disaster", emoji: "⚠️", hazard: true },
];

const ALL_LAYERS: LayerMeta[] = [...BASIC_LAYERS, ...POST_MVP_LAYERS];
const HAZARD_LAYERS = new Set<LayerKind>(
  ALL_LAYERS.filter((l) => l.hazard).map((l) => l.key),
);

/** Stable layer ordering used when handing the active set to filterByLayers. */
const LAYER_ORDER: LayerKind[] = ALL_LAYERS.map((l) => l.key);

/** Purpose presets that activate a cross-attribute layer combination (Req 14.4). */
interface PurposePreset {
  id: string;
  labelKey: string;
  layers: LayerKind[];
}

const PURPOSE_PRESETS: PurposePreset[] = [
  {
    id: "pilgrimage-basics",
    labelKey: "lmap.purpose.basics",
    layers: ["ohenro", "restroom", "rest_area"],
  },
  {
    id: "cycling-gourmet",
    labelKey: "lmap.purpose.cyclingGourmet",
    layers: ["cycling", "gourmet", "rest_area"],
  },
  {
    id: "safe-pilgrimage",
    labelKey: "lmap.purpose.safe",
    layers: ["ohenro", "restroom", "disaster"],
  },
];

/** Radius (m) within which features of different layers form a 周遊候補. */
const CANDIDATE_RADIUS_METERS = 6_000;
/** Max number of cross-attribute touring candidates surfaced (Req 14.4). */
const MAX_CANDIDATES = 3;

/** A pin's projected position as percentages within the map surface. */
interface Projection {
  xPct: number;
  yPct: number;
}

/**
 * Projects geo coordinates onto a 0–100% box derived from the supplied points
 * (with padding so pins never sit on the edge). North maps to the top.
 * Degenerate (single-point) spans collapse to centre.
 */
function buildProjector(points: GeoPoint[]): (p: GeoPoint) => Projection {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const pad = 10; // percent inset on each side

  const scale = (value: number, min: number, span: number): number => {
    if (span === 0) return 50;
    return pad + ((value - min) / span) * (100 - pad * 2);
  };

  return (p: GeoPoint): Projection => ({
    xPct: scale(p.lng, minLng, lngSpan),
    // Invert latitude so north is at the top of the surface.
    yPct: 100 - scale(p.lat, minLat, latSpan),
  });
}

/** Inline style placing an absolutely-positioned element at a projection. */
function positionStyle(p: Projection): React.CSSProperties {
  return { left: `${p.xPct}%`, top: `${p.yPct}%` };
}

/** A cross-attribute touring candidate: an anchor plus nearby companions. */
interface TouringCandidate {
  anchor: MapFeature;
  companions: MapFeature[];
}

/**
 * Build up to {@link MAX_CANDIDATES} cross-attribute 周遊候補 from the active
 * features (Req 14.4 — simple version). Each candidate anchors on a feature
 * from the primary active layer (お遍路 if active, else the first active layer)
 * and gathers the nearest feature from every *other* active layer within
 * {@link CANDIDATE_RADIUS_METERS}. Only anchors with at least one cross-layer
 * companion are kept, sorted by total proximity. Pure helper.
 */
function buildTouringCandidates(
  active: MapFeature[],
  activeLayers: LayerKind[],
): TouringCandidate[] {
  if (activeLayers.length < 2) return [];

  const primary = activeLayers.includes("ohenro") ? "ohenro" : activeLayers[0];
  const otherLayers = activeLayers.filter((l) => l !== primary);
  const anchors = active.filter((f) => f.layer === primary);

  const candidates: { c: TouringCandidate; score: number }[] = [];
  for (const anchor of anchors) {
    const companions: MapFeature[] = [];
    let score = 0;
    for (const layer of otherLayers) {
      let nearest: MapFeature | null = null;
      let nearestM = Infinity;
      for (const f of active) {
        if (f.layer !== layer) continue;
        const m = haversineDistanceMeters(anchor.location, f.location);
        if (m < nearestM) {
          nearestM = m;
          nearest = f;
        }
      }
      if (nearest && nearestM <= CANDIDATE_RADIUS_METERS) {
        companions.push(nearest);
        score += nearestM;
      }
    }
    if (companions.length > 0) {
      candidates.push({ c: { anchor, companions }, score });
    }
  }

  return candidates
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_CANDIDATES)
    .map((entry) => entry.c);
}

export function LayeredMap({ map }: LayeredMapProps): JSX.Element {
  const { t } = useI18n();

  const [temples, setTemples] = useState<Temple[]>([]);
  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);

  // Active layers — default to the basic MVP layers being visible (Req 14.6).
  const [activeSet, setActiveSet] = useState<Set<LayerKind>>(
    () => new Set<LayerKind>(["ohenro", "restroom", "rest_area"]),
  );
  const [activePurpose, setActivePurpose] = useState<string | null>(null);

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

  // All features across every layer, derived from the loaded temples + mocks.
  const allFeatures = useMemo<MapFeature[]>(
    () => buildLayerFeatures(temples),
    [temples],
  );

  // Active layers in stable order, for filterByLayers + candidate building.
  const activeLayers = useMemo<LayerKind[]>(
    () => LAYER_ORDER.filter((k) => activeSet.has(k)),
    [activeSet],
  );

  // The exact set of features to render = filterByLayers(all, active).
  // Drives Property 25 (重畳の厳密一致).
  const visibleFeatures = useMemo<MapFeature[]>(
    () => filterByLayers(allFeatures, activeLayers),
    [allFeatures, activeLayers],
  );

  // Projection spans every feature (+ current) so pins keep a stable position
  // regardless of which layers are toggled on.
  const project = useMemo(() => {
    const points: GeoPoint[] = allFeatures.map((f) => f.location);
    if (current) points.push(current);
    if (points.length === 0) return null;
    return buildProjector(points);
  }, [allFeatures, current]);

  // Cross-attribute touring candidates for the active layer set (Req 14.4).
  const candidates = useMemo<TouringCandidate[]>(
    () => buildTouringCandidates(visibleFeatures, activeLayers),
    [visibleFeatures, activeLayers],
  );

  const toggleLayer = (key: LayerKind): void => {
    setActivePurpose(null);
    setActiveSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPurpose = (preset: PurposePreset): void => {
    const turningOff = activePurpose === preset.id;
    setActivePurpose(turningOff ? null : preset.id);
    // Toggling a purpose off clears to the basic layers; on sets exactly it.
    setActiveSet(
      turningOff
        ? new Set<LayerKind>(["ohenro", "restroom", "rest_area"])
        : new Set<LayerKind>(preset.layers),
    );
  };

  // Count visible features per active layer for the legend badges.
  const countByLayer = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const f of visibleFeatures) out[f.layer] = (out[f.layer] ?? 0) + 1;
    return out;
  }, [visibleFeatures]);

  return (
    <section className="layered-map" aria-labelledby="layered-map-heading">
      <SectionHeader
        eyebrow="SHIKOKU LAYERS"
        title={<span id="layered-map-heading">{t("lmap.title")}</span>}
      />
      <p className="layered-map__lead">{t("lmap.lead")}</p>

      <LayerToggles
        basic={BASIC_LAYERS}
        postMvp={POST_MVP_LAYERS}
        activeSet={activeSet}
        countByLayer={countByLayer}
        onToggle={toggleLayer}
        t={t}
      />

      <PurposePresets
        presets={PURPOSE_PRESETS}
        activePurpose={activePurpose}
        onApply={applyPurpose}
        t={t}
      />

      {loading ? (
        <p className="layered-map__status" role="status">
          {t("lmap.loading")}
        </p>
      ) : (
        <>
          <p className="layered-map__count" role="status">
            {t("lmap.countShown").replace(
              "{count}",
              String(visibleFeatures.length),
            )}
          </p>

          <div
            className="layered-map__surface"
            data-testid="layered-map-surface"
            role="group"
            aria-label={t("lmap.title")}
          >
            {/* Current location marker. */}
            {current && project && (
              <span
                className="layered-map__here"
                data-testid="current-location-marker"
                style={positionStyle(project(current))}
                aria-label={t("map.youAreHere")}
                title={t("map.currentLocation")}
              />
            )}

            {/* Hazard zones drawn behind the pins (Req 14.5). */}
            {project &&
              visibleFeatures
                .filter((f) => HAZARD_LAYERS.has(f.layer))
                .map((f) => (
                  <span
                    key={`zone-${f.id}`}
                    className="layered-map__zone"
                    data-testid="hazard-zone"
                    style={positionStyle(project(f.location))}
                    aria-hidden="true"
                  />
                ))}

            {/* Layer feature pins — exactly filterByLayers(all, active). */}
            {project &&
              visibleFeatures.map((f) => (
                <span
                  key={f.id}
                  className={`layered-map__pin layered-map__pin--${f.layer}`}
                  data-testid="layer-pin"
                  data-layer={f.layer}
                  style={positionStyle(project(f.location))}
                  title={f.label}
                  aria-label={f.label}
                  role="img"
                />
              ))}

            {visibleFeatures.length === 0 && (
              <p className="layered-map__empty">{t("lmap.empty")}</p>
            )}
          </div>

          <p className="layered-map__phase-note">{t("lmap.phaseNote")}</p>

          <TouringCandidates candidates={candidates} t={t} />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Layer toggle bar (Req 14.1, 14.2, 14.3, 14.6)
// ---------------------------------------------------------------------------

interface LayerTogglesProps {
  basic: LayerMeta[];
  postMvp: LayerMeta[];
  activeSet: Set<LayerKind>;
  countByLayer: Record<string, number>;
  onToggle: (key: LayerKind) => void;
  t: (key: string) => string;
}

function LayerToggles({
  basic,
  postMvp,
  activeSet,
  countByLayer,
  onToggle,
  t,
}: LayerTogglesProps): JSX.Element {
  const renderGroup = (
    layers: LayerMeta[],
    legend: string,
    note?: string,
  ): JSX.Element => (
    <fieldset className="layered-map__group">
      <legend className="layered-map__group-legend">
        {legend}
        {note && <span className="layered-map__phase-tag">{note}</span>}
      </legend>
      <div className="layered-map__toggles">
        {layers.map((layer) => {
          const active = activeSet.has(layer.key);
          const count = countByLayer[layer.key] ?? 0;
          return (
            <label
              key={layer.key}
              className={
                "layered-map__toggle" +
                (active ? " layered-map__toggle--on" : "")
              }
              data-testid={`layer-toggle-${layer.key}`}
              data-layer={layer.key}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(layer.key)}
              />
              <span className="layered-map__toggle-dot" aria-hidden="true" />
              <span className="layered-map__toggle-emoji" aria-hidden="true">
                {layer.emoji}
              </span>
              <span className="layered-map__toggle-label">
                {t(layer.labelKey)}
              </span>
              {active && count > 0 && (
                <span className="layered-map__toggle-count" aria-hidden="true">
                  {count}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="layered-map__legend" data-testid="layer-legend">
      {renderGroup(basic, t("lmap.group.basic"))}
      {renderGroup(postMvp, t("lmap.group.postMvp"), t("lmap.phaseLabel"))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Purpose presets — cross-attribute touring (Req 14.4)
// ---------------------------------------------------------------------------

interface PurposePresetsProps {
  presets: PurposePreset[];
  activePurpose: string | null;
  onApply: (preset: PurposePreset) => void;
  t: (key: string) => string;
}

function PurposePresets({
  presets,
  activePurpose,
  onApply,
  t,
}: PurposePresetsProps): JSX.Element {
  return (
    <div className="layered-map__purposes" data-testid="purpose-presets">
      <p className="layered-map__purposes-label">{t("lmap.purpose.label")}</p>
      <div className="layered-map__purpose-row" role="group" aria-label={t("lmap.purpose.label")}>
        {presets.map((preset) => {
          const active = preset.id === activePurpose;
          return (
            <Button
              key={preset.id}
              variant={active ? "primary" : "ghost"}
              size="sm"
              aria-pressed={active}
              onClick={() => onApply(preset)}
            >
              {t(preset.labelKey)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cross-attribute touring candidates (Req 14.4)
// ---------------------------------------------------------------------------

interface TouringCandidatesProps {
  candidates: TouringCandidate[];
  t: (key: string) => string;
}

function TouringCandidates({
  candidates,
  t,
}: TouringCandidatesProps): JSX.Element | null {
  if (candidates.length === 0) return null;

  return (
    <section
      className="layered-map__candidates"
      data-testid="touring-candidates"
      aria-labelledby="touring-candidates-heading"
    >
      <h3
        id="touring-candidates-heading"
        className="layered-map__candidates-title"
      >
        {t("lmap.candidates.title")}
      </h3>
      <p className="layered-map__candidates-lead">{t("lmap.candidates.lead")}</p>
      <ul className="layered-map__candidates-list" role="list">
        {candidates.map((cand) => (
          <li key={cand.anchor.id}>
            <Card className="touring-candidate" data-testid="touring-candidate">
              <p className="touring-candidate__anchor">{cand.anchor.label}</p>
              <div className="touring-candidate__companions">
                {cand.companions.map((c) => (
                  <Tag key={c.id} tone="teal">
                    {c.label}
                  </Tag>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
