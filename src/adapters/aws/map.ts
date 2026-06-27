/**
 * AWS MapLocationPort adapter (Amazon Location Service — placeholder).
 *
 * Contract stub: `implements MapLocationPort` for compile-time contract
 * verification (Req 16.4). Throws at runtime until real Location Service wiring
 * is added. `watchGeofences` returns a no-op Unsubscribe so even the
 * subscription shape matches the contract, but it never fires events.
 */

import type {
  GeoPoint,
  Geofence,
  MapLocationPort,
  ShikokuPrefecture,
  Temple,
  Unsubscribe,
} from "../../ports";
import { AWS_NOT_CONFIGURED } from "./not-configured";

export class AwsMapLocationAdapter implements MapLocationPort {
  async getTemples(_area: ShikokuPrefecture): Promise<Temple[]> {
    throw new Error(AWS_NOT_CONFIGURED("MapLocationPort.getTemples"));
  }

  async getCurrentLocation(): Promise<GeoPoint | null> {
    throw new Error(AWS_NOT_CONFIGURED("MapLocationPort.getCurrentLocation"));
  }

  watchGeofences(
    _fences: Geofence[],
    _onEnter: (templeId: string) => void,
  ): Unsubscribe {
    throw new Error(AWS_NOT_CONFIGURED("MapLocationPort.watchGeofences"));
  }
}
