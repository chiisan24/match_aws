/**
 * Mock adapters — in-memory + localStorage implementations of the ports.
 * Default backend when no AWS connection info is configured (Req 16.2, 17.3).
 *
 * Each adapter implements the exact same port contract as its future `aws/`
 * counterpart (Req 16.1, 16.4). The `createGateway` factory that selects
 * between mock and aws is added in task 2.3.
 */

import type { AwsGateway } from "../../ports";
import { MockStorageAdapter } from "./storage";
import { MockChatAdapter } from "./chat";
import { MockMapLocationAdapter } from "./map";
import { MockAuthAdapter } from "./auth";
import { MockTranslateAdapter } from "./translate";
import { MockImageAdapter } from "./image";

export { MockStorageAdapter } from "./storage";
export { MockChatAdapter } from "./chat";
export { MockMapLocationAdapter } from "./map";
export { MockAuthAdapter } from "./auth";
export { MockTranslateAdapter } from "./translate";
export { MockImageAdapter } from "./image";

// Fixed mock datasets, exposed for reuse by UI/dev tooling and tests.
export { EHIME_TEMPLES } from "./temples";
export { EHIME_SPOTS } from "./spots";
export { buildLayerFeatures } from "./layers";

/**
 * Builds the mock-backed gateway — the default backend when no AWS connection
 * info is configured (Req 16.2, 17.3). The return type is annotated as
 * `AwsGateway`, so any drift between a mock adapter and its port contract is a
 * compile error (Req 16.4). A single shared `MockStorageAdapter` is reused so
 * the auth adapter and the rest of the app see the same persisted state.
 */
export function createMockGateway(): AwsGateway {
  const storage = new MockStorageAdapter();
  return {
    chat: new MockChatAdapter(),
    map: new MockMapLocationAdapter(),
    storage,
    auth: new MockAuthAdapter(storage),
    translate: new MockTranslateAdapter(),
    image: new MockImageAdapter(),
  };
}
