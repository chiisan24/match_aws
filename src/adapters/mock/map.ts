/**
 * Mock MapLocationPort adapter.
 *
 * `getTemples` returns the fixed 26 Ehime temples (numbers 40–65) for the
 * `ehime` area; other prefectures have no mock dataset yet and return an empty
 * list. `getCurrentLocation` returns a fixed mock position near Dogo Onsen,
 * Matsuyama. `watchGeofences` is a no-op stub (auto-arrival is a later phase,
 * Q5) that still honors the port contract by returning an Unsubscribe.
 */

import type {
  GeoPoint,
  Geofence,
  MapLocationPort,
  ShikokuPrefecture,
  Temple,
  Unsubscribe,
} from "../../ports";
import { EHIME_TEMPLES } from "./temples";

/** Fixed mock "current location" — near Dogo Onsen, Matsuyama. */
const MOCK_CURRENT_LOCATION: GeoPoint = { lat: 33.852, lng: 132.7866 };

export class MockMapLocationAdapter implements MapLocationPort {
  async getTemples(area: ShikokuPrefecture): Promise<Temple[]> {
    if (area === "ehime") {
      // Return copies so callers can't mutate the shared fixture.
      return EHIME_TEMPLES.map((t) => ({ ...t }));
    }
    return [];
  }

  async getCurrentLocation(): Promise<GeoPoint | null> {
    return { ...MOCK_CURRENT_LOCATION };
  }

  watchGeofences(
    _fences: Geofence[],
    _onEnter: (templeId: string) => void,
  ): Unsubscribe {
    // Stub: the mock never fires enter events. Returning a no-op Unsubscribe
    // keeps the contract identical to the future AWS adapter (Req 16.1, 16.4).
    return () => {};
  }
}
