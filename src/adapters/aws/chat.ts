/**
 * AWS ChatPort adapter (Amazon Bedrock — placeholder).
 *
 * This is a contract stub: it `implements ChatPort` so the TypeScript compiler
 * verifies it stays in lockstep with the shared port contract (Req 16.4), but
 * it performs no real AWS calls yet. Every method throws `AWS_NOT_CONFIGURED`
 * at runtime. Real Bedrock wiring lands in a later phase; until then the
 * default path returns the mock gateway (Req 16.2, 17.3).
 */

import type {
  ChatPort,
  ChatReply,
  ChatSession,
  PilgrimagePlan,
  PlanInput,
} from "../../ports";
import { AWS_NOT_CONFIGURED } from "./not-configured";

export class AwsChatAdapter implements ChatPort {
  async sendMessage(
    _session: ChatSession,
    _message: string,
  ): Promise<ChatReply> {
    throw new Error(AWS_NOT_CONFIGURED("ChatPort.sendMessage"));
  }

  async generatePilgrimagePlan(_input: PlanInput): Promise<PilgrimagePlan> {
    throw new Error(AWS_NOT_CONFIGURED("ChatPort.generatePilgrimagePlan"));
  }
}
