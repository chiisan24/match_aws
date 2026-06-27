/**
 * AWS AuthPort adapter (Amazon Cognito — placeholder).
 *
 * Contract stub: `implements AuthPort` for compile-time contract verification
 * (Req 16.4). Throws at runtime until real Cognito wiring is added.
 */

import type { AuthPort, Session } from "../../ports";
import { AWS_NOT_CONFIGURED } from "./not-configured";

export class AwsAuthAdapter implements AuthPort {
  async login(
    _email: string,
    _password: string,
    _remember: boolean,
  ): Promise<Session | null> {
    throw new Error(AWS_NOT_CONFIGURED("AuthPort.login"));
  }

  async logout(): Promise<void> {
    throw new Error(AWS_NOT_CONFIGURED("AuthPort.logout"));
  }

  async currentSession(): Promise<Session | null> {
    throw new Error(AWS_NOT_CONFIGURED("AuthPort.currentSession"));
  }
}
