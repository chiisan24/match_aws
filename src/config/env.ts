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
    forceMock,
  };
}

/**
 * Builds the AWS environment view. Real AWS adapters require, at minimum, a
 * region and an API endpoint; otherwise we stay on mocks.
 */
export function readAwsEnv(): AwsEnv {
  const raw = readRaw();
  const hasAwsConfig =
    !raw.forceMock && Boolean(raw.region) && Boolean(raw.apiEndpoint);
  return { ...raw, hasAwsConfig };
}

/** Eagerly evaluated singleton for convenient imports. */
export const awsEnv: AwsEnv = readAwsEnv();
