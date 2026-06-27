/**
 * AWS TranslatePort adapter (Amazon Translate — placeholder).
 *
 * Contract stub: `implements TranslatePort` for compile-time contract
 * verification (Req 16.4). Throws at runtime until real Translate wiring is
 * added.
 */

import type { LangCode, TranslatePort } from "../../ports";
import { AWS_NOT_CONFIGURED } from "./not-configured";

export class AwsTranslateAdapter implements TranslatePort {
  async translate(_text: string, _target: LangCode): Promise<string> {
    throw new Error(AWS_NOT_CONFIGURED("TranslatePort.translate"));
  }
}
