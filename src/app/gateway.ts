/**
 * `createGateway(env)` — the AWS_Gateway factory.
 *
 * Selects between the mock and aws adapter families based on whether AWS
 * connection info is present:
 *   - No AWS env (the default on Vercel) -> mock gateway (Req 16.2, 17.3).
 *   - AWS env present                    -> aws gateway (Req 16.3).
 *
 * Contract verification (Req 16.4, 16.5) is enforced two ways:
 *   1. Type level — `createMockGateway()` and `createAwsGateway()` are both
 *      annotated to return `AwsGateway`, and the adapter classes `implements`
 *      their ports. Any drift between the mock and aws contracts is a compile
 *      error, so `tsc --noEmit` (part of `npm run build`) fails the build/deploy.
 *   2. Runtime — `verifyGatewayContract` checks that the mock and aws gateways
 *      expose the same ports with the same method names, throwing if they
 *      diverge. This guards against drift that escapes the type system.
 */

import type { AwsGateway } from "../ports";
import { GATEWAY_PORT_NAMES } from "../ports";
import { awsEnv, type AwsEnv } from "../config/env";
import { createMockGateway } from "../adapters/mock";
import { createAwsGateway } from "../adapters/aws";

/**
 * Returns the gateway appropriate for the given environment. Defaults to the
 * process AWS env, so `createGateway()` with no argument does the right thing.
 */
export function createGateway(env: AwsEnv = awsEnv): AwsGateway {
  if (env.hasAwsConfig) {
    const gateway = createAwsGateway(env);
    // Fail fast if the real adapters have drifted from the mock contract.
    verifyGatewayContract(gateway);
    return gateway;
  }
  return createMockGateway();
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
