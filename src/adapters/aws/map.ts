/**
 * Real MapLocationPort adapter (browser-backed).
 *
 * Used when the interactive map is enabled (`awsEnv.mapEnabled`, Req 20). It is
 * intentionally cloud-agnostic — map tiles are served by MapLibre + open tiles
 * in {@link MapCanvas}, not AWS:
 *
 *  - `getCurrentLocation` uses the browser Geolocation API, falling back to a
 *    fixed Ehime location when geolocation is unavailable or denied (Req 20.6 /
 *    8.4 / 8.5).
 *  - `getTemples` returns the curated 26 Ehime temples (numbers 40–65), the
 *    same dataset as the mock adapter (A7) until a live source is wired.
 *  - `watchGeofences` is a no-op subscription (auto-arrival is a later phase),
 *    matching the port contract (Req 16.1, 16.4).
 */

import type {
  GeoPoint,
  Geofence,
  MapLocationPort,
  ShikokuPrefecture,
  Temple,
  Unsubscribe,
} from "../../ports";
import { EHIME_TEMPLES } from "../mock/temples";

/** Fallback location near Dogo Onsen, Matsuyama (matches the mock adapter). */
const FALLBACK_LOCATION: GeoPoint = { lat: 33.852, lng: 132.7866 };

export class AwsMapLocationAdapter implements MapLocationPort {
  async getTemples(area: ShikokuPrefecture): Promise<Temple[]> {
    if (area === "ehime") {
      return EHIME_TEMPLES.map((t) => ({ ...t }));
    }
    return [];
  }

  async getCurrentLocation(): Promise<GeoPoint | null> {
    const geo =
      typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) return { ...FALLBACK_LOCATION };

    return new Promise<GeoPoint>((resolve) => {
      geo.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ ...FALLBACK_LOCATION }),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }

  watchGeofences(
    _fences: Geofence[],
    _onEnter: (templeId: string) => void,
  ): Unsubscribe {
    // Auto-arrival (geofence) is a later phase — no-op subscription for now.
    return () => {};
  }
}
