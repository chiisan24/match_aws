/**
 * AWS adapters — real implementations of the ports (Bedrock / Location Service /
 * DynamoDB / S3 / Translate). Selected by `createGateway` when AWS connection
 * info is present (Req 16.3).
 *
 * These are contract stubs for now: each class `implements` its port so the
 * compiler keeps it aligned with the shared contract (Req 16.4), but the
 * methods throw `AWS_NOT_CONFIGURED` at runtime until the real AWS wiring is
 * implemented in a later phase. The default app path uses the mock gateway
 * (Req 16.2, 17.3), so the build stays green today.
 */

import type { AwsGateway } from "../../ports";
import type { AwsEnv } from "../../config/env";
import { AwsChatAdapter } from "./chat";
import { AwsMapLocationAdapter } from "./map";
import { AwsStorageAdapter } from "./storage";
import { AwsAuthAdapter } from "./auth";
import { AwsTranslateAdapter } from "./translate";
import { AwsImageAdapter } from "./image";

export { AwsChatAdapter } from "./chat";
export { AwsMapLocationAdapter } from "./map";
export { AwsStorageAdapter } from "./storage";
export { AwsAuthAdapter } from "./auth";
export { AwsTranslateAdapter } from "./translate";
export { AwsImageAdapter } from "./image";

/**
 * Builds the AWS-backed gateway. The return type is annotated as `AwsGateway`,
 * so if any aws adapter drifts from its port contract this fails to compile
 * (Req 16.4). `env` is read by the image adapter (serverless API endpoint) and
 * is available for the eventual real wiring of the other adapters (region /
 * endpoint).
 */
export function createAwsGateway(env: AwsEnv): AwsGateway {
  return {
    chat: new AwsChatAdapter(),
    map: new AwsMapLocationAdapter(),
    storage: new AwsStorageAdapter(),
    auth: new AwsAuthAdapter(),
    translate: new AwsTranslateAdapter(),
    image: new AwsImageAdapter(env),
  };
}
