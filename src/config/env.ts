/**
 * Environment reading seam for AWS connection info.
 *
 * This is the single entry point where the app reads AWS configuration from
 * the environment (Req 17.2). All AWS-dependent features are abstracted behind
 * the AWS_Gateway ports; the factory `createGateway` (added in a later task)
 * uses `awsEnv.hasAwsConfig` to decide between mock and real AWS adapters.
 *
 * When no AWS connection info is provided, the app falls back to mock
 * implementations so it still works on Vercel without AWS (Req 16.2, 17.3).
 */

export interface AwsEnv {
  /** AWS region (e.g. "ap-northeast-1"). */
  readonly region: string | undefined;
  /** Cognito identity pool id (or equivalent) for authenticating to AWS. */
  readonly identityPoolId: string | undefined;
  /** Base endpoint for the serverless API backing the gateway. */
  readonly apiEndpoint: string | undefined;
  /** Amazon Location Service map resource name. */
  readonly locationMapName: string | undefined;
  /** Amazon Location Service place index resource name. */
  readonly locationPlaceIndex: string | undefined;
  /**
   * Whether screens may render a real interactive map (MapLibre GL JS) instead
   * of the mock surface (Req 20). Defaults to ON; set `VITE_MAP_ENABLED=false`
   * to force the mock surface. The map still falls back to the mock surface
   * automatically when WebGL is unavailable (e.g. under jsdom). Independent of
   * `hasAwsConfig` — the map uses open tiles (OpenStreetMap), not AWS.
   */
  readonly mapEnabled: boolean;
  /**
   * Optional MapLibre style URL overriding the built-in OpenStreetMap raster
   * style (e.g. a MapTiler/own style). Public URLs / public-scoped keys only.
   */
  readonly mapStyleUrl: string | undefined;
  /** When true, mock adapters are used even if AWS values are present. */
  readonly forceMock: boolean;
  /**
   * True when enough AWS connection info is present to use real adapters.
   * False (the default) means the app runs on mock adapters.
   */
  readonly hasAwsConfig: boolean;
}

function readRaw(): Omit<AwsEnv, "hasAwsConfig"> {
  // import.meta.env is statically replaced by Vite at build time; in test
  // environments it is also populated. Optional chaining keeps this safe.
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  const forceMock = env.VITE_FORCE_MOCK === "true";
  return {
    region: env.VITE_AWS_REGION || undefined,
    identityPoolId: env.VITE_AWS_IDENTITY_POOL_ID || undefined,
    apiEndpoint: env.VITE_AWS_API_ENDPOINT || undefined,
    locationMapName: env.VITE_AWS_LOCATION_MAP_NAME || undefined,
    locationPlaceIndex: env.VITE_AWS_LOCATION_PLACE_INDEX || undefined,
    mapEnabled: env.VITE_MAP_ENABLED !== "false",
    mapStyleUrl: env.VITE_MAP_STYLE_URL || undefined,
    forceMock,
  };
}

/**
 * Builds the AWS environment view. The client only needs to know the base URL
 * of the serverless API that fronts the AI features (chat / plan / translate /
 * image). When that endpoint is present we use the real AI adapters; AWS
 * region & credentials live server-side (in the Vercel Functions), never in the
 * browser bundle. With no endpoint configured the app stays on mocks.
 */
export function readAwsEnv(): AwsEnv {
  const raw = readRaw();
  // In a production build (Vercel), default the serverless API base to the
  // same-origin "/api" so the deployed app calls the real AI backend without
  // needing a VITE_AWS_API_ENDPOINT dashboard variable. In dev (vite serve)
  // this stays undefined, so the app runs on mocks unless the endpoint is set
  // explicitly. `VITE_FORCE_MOCK=true` still forces mocks everywhere.
  const apiEndpoint =
    raw.apiEndpoint ?? (import.meta.env.PROD ? "/api" : undefined);
  const hasAwsConfig = !raw.forceMock && Boolean(apiEndpoint);
  return { ...raw, apiEndpoint, hasAwsConfig };
}

/** Eagerly evaluated singleton for convenient imports. */
export const awsEnv: AwsEnv = readAwsEnv();
