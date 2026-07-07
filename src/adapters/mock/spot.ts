/**
 * Mock SpotPort adapter — the default catalogue backend (no AWS).
 *
 * `listSpots` returns the real seed dataset {@link EHIME_SPOTS} plus any spots
 * the user added at runtime, which are persisted through the injected
 * {@link StoragePort} under `"userSpots"`. Because it goes through storage
 * (localStorage in the browser), additions survive a reload — a real upgrade
 * over the earlier in-memory approach, while still needing no AWS.
 *
 * `addSpot` builds a full {@link Spot} with the shared pure helper, appends it
 * to the persisted list and returns it. The AWS adapter swaps this for the
 * DynamoDB-backed API without any change to the screens (Req 16.1).
 */

import type { NewSpotInput, Spot, SpotPort, StoragePort } from "../../ports";
import { buildSpotFromInput, newSpotId } from "../../domain/spot";
import { EHIME_SPOTS } from "./spots";

export class MockSpotAdapter implements SpotPort {
  constructor(private readonly storage: StoragePort) {}

  async listSpots(): Promise<Spot[]> {
    const added = (await this.storage.load<Spot[]>("userSpots")) ?? [];
    // Newest additions first so they're easy to find after adding.
    return [...added.slice().reverse(), ...EHIME_SPOTS];
  }

  async addSpot(input: NewSpotInput): Promise<Spot> {
    const spot = buildSpotFromInput(input, newSpotId());
    const added = (await this.storage.load<Spot[]>("userSpots")) ?? [];
    await this.storage.save<Spot[]>("userSpots", [...added, spot]);
    return spot;
  }
}
