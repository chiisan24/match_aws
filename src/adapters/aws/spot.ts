/**
 * AWS SpotPort adapter — catalogue backed by the serverless API + DynamoDB.
 *
 * `listSpots` returns the bundled real seed {@link EHIME_SPOTS} concatenated
 * with the runtime additions fetched from `GET {apiEndpoint}/spots` (a DynamoDB
 * scan server-side). Keeping the 400+ seed spots in the bundle means DynamoDB
 * only stores the deltas, so reads stay tiny and cheap. If the API is
 * unreachable it degrades gracefully to the seed alone (never breaks the map).
 *
 * `addSpot` POSTs to the same endpoint with the admin token header; the
 * function validates and writes to DynamoDB, then returns the created
 * {@link Spot}, which appears on all clients on their next load (no redeploy).
 */

import type { NewSpotInput, Spot, SpotPort } from "../../ports";
import type { AwsEnv } from "../../config/env";
import { AWS_NOT_CONFIGURED } from "./not-configured";
import { EHIME_SPOTS } from "../mock/spots";

export class AwsSpotAdapter implements SpotPort {
  constructor(private readonly env: AwsEnv) {}

  private base(): string {
    const endpoint = this.env.apiEndpoint;
    if (!endpoint) throw new Error(AWS_NOT_CONFIGURED("SpotPort"));
    return endpoint.replace(/\/+$/, "");
  }

  async listSpots(): Promise<Spot[]> {
    let added: Spot[] = [];
    try {
      const res = await fetch(`${this.base()}/spots`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as { spots?: Spot[] };
        if (Array.isArray(data.spots)) added = data.spots;
      }
    } catch {
      // Offline / API down — fall back to the bundled seed only.
      added = [];
    }
    return [...added, ...EHIME_SPOTS];
  }

  async addSpot(input: NewSpotInput): Promise<Spot> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.env.spotAdminToken) {
      headers["x-admin-token"] = this.env.spotAdminToken;
    }

    const res = await fetch(`${this.base()}/spots`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(
        `Spot backend failed (${res.status} ${res.statusText}).`,
      );
    }
    const data = (await res.json()) as { spot?: Spot };
    if (!data.spot) throw new Error("Spot backend returned no spot.");
    return data.spot;
  }
}
