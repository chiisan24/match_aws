/**
 * AWS adapters — real implementations of the ports.
 *
 * The AI-facing ports are live: `chat` (Amazon Bedrock / Claude), `translate`
 * (Amazon Translate) and `image` (Amazon Bedrock / Titan Image Generator) call
 * the app's serverless API (Vercel Functions), which talks to AWS server-side
 * so no credentials ever reach the browser (Req 16.3, 19).
 *
 * The non-AI ports (`map` / `storage` / `auth`) are still contract stubs: each
 * class `implements` its port for compile-time contract verification (Req 16.4)
 * but throws `AWS_NOT_CONFIGURED` at runtime. The hybrid `createGateway` keeps
 * those backed by the mock adapters until they are wired, so the app stays fully
 * functional while the AI features run for real.
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
    chat: new AwsChatAdapter(env),
    map: new AwsMapLocationAdapter(),
    storage: new AwsStorageAdapter(),
    auth: new AwsAuthAdapter(),
    translate: new AwsTranslateAdapter(env),
    image: new AwsImageAdapter(env),
  };
}
