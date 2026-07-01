/**
 * Shared AWS region/credential resolution for the serverless functions.
 *
 * This project's Vercel environment stores the AWS connection info under
 * `BEDROCK_*` names, while the standard AWS SDK default provider chain expects
 * `AWS_*` names. To avoid any Vercel dashboard changes, these helpers read the
 * `BEDROCK_*` names first and fall back to the `AWS_*` names (which also lets a
 * local `.env.local` using either convention work).
 *
 * If no explicit keys are present, `awsCredentials()` returns `undefined` so
 * the SDK's default provider chain still applies (e.g. an attached IAM role).
 * Files prefixed with `_` are not routable endpoints.
 */

/** Region for AWS calls: BEDROCK_REGION → AWS_REGION → us-east-1. */
export function awsRegion(): string {
  return process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1";
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
