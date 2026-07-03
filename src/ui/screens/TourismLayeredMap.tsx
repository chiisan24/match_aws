/**
 * TourismLayeredMap — the 通常観光モード 重ねるマップ.
 *
 * Mirrors the お遍路 {@link LayeredMap} but for sightseeing: it overlays spot
 * categories (観光 / グルメ / 温泉 / おみやげ) and facilities (トイレ / 駐車場 /
 * 休憩所) on one map, plus — the key idea — a set of **swipe-driven user layers**
 * built from the {@link useTourism} store: お気に入り♥ / しおり🔖 / 後で見る🕓.
 * Swiping a spot in the deck adds it to those collections, and because this
 * screen subscribes to the same store, the pins appear on the map immediately.
 *
 * Layer toggles overlay/remove each layer independently (several at once), and
 * the displayed pins are computed with the pure {@link filterByLayers} helper,
 * so what's on the map is exactly the features whose layer is active
 * (Property 25). Purpose presets activate a sensible combination.
 *
 * The {@link MapLocationPort} is injected as a prop (for 現在地) so the screen
 * stays testable; spots come from the curated {@link EHIME_SPOTS} catalogue.
 */

import { useEffect, useMemo, useState } from "react";

import { EHIME_SPOTS, buildTourismLayerFeatures } from "../../adapters/mock";
import { filterByLayers } from "../../domain/layers";
import { haversineDistanceMeters } from "../../domain/geofence";
import type { GeoPoint, LayerKind, MapFeature } from "../../domain/types";
import type { MapLocationPort } from "../../ports";
import { useTourism } from "../../app/TourismContext";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MapCanvas } from "../components/MapCanvas";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";

export interface TourismLayeredMapProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
}

interface LayerMeta {
  key: LayerKind;
  labelKey: string;
  emoji: string;
}

/** スポット系レイヤー（カテゴリ）。 */
const SPOT_LAYERS: LayerMeta[] = [
  { key: "sightseeing", labelKey: "tlmap.layer.sightseeing", emoji: "📸" },
  { key: "food", labelKey: "tlmap.layer.food", emoji: "🍽️" },
  { key: "onsen", labelKey: "tlmap.layer.onsen", emoji: "♨️" },
  { key: "souvenir", labelKey: "tlmap.layer.souvenir", emoji: "🎁" },
];

/** 施設レイヤー。 */
const FACILITY_LAYERS: LayerMeta[] = [
  { key: "restroom", labelKey: "tlmap.layer.restroom", emoji: "🚻" },
  { key: "parking", labelKey: "tlmap.layer.parking", emoji: "🅿️" },
  { key: "rest_area", labelKey: "tlmap.layer.rest_area", emoji: "🛣️" },
];

/** ★あなたのレイヤー（スワイプ連動）。 */
const USER_LAYERS: LayerMeta[] = [
  { key: "favorite", labelKey: "tlmap.layer.favorite", emoji: "♥" },
  { key: "shiori", labelKey: "tlmap.layer.shiori", emoji: "🔖" },
  { key: "later", labelKey: "tlmap.layer.later", emoji: "🕓" },
];

const ALL_LAYERS: LayerMeta[] = [...SPOT_LAYERS, ...FACILITY_LAYERS, ...USER_LAYERS];
const LAYER_ORDER: LayerKind[] = ALL_LAYERS.map((l) => l.key);

interface PurposePreset {
  id: string;
  labelKey: string;
  layers: LayerKind[];
}

const PURPOSE_PRESETS: PurposePreset[] = [
  { id: "standard", labelKey: "tlmap.purpose.standard", layers: ["sightseeing", "restroom", "parking"] },
  { id: "gourmet", labelKey: "tlmap.purpose.gourmet", layers: ["food", "onsen", "rest_area"] },
  { id: "mine", labelKey: "tlmap.purpose.mine", layers: ["favorite", "shiori", "restroom"] },
];

/** 既定で見えるレイヤー。 */
const DEFAULT_ACTIVE: LayerKind[] = ["sightseeing", "restroom", "favorite"];

const CANDIDATE_RADIUS_METERS = 6_000;
const MAX_CANDIDATES = 3;

interface TouringCandidate {
  anchor: MapFeature;
  companions: MapFeature[];
}

/**
 * Cross-attribute 周遊候補: anchor on the primary active layer (お気に入りが有効
 * ならそれを優先、なければ先頭の有効レイヤー) and gather the nearest feature from
 * every other active layer within {@link CANDIDATE_RADIUS_METERS}. Pure helper.
 */
function buildTouringCandidates(
  active: MapFeature[],
  activeLayers: LayerKind[],
): TouringCandidate[] {
  if (activeLayers.length < 2) return [];
  const primary = activeLayers.includes("favorite") ? "favorite" : activeLayers[0];
  const otherLayers = activeLayers.filter((l) => l !== primary);
  const anchors = active.filter((f) => f.layer === primary);

  const scored: { c: TouringCandidate; score: number }[] = [];
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
    if (companions.length > 0) scored.push({ c: { anchor, companions }, score });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_CANDIDATES)
    .map((e) => e.c);
}

export function TourismLayeredMap({ map }: TourismLayeredMapProps): JSX.Element {
  const { t } = useI18n();
  const { favorites, shiori, later } = useTourism();

  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeSet, setActiveSet] = useState<Set<LayerKind>>(
    () => new Set<LayerKind>(DEFAULT_ACTIVE),
  );
  const [activePurpose, setActivePurpose] = useState<string | null>(null);

  // Current location for bounds + "you are here" (mock by default — Req 8.5).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const loc = await map.getCurrentLocation();
        if (!cancelled) setCurrent(loc);
      } catch {
        if (!cancelled) setCurrent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map]);

  // All features across every layer — spots + facilities + swipe-driven lists.
  const allFeatures = useMemo<MapFeature[]>(
    () => buildTourismLayerFeatures(EHIME_SPOTS, { favorites, shiori, later }),
    [favorites, shiori, later],
  );

  const activeLayers = useMemo<LayerKind[]>(
    () => LAYER_ORDER.filter((k) => activeSet.has(k)),
    [activeSet],
  );

  const visibleFeatures = useMemo<MapFeature[]>(
    () => filterByLayers(allFeatures, activeLayers),
    [allFeatures, activeLayers],
  );

  const boundsPoints = useMemo<GeoPoint[]>(() => {
    const points: GeoPoint[] = allFeatures.map((f) => f.location);
    if (current) points.push(current);
    return points;
  }, [allFeatures, current]);

  const candidates = useMemo<TouringCandidate[]>(
    () => buildTouringCandidates(visibleFeatures, activeLayers),
    [visibleFeatures, activeLayers],
  );

  const countByLayer = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const f of allFeatures) out[f.layer] = (out[f.layer] ?? 0) + 1;
    return out;
  }, [allFeatures]);

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
    setActiveSet(turningOff ? new Set(DEFAULT_ACTIVE) : new Set(preset.layers));
  };

  return (
    <section className="layered-map" aria-labelledby="tourism-layered-map-heading">
      <SectionHeader
        eyebrow="EHIME LAYERS"
        title={<span id="tourism-layered-map-heading">{t("tlmap.title")}</span>}
      />
      <p className="layered-map__lead">{t("tlmap.lead")}</p>

      <div className="layered-map__legend" data-testid="tourism-layer-legend">
        <LayerGroup legend={t("tlmap.group.spots")} layers={SPOT_LAYERS} activeSet={activeSet} countByLayer={countByLayer} onToggle={toggleLayer} t={t} />
        <LayerGroup legend={t("tlmap.group.facility")} layers={FACILITY_LAYERS} activeSet={activeSet} countByLayer={countByLayer} onToggle={toggleLayer} t={t} />
        <LayerGroup legend={t("tlmap.group.yours")} layers={USER_LAYERS} activeSet={activeSet} countByLayer={countByLayer} onToggle={toggleLayer} t={t} note={t("tlmap.group.yoursTag")} />
      </div>

      <div className="layered-map__purposes" data-testid="tourism-purpose-presets">
        <p className="layered-map__purposes-label">{t("tlmap.purpose.label")}</p>
        <div className="layered-map__purpose-row" role="group" aria-label={t("tlmap.purpose.label")}>
          {PURPOSE_PRESETS.map((preset) => {
            const active = preset.id === activePurpose;
            return (
              <Button key={preset.id} variant={active ? "primary" : "ghost"} size="sm" aria-pressed={active} onClick={() => applyPurpose(preset)}>
                {t(preset.labelKey)}
              </Button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="layered-map__status" role="status">{t("tlmap.loading")}</p>
      ) : (
        <>
          <p className="layered-map__count" role="status">
            {t("tlmap.countShown").replace("{count}", String(visibleFeatures.length))}
          </p>

          <MapCanvas
            className="layered-map__surface"
            testId="tourism-layered-map-surface"
            ariaLabel={t("tlmap.title")}
            items={visibleFeatures}
            boundsPoints={boundsPoints}
            current={current}
            renderCurrent={(style) => (
              <span
                className="layered-map__here"
                data-testid="current-location-marker"
                style={style}
                aria-label={t("map.youAreHere")}
                title={t("map.currentLocation")}
              />
            )}
            renderItem={(f, style) => (
              <span
                className={`layered-map__pin layered-map__pin--${f.layer}`}
                data-testid="layer-pin"
                data-layer={f.layer}
                style={style}
                title={f.label}
                aria-label={f.label}
                role="img"
              />
            )}
          >
            {visibleFeatures.length === 0 && (
              <p className="layered-map__empty">{t("tlmap.empty")}</p>
            )}
          </MapCanvas>

          <TouringCandidates candidates={candidates} t={t} />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Layer toggle group
// ---------------------------------------------------------------------------

interface LayerGroupProps {
  legend: string;
  layers: LayerMeta[];
  activeSet: Set<LayerKind>;
  countByLayer: Record<string, number>;
  onToggle: (key: LayerKind) => void;
  t: (key: string) => string;
  note?: string;
}

function LayerGroup({ legend, layers, activeSet, countByLayer, onToggle, t, note }: LayerGroupProps): JSX.Element {
  return (
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
              className={"layered-map__toggle" + (active ? " layered-map__toggle--on" : "")}
              data-testid={`layer-toggle-${layer.key}`}
              data-layer={layer.key}
            >
              <input type="checkbox" checked={active} onChange={() => onToggle(layer.key)} />
              <span className="layered-map__toggle-dot" aria-hidden="true" />
              <span className="layered-map__toggle-emoji" aria-hidden="true">{layer.emoji}</span>
              <span className="layered-map__toggle-label">{t(layer.labelKey)}</span>
              {count > 0 && (
                <span className="layered-map__toggle-count" aria-hidden="true">{count}</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Cross-attribute touring candidates
// ---------------------------------------------------------------------------

function TouringCandidates({ candidates, t }: { candidates: TouringCandidate[]; t: (k: string) => string }): JSX.Element | null {
  if (candidates.length === 0) return null;
  return (
    <section className="layered-map__candidates" data-testid="tourism-touring-candidates" aria-labelledby="tourism-touring-heading">
      <h3 id="tourism-touring-heading" className="layered-map__candidates-title">{t("tlmap.candidates.title")}</h3>
      <p className="layered-map__candidates-lead">{t("tlmap.candidates.lead")}</p>
      <ul className="layered-map__candidates-list" role="list">
        {candidates.map((cand) => (
          <li key={cand.anchor.id}>
            <Card className="touring-candidate" data-testid="touring-candidate">
              <p className="touring-candidate__anchor">{cand.anchor.label}</p>
              <div className="touring-candidate__companions">
                {cand.companions.map((c) => (
                  <Tag key={c.id} tone="teal">{c.label}</Tag>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
