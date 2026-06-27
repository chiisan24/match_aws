/**
 * AWS StoragePort adapter (DynamoDB / S3 — placeholder).
 *
 * Contract stub: `implements StoragePort` for compile-time contract
 * verification (Req 16.4). Throws at runtime until real DynamoDB/S3 wiring is
 * added. Photo persistence (Req 10.4, 10.5) will be backed by S3 here without
 * changing the interface contract.
 */

import type { OfflineEntry, StorageKey, StoragePort } from "../../ports";
import { AWS_NOT_CONFIGURED } from "./not-configured";

export class AwsStorageAdapter implements StoragePort {
  async load<T>(_key: StorageKey): Promise<T | null> {
    throw new Error(AWS_NOT_CONFIGURED("StoragePort.load"));
  }

  async save<T>(_key: StorageKey, _value: T): Promise<void> {
    throw new Error(AWS_NOT_CONFIGURED("StoragePort.save"));
  }

  async enqueueOffline(_entry: OfflineEntry): Promise<void> {
    throw new Error(AWS_NOT_CONFIGURED("StoragePort.enqueueOffline"));
  }

  async flushOffline(): Promise<OfflineEntry[]> {
    throw new Error(AWS_NOT_CONFIGURED("StoragePort.flushOffline"));
  }
}
