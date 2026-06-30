/**
 * MapCanvas — shared map surface for 札所マップ / 重ねるマップ (Req 20).
 *
 * Two rendering modes, chosen at runtime:
 *
 *  - **Real map mode** (`enabled`, default `awsEnv.mapEnabled`): mounts an
 *    interactive **MapLibre GL JS** map with open tiles (OpenStreetMap by
 *    default, or `awsEnv.mapStyleUrl`). Pins / current-location / zones are
 *    rendered as React overlays whose pixel positions are projected from their
 *    geo coordinates and kept in sync on every map move/zoom (Req 20.1–20.3).
 *    MapLibre is loaded lazily (dynamic import) so it stays out of the main
 *    bundle when the map is disabled.
 *  - **Mock surface mode** (default / fallback): the original percentage-
 *    projection surface (`buildProjector`). Used when the real map is disabled,
 *    or when MapLibre / WebGL initialization fails (Req 20.4, 20.7) — which is
 *    also the case under jsdom, so existing tests keep rendering the mock
 *    surface unchanged.
 *
 * The outer element always carries the same `className` / `testId` / role /
 * aria-label in both modes, so existing screen markup and tests are preserved.
 * No AWS credentials or secret keys are used (Req 20.5).
 */

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { awsEnv } from "../../config/env";
import type { GeoPoint } from "../../domain/types";

/** Minimum shape an item needs to be placed on the map. */
export interface MapItem {
  id: string;
  location: GeoPoint;
}

export interface MapCanvasProps<T extends MapItem> {
  /** Items rendered as pins/markers. */
  items: readonly T[];
  /** Renders a single item at the supplied (left/top) style. */
  renderItem: (item: T, style: CSSProperties) => ReactNode;
  /** Current location, if available. */
  current?: GeoPoint | null;
  /** Renders the current-location marker at the supplied style. */
  renderCurrent?: (style: CSSProperties) => ReactNode;
  /** Optional features drawn behind the items (e.g. hazard zones). */
  zones?: readonly T[];
  /** Renders a single zone at the supplied style. */
  renderZone?: (item: T, style: CSSProperties) => ReactNode;
  /**
   * Extra geo points used only to compute the projection bounds / initial fit
   * (not rendered). Pass the full dataset so pin positions stay stable while
   * the visible subset is filtered.
   */
  boundsPoints?: readonly GeoPoint[];
  /** Surface class, e.g. "temple-map__surface". */
  className: string;
  /** data-testid for the surface element. */
  testId?: string;
  ariaLabel?: string;
  /** Extra content (e.g. an empty-state message). */
  children?: ReactNode;
  /**
   * Force the real-map toggle. When omitted, the real map is used automatically
   * if `awsEnv.mapEnabled` (default on) and the browser supports WebGL.
   */
  enabled?: boolean;
}

/** A pin's projected position as percentages within the mock surface. */
interface Pct {
  xPct: number;
  yPct: number;
}

/** Builds a geo→percent projector over the given points (north = top). */
function buildProjector(points: GeoPoint[]): ((p: GeoPoint) => Pct) | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const pad = 10;
  const scale = (value: number, min: number, span: number): number =>
    span === 0 ? 50 : pad + ((value - min) / span) * (100 - pad * 2);
  return (p) => ({
    xPct: scale(p.lng, minLng, lngSpan),
    yPct: 100 - scale(p.lat, minLat, latSpan),
  });
}

/** Built-in keyless OpenStreetMap raster style (Req 20.5). */
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
} as const;

const CURRENT_KEY = "__current__";

/** True when the browser can create a WebGL context (MapLibre needs it). */
function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

export function MapCanvas<T extends MapItem>({
  items,
  renderItem,
  current,
  renderCurrent,
  zones,
  renderZone,
  boundsPoints,
  className,
  testId,
  ariaLabel,
  children,
  enabled,
}: MapCanvasProps<T>): JSX.Element {
  const [failed, setFailed] = useState(false);
  // Explicit `enabled` prop wins (used by tests). Otherwise auto-enable the
  // real map when configured AND the browser supports WebGL (Req 20.4 / 20.7).
  const resolvedEnabled = useMemo(
    () => enabled ?? (awsEnv.mapEnabled && webglAvailable()),
    [enabled],
  );
  const useReal = resolvedEnabled && !failed;

  const glRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  // Pixel positions keyed by item/zone id (real mode), recomputed on map move.
  const [px, setPx] = useState<Record<string, { x: number; y: number }>>({});

  // Every geo point that needs a projected position, with a stable key.
  const placed = useMemo(() => {
    const out: { key: string; location: GeoPoint }[] = [];
    for (const z of zones ?? []) out.push({ key: `zone:${z.id}`, location: z.location });
    for (const it of items) out.push({ key: it.id, location: it.location });
    if (current) out.push({ key: CURRENT_KEY, location: current });
    return out;
  }, [items, zones, current]);

  const placedRef = useRef(placed);
  placedRef.current = placed;

  // ---- Real map lifecycle (lazy MapLibre) --------------------------------
  useEffect(() => {
    if (!useReal) return;
    let cancelled = false;

    const recompute = (): void => {
      const map = mapRef.current;
      if (!map) return;
      const next: Record<string, { x: number; y: number }> = {};
      for (const p of placedRef.current) {
        const pt = map.project([p.location.lng, p.location.lat]);
        next[p.key] = { x: pt.x, y: pt.y };
      }
      setPx(next);
    };

    void (async () => {
      try {
        const mod = await import("maplibre-gl");
        const maplibregl = (mod.default ?? mod) as typeof import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !glRef.current) return;

        const allPoints = [
          ...(boundsPoints ?? []),
          ...placedRef.current.map((p) => p.location),
        ];
        const center = centroid(allPoints) ?? { lat: 33.84, lng: 132.77 };

        const map = new maplibregl.Map({
          container: glRef.current,
          style: (awsEnv.mapStyleUrl ?? OSM_STYLE) as never,
          center: [center.lng, center.lat],
          zoom: 9,
        });
        mapRef.current = map;

        map.on("load", () => {
          map.resize();
          fitToPoints(map, allPoints, maplibregl);
          recompute();
        });
        map.on("move", recompute);
        map.on("zoom", recompute);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Recreate only when toggling real mode or the style changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useReal]);

  // Recompute positions when the placed set changes (filtering etc.).
  useEffect(() => {
    const map = mapRef.current;
    if (!useReal || !map) return;
    const next: Record<string, { x: number; y: number }> = {};
    for (const p of placed) {
      const pt = map.project([p.location.lng, p.location.lat]);
      next[p.key] = { x: pt.x, y: pt.y };
    }
    setPx(next);
  }, [placed, useReal]);

  // ---- Position helpers --------------------------------------------------
  const projector = useMemo(
    () =>
      useReal
        ? null
        : buildProjector([
            ...(boundsPoints ?? []),
            ...placed.map((p) => p.location),
          ]),
    [useReal, boundsPoints, placed],
  );

  const styleFor = (key: string, location: GeoPoint): CSSProperties => {
    if (useReal) {
      const pos = px[key];
      // Hide until the map has projected a position to avoid a flash at 0,0.
      if (!pos) return { left: 0, top: 0, opacity: 0 };
      return { left: `${pos.x}px`, top: `${pos.y}px` };
    }
    if (!projector) return { left: "50%", top: "50%" };
    const p = projector(location);
    return { left: `${p.xPct}%`, top: `${p.yPct}%` };
  };

  return (
    <div
      className={className}
      data-testid={testId}
      role="group"
      aria-label={ariaLabel}
    >
      {useReal && <div ref={glRef} className="map-canvas__gl" aria-hidden="true" />}

      {(zones ?? []).map((z) => (
        <Fragment key={`zone:${z.id}`}>
          {renderZone?.(z, styleFor(`zone:${z.id}`, z.location))}
        </Fragment>
      ))}

      {items.map((it) => (
        <Fragment key={it.id}>{renderItem(it, styleFor(it.id, it.location))}</Fragment>
      ))}

      {current &&
        renderCurrent?.(styleFor(CURRENT_KEY, current))}

      {children}
    </div>
  );
}

/** Mean of geo points (for the initial map centre). */
function centroid(points: readonly GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

/** Fits the map viewport to the supplied points (with padding). */
function fitToPoints(
  map: import("maplibre-gl").Map,
  points: readonly GeoPoint[],
  maplibregl: typeof import("maplibre-gl"),
): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.jumpTo({ center: [points[0]!.lng, points[0]!.lat], zoom: 13 });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const p of points) bounds.extend([p.lng, p.lat]);
  map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
}
