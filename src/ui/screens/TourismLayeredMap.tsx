/**
 * TourismLayeredMap — the 通常観光モード 重ねるマップ.
 *
 * Mirrors the お遍路 {@link LayeredMap} but for sightseeing: it overlays spot
 * categories (観光 / グルメ / 温泉 / おみやげ) and facilities (トイレ / 駐車場 /
 * 休憩所) on one map, plus — the key idea — a set of **swipe-driven user layers**
 * built from the {@link useTourism} store: お気に入り♥ / しおり🔖.
 * Swiping a spot in the deck adds it to those collections, and because this
 * screen subscribes to the same store, the pins appear on the map immediately.
 *
 * Layer toggles overlay/remove each layer independently (several at once), and
 * the displayed pins are computed with the pure {@link filterByLayers} helper,
 * so what's on the map is exactly the features whose layer is active
 * (Property 25). Purpose presets activate a sensible combination.
 *
 * The {@link MapLocationPort} is injected as a prop (for 現在地) so the screen
 * stays testable; spots come from the {@link useSpots} store (seeded from the
 * real EHIME_SPOTS catalogue, growable at runtime via the add-spot form).
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { awsEnv } from "../../config/env";
import { buildTourismLayerFeatures } from "../../adapters/mock";
import { filterByLayers } from "../../domain/layers";
import { haversineDistanceMeters } from "../../domain/geofence";
import { googleMapsUrl, googleMapsUrlForPlaceId } from "../../domain/googleMapsUrl";
import { useOptionalDiscovery } from "../../app/DiscoveryContext";
import type {
  GeoArea,
  GeoPoint,
  LayerKind,
  MapFeature,
  RecommendedPlace,
  Spot,
} from "../../domain/types";
import type { MapLocationPort } from "../../ports";
import { useTourism } from "../../app/TourismContext";
import { useSpots, type NewSpotInput } from "../../app/SpotContext";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { GoogleTourismMap } from "../components/GoogleTourismMap";
import { MapCanvas } from "../components/MapCanvas";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";

export interface TourismLayeredMapProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
}

type TourismMapFeature = MapFeature & {
  place?: RecommendedPlace;
  description?: string;
  order?: number;
};

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
const PLAN_AREA_RADIUS_METERS = 5_000;
const MAX_CANDIDATES = 3;

/**
 * Places results for catalogue-only pins, memoised for the session by feature id.
 *
 * Module scope rather than component state so it survives the screen unmounting
 * on a tab switch — the tab bar is right there, and coming back to the map used
 * to re-bill every pin the user reopened. `null` means "looked up, Places has
 * nothing", which is worth keeping for exactly the same reason.
 */
const placeLookupCache = new Map<string, RecommendedPlace | null>();

function boundsPointsForArea(area: GeoArea): GeoPoint[] {
  const latDelta = area.radiusMeters / 111_320;
  const lngScale = Math.max(0.2, Math.cos(area.center.lat * Math.PI / 180));
  const lngDelta = area.radiusMeters / (111_320 * lngScale);
  return [
    { lat: area.center.lat - latDelta, lng: area.center.lng - lngDelta },
    { lat: area.center.lat + latDelta, lng: area.center.lng + lngDelta },
  ];
}

/** Rough travel-time estimates (metres per minute) for the access box. */
const CAR_METERS_PER_MIN = 500; // ~30 km/h
const WALK_METERS_PER_MIN = 80; // ~4.8 km/h

/** Human-readable distance: metres under 1 km, otherwise one-decimal km. */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

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
  const { t, lang } = useI18n();
  const { activePlan, favorites, shiori } = useTourism();
  const { spots, addSpot } = useSpots();
  // Optional: the 発見 photo cache also holds each spot's Place ID, which is
  // enough to build a Google マップ link and skip a billed lookup entirely. The
  // screen works without the provider — it just pays for the lookup.
  const discovery = useOptionalDiscovery();

  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeSet, setActiveSet] = useState<Set<LayerKind>>(
    () => new Set<LayerKind>(DEFAULT_ACTIVE),
  );
  const [activePurpose, setActivePurpose] = useState<string | null>(null);
  // The feature whose detail panel is open (null = none).
  const [selected, setSelected] = useState<TourismMapFeature | null>(null);
  const [lookedUpPlace, setLookedUpPlace] = useState<RecommendedPlace | null>(null);
  // Add-spot form visibility + a transient "added" confirmation message.
  const [addOpen, setAddOpen] = useState(false);
  const [addedName, setAddedName] = useState<string | null>(null);

  // Spot lookup by id, for resolving a pin back to its full spot detail.
  const spotById = useMemo<Map<string, Spot>>(
    () => new Map(spots.map((s) => [s.id, s] as const)),
    [spots],
  );

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

  // Resolve catalogue-only spots lazily through the server-side Places API.
  //
  // Every lookup here is a billed Text Search, and the panel is a place users tap
  // in and out of, so results are memoised for the session by feature id.
  // Without that, tapping the same pin twice paid twice — a miss is remembered as
  // `null` for the same reason.
  useEffect(() => {
    if (!selected) {
      setLookedUpPlace(null);
      return;
    }
    if (selected.place) {
      setLookedUpPlace(selected.place);
      return;
    }
    const cached = placeLookupCache.get(selected.id);
    if (cached !== undefined) {
      setLookedUpPlace(cached);
      return;
    }

    // 発見デッキで既に解決済みのスポットなら、写真と Place ID が localStorage に
    // 残っている。そこから写真と Google マップリンクの両方が作れるので、この
    // タップは課金呼び出しをせずに済む。
    //
    // 住所は入らないが、この分岐に来るのはカタログのみのピンで、以前もその住所は
    // 表示されていなかった（詳細パネルは住所を `feature.place` から読んでおり、
    // カタログのみのピンでは未定義だったため）。つまり画面の見え方は変わらない。
    const photoEntry = selected.spotId ? discovery?.cachedPhoto(selected.spotId) : undefined;
    if (photoEntry) {
      const fromCache: RecommendedPlace = {
        // 空文字になるのは Place ID を持たない旧バージョンのエントリのみ。
        // 詳細パネルは空文字を「Place ID なし」として扱う。
        id: photoEntry.placeId ?? "",
        name: selected.label,
        formattedAddress: "",
        photoUrl: photoEntry.photoUrl,
        ...(photoEntry.attributions.length > 0
          ? { photoAttributions: photoEntry.attributions }
          : {}),
        ...(photoEntry.placeId
          ? { googleMapsUri: googleMapsUrlForPlaceId(photoEntry.placeId) }
          : {}),
      };
      placeLookupCache.set(selected.id, fromCache);
      setLookedUpPlace(fromCache);
      return;
    }

    setLookedUpPlace(null);
    if (!awsEnv.apiEndpoint) return;

    let cancelled = false;
    const featureId = selected.id;
    const base = awsEnv.apiEndpoint.replace(/\/+$/, "");
    void fetch(`${base}/places/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: selected.label, lang }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { place?: RecommendedPlace };
        return data.place ?? null;
      })
      .then((place) => {
        placeLookupCache.set(featureId, place);
        if (!cancelled) setLookedUpPlace(place);
      })
      .catch(() => {
        // A network failure is about this moment, not about the place, so it is
        // not cached — the next tap may well succeed.
        if (!cancelled) setLookedUpPlace(null);
      });
    return () => { cancelled = true; };
  }, [selected, lang, discovery]);

  // All features across every layer — spots + facilities + swipe-driven lists.
  const allFeatures = useMemo<TourismMapFeature[]>(
    () => buildTourismLayerFeatures(spots, { favorites, shiori }),
    [spots, favorites, shiori],
  );

  const planArea = useMemo<GeoArea | null>(() => {
    if (!activePlan) return null;
    const center = activePlan.area?.center
      ?? activePlan.stops.find((stop) => stop.place?.location)?.place?.location;
    if (!center) return null;
    return {
      center,
      radiusMeters: Math.min(
        PLAN_AREA_RADIUS_METERS,
        activePlan.area?.radiusMeters ?? PLAN_AREA_RADIUS_METERS,
      ),
    };
  }, [activePlan]);

  const featuresInArea = useMemo<TourismMapFeature[]>(
    () => planArea
      ? allFeatures.filter(
          (feature) => haversineDistanceMeters(planArea.center, feature.location) <= planArea.radiusMeters,
        )
      : allFeatures,
    [allFeatures, planArea],
  );

  const planFeatures = useMemo<TourismMapFeature[]>(
    () =>
      (activePlan?.stops ?? []).flatMap((stop, index) => {
        const place = stop.place;
        if (!place?.location) return [];
        if (
          planArea
          && haversineDistanceMeters(planArea.center, place.location) > planArea.radiusMeters
        ) return [];
        return [{
          id: `plan:${activePlan?.id}:${index}`,
          layer: "sightseeing" as const,
          location: place.location,
          label: place.name || stop.title,
          place,
          description: stop.description,
          order: index + 1,
        }];
      }),
    [activePlan, planArea],
  );

  const activeLayers = useMemo<LayerKind[]>(
    () => LAYER_ORDER.filter((k) => activeSet.has(k)),
    [activeSet],
  );

  const visibleFeatures = useMemo<TourismMapFeature[]>(
    () => filterByLayers(featuresInArea, activeLayers),
    [featuresInArea, activeLayers],
  );

  // The selected AI itinerary is the primary map experience. Without one,
  // preserve the existing layered catalogue.
  const mapFeatures = planFeatures.length > 0 ? planFeatures : visibleFeatures;

  const mapCurrent = useMemo<GeoPoint | null>(() => {
    if (!current || !planArea) return current;
    return haversineDistanceMeters(planArea.center, current) <= planArea.radiusMeters
      ? current
      : null;
  }, [current, planArea]);

  // A selected AI plan always uses its exact five-kilometre area for the
  // viewport. A distant current location must not zoom the itinerary out.
  const boundsPoints = useMemo<GeoPoint[]>(() => {
    if (planArea) return boundsPointsForArea(planArea);
    const source = mapFeatures.length > 0 ? mapFeatures : featuresInArea;
    const points: GeoPoint[] = source.map((f) => f.location);
    if (mapCurrent) points.push(mapCurrent);
    return points;
  }, [mapFeatures, featuresInArea, mapCurrent, planArea]);

  const candidates = useMemo<TouringCandidate[]>(
    () => buildTouringCandidates(visibleFeatures, activeLayers),
    [visibleFeatures, activeLayers],
  );

  const countByLayer = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const f of featuresInArea) out[f.layer] = (out[f.layer] ?? 0) + 1;
    return out;
  }, [featuresInArea]);

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

  const handleAddSpot = (input: NewSpotInput): void => {
    void (async () => {
      const spot = await addSpot(input);
      setAddedName(spot.name);
      setAddOpen(false);
      // Make sure the layer the new spot lives on is visible so the pin shows.
      setActivePurpose(null);
      setActiveSet((prev) => new Set(prev).add(spot.category));
    })();
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

      <div className="layered-map__add" data-testid="tourism-add-spot">
        <Button
          variant={addOpen ? "primary" : "ghost"}
          size="sm"
          aria-expanded={addOpen}
          onClick={() => {
            setAddedName(null);
            setAddOpen((v) => !v);
          }}
        >
          {addOpen ? t("tlmap.add.cancel") : t("tlmap.add.toggle")}
        </Button>
        {addedName && !addOpen && (
          <span className="layered-map__add-done" role="status">
            {t("tlmap.add.done").replace("{name}", addedName)}
          </span>
        )}
        {addOpen && (
          <AddSpotForm current={current} onSubmit={handleAddSpot} t={t} />
        )}
      </div>

      {loading ? (
        <p className="layered-map__status" role="status">{t("tlmap.loading")}</p>
      ) : (
        <>
          <p className="layered-map__count" role="status">
            {activePlan && planFeatures.length > 0
              ? `${activePlan.title} — ${mapFeatures.length}スポット`
              : t("tlmap.countShown").replace("{count}", String(mapFeatures.length))}
          </p>

          <div className={"tlmap-mapwrap" + (selected ? " tlmap-mapwrap--split" : "")}>
            <div className="tlmap-mapwrap__map">
              <GoogleTourismMap
                className="layered-map__surface"
                ariaLabel={t("tlmap.title")}
                items={mapFeatures}
                area={planArea ?? undefined}
                current={mapCurrent}
                selectedId={selected?.id}
                onSelect={setSelected}
                showDirections={planFeatures.length > 1}
                fallback={(
                  <MapCanvas
                    className="layered-map__surface"
                    testId="tourism-layered-map-surface"
                    ariaLabel={t("tlmap.title")}
                    items={mapFeatures}
                    boundsPoints={boundsPoints}
                    current={mapCurrent}
                    renderCurrent={(style) => (
                      <span className="layered-map__here" style={style} aria-label={t("map.youAreHere")} />
                    )}
                    renderItem={(feature, style) => (
                      <button
                        type="button"
                        className={`layered-map__pin layered-map__pin--${feature.layer}`}
                        style={style}
                        aria-label={feature.label}
                        onClick={() => setSelected(feature)}
                      />
                    )}
                  />
                )}
              />
              <p className="layered-map__attribution">{t("tlmap.googleAttribution")}</p>
            </div>

            {selected && (
              <SpotDetailPanel
                feature={selected}
                spot={selected.spotId ? spotById.get(selected.spotId) : undefined}
                place={lookedUpPlace}
                current={current}
                onClose={() => setSelected(null)}
                t={t}
              />
            )}
          </div>

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

// ---------------------------------------------------------------------------
// Spot detail panel — 3 small info boxes (access / hours / website)
// ---------------------------------------------------------------------------

interface SpotDetailPanelProps {
  feature: TourismMapFeature;
  spot?: Spot;
  place?: RecommendedPlace | null;
  current: GeoPoint | null;
  onClose: () => void;
  t: (key: string) => string;
}

function SpotDetailPanel({ feature, spot, place, current, onClose, t }: SpotDetailPanelProps): JSX.Element {
  const googlePlace = feature.place ?? place;
  const meters = current ? haversineDistanceMeters(current, feature.location) : null;
  const distance = meters != null ? formatDistance(meters) : null;
  const carMin = meters != null ? Math.max(1, Math.round(meters / CAR_METERS_PER_MIN)) : null;
  const walkMin = meters != null ? Math.max(1, Math.round(meters / WALK_METERS_PER_MIN)) : null;

  // 現在地から目的地への経路（地図アプリ）。現在地不明なら目的地表示のみ。
  const routeUrl = current
    ? `https://www.google.com/maps/dir/?api=1&origin=${current.lat},${current.lng}&destination=${feature.location.lat},${feature.location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${feature.location.lat},${feature.location.lng}`;

  // 営業時間・レビュー・電話番号は Places の Enterprise ティアなので取得していない。
  // このリンクがその情報への導線で、スマホなら Google マップアプリが直接開く。
  //
  // `placeId` に渡すのは lookup で解決した `place` の id だけ。`feature.place` は
  // 旅程の stop 由来で、フォールバックで組まれた場合は同梱カタログの id が入るため
  // Place ID として使うと必ず外れたリンクになる（Google 由来なら `googleMapsUri`
  // が付いているので、そちらが先に採用される）。
  const detailUrl = googleMapsUrl({
    googleMapsUri: googlePlace?.googleMapsUri,
    placeId: place?.id,
    searchQuery: `${feature.label} 愛媛県`,
  });

  return (
    <Card className="tspot-detail" data-testid="tspot-detail" raised>
      <div className="tspot-detail__head">
        <div className="tspot-detail__title">
          <p className="tspot-detail__name">{spot?.name ?? feature.label}</p>
          <Tag tone="teal">{t(`tlmap.layer.${feature.layer}`)}</Tag>
        </div>
        <button
          type="button"
          className="tspot-detail__close"
          aria-label={t("tlmap.detail.close")}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {googlePlace?.photoUrl && (
        <figure className="tspot-detail__google-photo">
          <img src={googlePlace.photoUrl} alt={googlePlace.name} />
          {googlePlace.photoAttributions?.length && (
            <figcaption>
              Photo: {googlePlace.photoAttributions.map((credit) => credit.displayName).join(", ")}
            </figcaption>
          )}
        </figure>
      )}

      {(feature.description || spot?.localizedDescriptions.ja) && (
        <p className="tspot-detail__desc">
          {feature.description ?? spot?.localizedDescriptions.ja}
        </p>
      )}

      {/*
        ★（rating / userRatingCount）と ☎（nationalPhoneNumber）はここにあったが、
        どちらも Places の Enterprise ティアのフィールドで、この 2 つを要求するだけで
        全リクエストが最上位単価になっていた。取得をやめ、下の Google マップリンクへ
        委譲している（マップ側には評価も電話番号も最新の状態で揃っている）。

        住所は `googlePlace` から読む。以前は `feature.place` 固定だったので、
        ピン選択時に lookup で解決した場所の住所が出ないままだった。
      */}
      {(googlePlace?.formattedAddress || detailUrl) && (
        <div className="tspot-detail__place-meta">
          {googlePlace?.formattedAddress && <address>{googlePlace.formattedAddress}</address>}
          {detailUrl && (
            <a href={detailUrl} target="_blank" rel="noopener noreferrer">
              {t("planFirst.openGoogleMaps")} ↗
            </a>
          )}
        </div>
      )}

      <div className="tspot-detail__boxes">
        {/* 現在地からのアクセス */}
        <div className="tspot-detail__box" data-testid="tspot-detail-access">
          <span className="tspot-detail__box-label">🧭 {t("tlmap.detail.access")}</span>
          {distance != null ? (
            <>
              <span className="tspot-detail__box-value">{distance}</span>
              <span className="tspot-detail__box-sub">
                {t("tlmap.detail.carWalk")
                  .replace("{car}", String(carMin))
                  .replace("{walk}", String(walkMin))}
              </span>
            </>
          ) : (
            <span className="tspot-detail__box-sub">{t("tlmap.detail.noLocation")}</span>
          )}
          <a className="tspot-detail__link" href={routeUrl} target="_blank" rel="noopener noreferrer">
            {t("tlmap.detail.route")}
          </a>
        </div>

        {/*
          営業時間。Google からは取得しない（Enterprise ティア）ので、出所は
          同梱カタログ（OpenStreetMap）だけになった。カタログにも無い場合は
          「情報なし」で終わらせず Google マップへ送る — 営業時間を知りたい人に
          とっては、それが唯一まだ機能する導線だから。

          `regularOpeningHours` の参照は残してある。Google は返さなくなったが、
          オフラインのフォールバック経路がカタログの値でこの項目を埋めるため。
        */}
        <div className="tspot-detail__box" data-testid="tspot-detail-hours">
          <span className="tspot-detail__box-label">🕒 {t("tlmap.detail.hours")}</span>
          {(() => {
            const hours = googlePlace?.regularOpeningHours?.join(" / ") ?? spot?.openingHours;
            if (hours) {
              return (
                <span className="tspot-detail__box-value tspot-detail__box-value--sm">
                  {hours}
                </span>
              );
            }
            return detailUrl ? (
              <a className="tspot-detail__link" href={detailUrl} target="_blank" rel="noopener noreferrer">
                {t("planFirst.openGoogleMaps")}
              </a>
            ) : (
              <span className="tspot-detail__box-sub">{t("tlmap.detail.noInfo")}</span>
            );
          })()}
        </div>

        {/*
          ホームページ。こちらも Google からは取得しない（Enterprise ティア）。
          カタログの `website` があれば出し、無ければ「情報なし」。上に Google マップ
          リンクがあるので、ここで 3 つ目の同じリンクは足さない。
        */}
        <div className="tspot-detail__box" data-testid="tspot-detail-website">
          <span className="tspot-detail__box-label">🌐 {t("tlmap.detail.website")}</span>
          {googlePlace?.websiteUri ?? spot?.website ? (
            <a className="tspot-detail__link" href={googlePlace?.websiteUri ?? spot?.website} target="_blank" rel="noopener noreferrer">
              {t("tlmap.detail.openSite")}
            </a>
          ) : (
            <span className="tspot-detail__box-sub">{t("tlmap.detail.noInfo")}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add-spot form — runtime-add a spot (Step 0: in-memory via SpotContext)
// ---------------------------------------------------------------------------

const ADD_CATEGORIES: { value: Spot["category"]; labelKey: string }[] = [
  { value: "sightseeing", labelKey: "tlmap.layer.sightseeing" },
  { value: "food", labelKey: "tlmap.layer.food" },
  { value: "onsen", labelKey: "tlmap.layer.onsen" },
  { value: "souvenir", labelKey: "tlmap.layer.souvenir" },
];

interface AddSpotFormProps {
  current: GeoPoint | null;
  onSubmit: (input: NewSpotInput) => void;
  t: (key: string) => string;
}

function AddSpotForm({ current, onSubmit, t }: AddSpotFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Spot["category"]>("sightseeing");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [website, setWebsite] = useState("");
  const [hours, setHours] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const useCurrent = (): void => {
    if (!current) {
      setError(t("tlmap.add.noCurrent"));
      return;
    }
    setLat(current.lat.toFixed(6));
    setLng(current.lng.toFixed(6));
    setError(null);
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("tlmap.add.errorName"));
      return;
    }
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!lat.trim() || !lng.trim() || Number.isNaN(latN) || Number.isNaN(lngN)) {
      setError(t("tlmap.add.errorLatLng"));
      return;
    }
    setError(null);
    onSubmit({
      name,
      category,
      location: { lat: latN, lng: lngN },
      website: website.trim() || undefined,
      openingHours: hours.trim() || undefined,
      descriptionJa: desc.trim() || undefined,
    });
  };

  return (
    <Card className="add-spot" raised>
      <form className="add-spot__form" onSubmit={submit}>
        <p className="add-spot__lead">{t("tlmap.add.lead")}</p>

        <label className="add-spot__field">
          <span className="add-spot__label">{t("tlmap.add.name")}</span>
          <input
            className="add-spot__input"
            type="text"
            value={name}
            placeholder={t("tlmap.add.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="add-spot__field">
          <span className="add-spot__label">{t("tlmap.add.category")}</span>
          <select
            className="add-spot__input"
            value={category}
            onChange={(e) => setCategory(e.target.value as Spot["category"])}
          >
            {ADD_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
            ))}
          </select>
        </label>

        <div className="add-spot__row">
          <label className="add-spot__field add-spot__field--half">
            <span className="add-spot__label">{t("tlmap.add.lat")}</span>
            <input
              className="add-spot__input"
              type="text"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </label>
          <label className="add-spot__field add-spot__field--half">
            <span className="add-spot__label">{t("tlmap.add.lng")}</span>
            <input
              className="add-spot__input"
              type="text"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </label>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={useCurrent}>
          📍 {t("tlmap.add.useCurrent")}
        </Button>

        <label className="add-spot__field">
          <span className="add-spot__label">{t("tlmap.add.hours")}</span>
          <input
            className="add-spot__input"
            type="text"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>

        <label className="add-spot__field">
          <span className="add-spot__label">{t("tlmap.add.website")}</span>
          <input
            className="add-spot__input"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>

        <label className="add-spot__field">
          <span className="add-spot__label">{t("tlmap.add.desc")}</span>
          <textarea
            className="add-spot__input add-spot__textarea"
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </label>

        {error && (
          <p className="add-spot__error" role="alert">{error}</p>
        )}

        <Button type="submit" variant="primary" size="sm">
          {t("tlmap.add.submit")}
        </Button>
      </form>
    </Card>
  );
}

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
