/**
 * /api/spots — runtime spot catalogue backed by DynamoDB.
 *
 *   GET  /api/spots            → { spots: Spot[] }   (the runtime additions)
 *   POST /api/spots            → { spot: Spot }      (add one; admin only)
 *
 * Only the *additions* live in DynamoDB; the ~400 seed spots stay bundled in
 * the client, so reads are tiny and stay comfortably inside the free tier.
 *
 * Auth: POST requires header `x-admin-token` to equal the `SPOTS_ADMIN_TOKEN`
 * environment variable. If that env var is unset, writes are refused (the API
 * is read-only) so an unconfigured deploy can't be spammed. GET is public.
 *
 * Table: name from `SPOTS_TABLE` (default "match-spots"), primary key `id`
 * (String). Region/credentials resolve via the shared `_aws` helpers.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { awsCredentials, awsRegion, errorDetail } from "./_aws.js";

const REGION = awsRegion();
const TABLE = process.env.SPOTS_TABLE || "match-spots";

type Category = "sightseeing" | "food" | "souvenir" | "onsen";
const CATEGORIES: Category[] = ["sightseeing", "food", "souvenir", "onsen"];
const CATEGORY_JA: Record<Category, string> = {
  sightseeing: "観光スポット",
  food: "飲食店",
  onsen: "温泉",
  souvenir: "みやげ",
};

// Lazy-load the SDK inside the request path (see translate.ts rationale).
let sdkPromise: Promise<typeof import("@aws-sdk/lib-dynamodb")> | null = null;
function loadDocSdk() {
  if (!sdkPromise) sdkPromise = import("@aws-sdk/lib-dynamodb");
  return sdkPromise;
}
let clientSdkPromise:
  | Promise<typeof import("@aws-sdk/client-dynamodb")>
  | null = null;
function loadClientSdk() {
  if (!clientSdkPromise) clientSdkPromise = import("@aws-sdk/client-dynamodb");
  return clientSdkPromise;
}

let doc: DynamoDBDocumentClient | null = null;
async function docClient(): Promise<DynamoDBDocumentClient> {
  if (doc) return doc;
  const { DynamoDBClient } = await loadClientSdk();
  const { DynamoDBDocumentClient } = await loadDocSdk();
  const base = new DynamoDBClient({
    region: REGION,
    credentials: awsCredentials(),
  });
  doc = DynamoDBDocumentClient.from(base);
  return doc;
}

interface NewSpotInput {
  name?: unknown;
  category?: unknown;
  location?: { lat?: unknown; lng?: unknown };
  descriptionJa?: unknown;
  openingHours?: unknown;
  website?: unknown;
}

/** Validate + normalise the POST body into a stored spot, or return an error. */
function buildSpot(body: NewSpotInput): { spot?: Record<string, unknown>; error?: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "name is required" };

  const category = body.category as Category;
  if (!CATEGORIES.includes(category)) return { error: "invalid category" };

  const lat = Number(body.location?.lat);
  const lng = Number(body.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "valid location.lat/lng required" };
  }

  const website =
    typeof body.website === "string" && /^https?:\/\//i.test(body.website.trim())
      ? body.website.trim()
      : undefined;
  const openingHours =
    typeof body.openingHours === "string" && body.openingHours.trim()
      ? body.openingHours.trim()
      : undefined;
  const descJa =
    typeof body.descriptionJa === "string" && body.descriptionJa.trim()
      ? body.descriptionJa.trim()
      : `${name}（${CATEGORY_JA[category]}）`;

  const id = `user-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}`;

  const spot: Record<string, unknown> = {
    id,
    name,
    category,
    location: { lat, lng },
    localizedDescriptions: { ja: descJa },
    reviews: [],
    imageUrls: [],
    createdAt: new Date().toISOString(),
  };
  if (openingHours) spot.openingHours = openingHours;
  if (website) spot.website = website;
  return { spot };
}

/**
 * True when the failure means "DynamoDB is simply not set up here" rather than
 * a real backend fault: no IAM credentials (the Bedrock API key does not work
 * for DynamoDB) or the table does not exist yet.
 */
function isCatalogueUnconfigured(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  return (
    name === "CredentialsProviderError" ||
    name === "ResourceNotFoundException"
  );
}

/**
 * Remembers an unconfigured catalogue so repeated page loads stop paying for a
 * DynamoDB round-trip that can only fail the same way. Reset by a redeploy /
 * dev-server restart, which is also when the configuration can change.
 */
let catalogueUnconfigured = false;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    if (req.method === "GET") {
      // Reads are an optional enhancement: the ~400 seed spots are bundled in
      // the client, so "no runtime additions" is a valid answer when DynamoDB
      // is not configured. Returning 200 keeps the console clean instead of
      // reporting a backend outage that does not exist.
      if (catalogueUnconfigured) {
        res.setHeader("Cache-Control", "private, no-store");
        res.status(200).json({ spots: [] });
        return;
      }
      const { ScanCommand } = await loadDocSdk();
      const out = await (await docClient()).send(
        new ScanCommand({ TableName: TABLE }),
      );
      res.status(200).json({ spots: out.Items ?? [] });
      return;
    }

    if (req.method === "POST") {
      const expected = process.env.SPOTS_ADMIN_TOKEN;
      if (!expected) {
        res.status(503).json({ error: "Writes disabled: SPOTS_ADMIN_TOKEN not set." });
        return;
      }
      const token = req.headers["x-admin-token"];
      if (token !== expected) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { spot, error } = buildSpot((req.body ?? {}) as NewSpotInput);
      if (error || !spot) {
        res.status(400).json({ error: error ?? "invalid body" });
        return;
      }

      const { PutCommand } = await loadDocSdk();
      await (await docClient()).send(
        new PutCommand({ TableName: TABLE, Item: spot }),
      );
      res.status(201).json({ spot });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    if (req.method === "GET" && isCatalogueUnconfigured(err)) {
      if (!catalogueUnconfigured) {
        catalogueUnconfigured = true;
        console.warn(
          `spots catalogue unavailable, serving bundled seed only: ${errorDetail(err)}`,
        );
      }
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json({ spots: [] });
      return;
    }
    console.error("spots error", err);
    res.status(502).json({ error: "Spots backend error", detail: errorDetail(err) });
  }
}
