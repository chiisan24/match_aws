/**
 * Shared AWS region/credential resolution for the serverless functions.
 *
 * Bedrock Runtime can authenticate with `AWS_BEARER_TOKEN_BEDROCK`. Other AWS
 * services used by this project (Translate and DynamoDB) still require IAM
 * credentials. Legacy `BEDROCK_*` IAM names remain supported for compatibility.
 *
 * If no explicit IAM keys are present, `awsCredentials()` returns `undefined`
 * so each SDK client can use its default identity provider chain.
 * Files prefixed with `_` are not routable endpoints.
 */

/** Region for AWS calls: BEDROCK_REGION → AWS_REGION → ap-northeast-1. */
export function awsRegion(): string {
  return (
    process.env.BEDROCK_REGION ||
    process.env.AWS_REGION ||
    "ap-northeast-1"
  );
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/**
 * Explicit credentials from BEDROCK_* (preferred) or AWS_* names. Returns
 * `undefined` when neither pair is fully set, so the SDK default chain applies.
 */
export function awsCredentials(): AwsCredentials | undefined {
  const accessKeyId =
    process.env.BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return undefined;

  const sessionToken = process.env.AWS_SESSION_TOKEN;
  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
}

/**
 * Extracts a concise, safe error string for returning to the client during
 * debugging. Prefers an AWS `name: message` form when available.
 */
export function errorDetail(err: unknown): string {
  if (err instanceof Error) {
    return err.name ? `${err.name}: ${err.message}` : err.message;
  }
  return String(err);
}
