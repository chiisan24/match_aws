/**
 * `createGateway(env)` — the AWS_Gateway factory.
 *
 * Selects backends based on environment:
 *   - No API endpoint (the default on Vercel) -> mock AI ports (Req 16.2, 17.3).
 *   - `VITE_AWS_API_ENDPOINT` set -> real AI ports (chat / translate / image)
 *     over the serverless backend (Req 16.3).
 *   - `VITE_MAP_ENABLED` set -> real interactive-map location port (browser
 *     geolocation + curated temples; tiles via MapLibre/OSM in MapCanvas, Req 20).
 *   Any non-AI ports that are not swapped in stay on the mock adapters, so the
 *   app keeps working as features are enabled independently.
 *
 * Contract verification (Req 16.4, 16.5) is enforced two ways:
 *   1. Type level — the adapter classes `implements` their ports, and the
 *      factories are annotated `AwsGateway`. Any drift is a compile error, so
 *      `tsc --noEmit` (part of `npm run build`) fails the build/deploy.
 *   2. Runtime — `verifyGatewayContract` checks that the assembled gateway
 *      exposes the same ports with the same method names as the mock reference,
 *      throwing if they diverge.
 */

import type { AwsGateway } from "../ports";
import { GATEWAY_PORT_NAMES } from "../ports";
import { awsEnv, type AwsEnv } from "../config/env";
import { createMockGateway } from "../adapters/mock";
import {
  AwsChatAdapter,
  AwsTranslateAdapter,
  AwsImageAdapter,
  AwsMapLocationAdapter,
} from "../adapters/aws";

/**
 * Returns the gateway appropriate for the given environment. Defaults to the
 * process AWS env, so `createGateway()` with no argument does the right thing.
 */
export function createGateway(env: AwsEnv = awsEnv): AwsGateway {
  let gateway: AwsGateway = createMockGateway();
  let customized = false;

  // Real AI ports over the serverless backend (Bedrock / Translate).
  if (env.hasAwsConfig) {
    gateway = {
      ...gateway,
      chat: new AwsChatAdapter(env),
      translate: new AwsTranslateAdapter(env),
      image: new AwsImageAdapter(env),
    };
    customized = true;
  }

  // Real interactive map → browser-backed location port (Req 20). Independent
  // of the AI backend; tiles are open (OSM) and need no AWS.
  if (env.mapEnabled) {
    gateway = { ...gateway, map: new AwsMapLocationAdapter() };
    customized = true;
  }

  // Fail fast if any swapped-in adapter has drifted from the mock contract.
  if (customized) verifyGatewayContract(gateway);
  return gateway;
}

/** Lists the own + prototype method names of an object, sorted for comparison. */
function methodNamesOf(target: object): string[] {
  const names = new Set<string>();
  let current: object | null = target;
  while (current && current !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === "constructor") continue;
      if (typeof (target as Record<string, unknown>)[name] === "function") {
        names.add(name);
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return [...names].sort();
}

/**
 * Runtime contract check (Req 16.4, 16.5): verifies that the supplied gateway
 * exposes the same ports — with the same method names — as the reference mock
 * gateway. Throws if a port is missing or its method set diverges, which a
 * deploy/build step can surface as a hard failure.
 */
export function verifyGatewayContract(gateway: AwsGateway): void {
  const reference = createMockGateway();

  for (const port of GATEWAY_PORT_NAMES) {
    const refPort = reference[port] as unknown as object | undefined;
    const candidate = gateway[port] as unknown as object | undefined;

    if (candidate == null) {
      throw new Error(
        `Gateway contract mismatch: missing port "${port}".`,
      );
    }

    const expected = methodNamesOf(refPort as object);
    const actual = methodNamesOf(candidate);

    const missing = expected.filter((m) => !actual.includes(m));
    const extra = actual.filter((m) => !expected.includes(m));

    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `Gateway contract mismatch on port "${port}": ` +
          `missing [${missing.join(", ")}], unexpected [${extra.join(", ")}].`,
      );
    }
  }
}
