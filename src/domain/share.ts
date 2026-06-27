/**
 * Pure plan-sharing encode/decode (Req 7.1, 7.2 / Property 13).
 *
 * A しおり/プラン is turned into a compact, URL-safe **share token** (a
 * base64url-encoded JSON string) so it can travel inside a link hash or be
 * copied as a shareable code (Req 7.1). Opening the token reconstructs the exact
 * same plan (Req 7.2), and an absent / corrupt token decodes to `null` so the UI
 * can show 「プランが見つからない」 (Req 7.3).
 *
 * Everything here is a pure, total function with no DOM / network dependency, so
 * the encode→decode round-trip (Property 13) is fully testable in isolation:
 *
 *     decodeSharePlan(encodeSharePlan(plan))  // structurally equals `plan`
 *
 * The round-trip is faithful because {@link normalizeSharePlan} fixes the field
 * set before encoding (optional `note` is only present when non-empty) and the
 * decoder rebuilds the same normalized shape — so JSON's habit of dropping
 * `undefined` keys can never make the two sides disagree.
 */

/** A single stop in a shared plan. */
export interface SharePlanItem {
  /** Stable id of the underlying spot/temple. */
  id: string;
  /** Display name carried in the share so the opener needs no catalogue. */
  name: string;
  /** Optional free-text note. Present only when non-empty after normalization. */
  note?: string;
}

/** A travel plan / しおり in the shape carried by a share token. */
export interface SharePlan {
  /** Human-readable plan title. */
  title: string;
  /** Ordered stops; order is preserved verbatim through the round-trip. */
  items: SharePlanItem[];
}

/** Current share-payload schema version, embedded so the format can evolve. */
const SHARE_VERSION = 1;

/** The wire shape actually serialized into the token. */
interface SharePayload {
  v: number;
  title: string;
  items: SharePlanItem[];
}

/**
 * Canonicalize a plan into the exact shape that round-trips: a string title, an
 * array of `{ id, name }` items, and a `note` key present only when it is a
 * non-empty string. This makes {@link encodeSharePlan} / {@link decodeSharePlan}
 * mutually inverse (Property 13) regardless of how the input was constructed.
 */
export function normalizeSharePlan(plan: SharePlan): SharePlan {
  return {
    title: String(plan.title),
    items: plan.items.map((item) => {
      const normalized: SharePlanItem = {
        id: String(item.id),
        name: String(item.name),
      };
      // Only keep `note` when it carries real text — keeps the field set stable
      // across JSON serialization (which would otherwise drop `undefined`).
      if (typeof item.note === "string" && item.note.length > 0) {
        normalized.note = item.note;
      }
      return normalized;
    }),
  };
}

/**
 * Encode a plan into a URL-safe share token (base64url of JSON, Req 7.1).
 * Pure and total. The token contains everything needed to reconstruct the plan.
 */
export function encodeSharePlan(plan: SharePlan): string {
  const payload: SharePayload = {
    v: SHARE_VERSION,
    ...normalizeSharePlan(plan),
  };
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decode a share token back into a plan (Req 7.2). Returns `null` for any
 * missing / malformed / structurally-invalid token so callers can show
 * 「プランが見つからない」 (Req 7.3). Never throws.
 */
export function decodeSharePlan(token: string | null | undefined): SharePlan | null {
  if (typeof token !== "string" || token.length === 0) return null;

  let json: string;
  try {
    json = fromBase64Url(token);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  return toSharePlan(parsed);
}

/** URL-hash fragment key used by {@link buildShareLink} / {@link parseShareToken}. */
const SHARE_HASH_KEY = "plan";

/**
 * Build a shareable link that carries the plan token in the URL hash (Req 7.1),
 * e.g. `https://app.example/#plan=<token>`. `baseUrl` defaults to a hash-only
 * fragment so it works without knowing the deployment origin.
 */
export function buildShareLink(plan: SharePlan, baseUrl = ""): string {
  const token = encodeSharePlan(plan);
  return `${baseUrl}#${SHARE_HASH_KEY}=${token}`;
}

/**
 * Extract a share token from a link or raw hash (the inverse of
 * {@link buildShareLink}). Accepts a full URL, a `#plan=...` fragment, or a bare
 * token. Returns `null` when no token is present.
 */
export function parseShareToken(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const hashIndex = trimmed.indexOf("#");
  const fragment = hashIndex >= 0 ? trimmed.slice(hashIndex + 1) : trimmed;

  // `#plan=<token>` (possibly among other &-separated params).
  for (const part of fragment.split("&")) {
    const eq = part.indexOf("=");
    if (eq >= 0 && part.slice(0, eq) === SHARE_HASH_KEY) {
      const value = part.slice(eq + 1);
      return value.length > 0 ? value : null;
    }
  }

  // No `plan=` param — treat the whole input as a bare token (no `#`, no `=`).
  if (hashIndex < 0 && !trimmed.includes("=")) return trimmed;
  return null;
}

/**
 * Convenience: open a share link / token directly to a plan, or `null` when it
 * cannot be resolved (Req 7.2, 7.3).
 */
export function openSharedPlan(input: string | null | undefined): SharePlan | null {
  return decodeSharePlan(parseShareToken(input));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Validate + canonicalize an unknown parsed value into a {@link SharePlan}. */
function toSharePlan(value: unknown): SharePlan | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;

  if (typeof obj.title !== "string") return null;
  if (!Array.isArray(obj.items)) return null;

  const items: SharePlanItem[] = [];
  for (const raw of obj.items) {
    if (typeof raw !== "object" || raw === null) return null;
    const itemObj = raw as Record<string, unknown>;
    if (typeof itemObj.id !== "string" || typeof itemObj.name !== "string") {
      return null;
    }
    const item: SharePlanItem = { id: itemObj.id, name: itemObj.name };
    if (typeof itemObj.note === "string" && itemObj.note.length > 0) {
      item.note = itemObj.note;
    }
    items.push(item);
  }

  return { title: obj.title, items };
}

/** UTF-8 → base64url. Works in both the browser and the Node/jsdom test env. */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → UTF-8. Throws on structurally invalid base64 (caller guards). */
function fromBase64Url(token: string): string {
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  // Restore padding to a multiple of 4 so atob accepts it.
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
