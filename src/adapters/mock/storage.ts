/**
 * Mock StoragePort adapter.
 *
 * Backed by browser `localStorage` when available, with an in-memory fallback
 * for non-browser / test environments. All values are JSON-serialized so that
 * `save` then `load` yields a structurally-equal but independent copy — the
 * same round-trip semantics real `localStorage` provides (Property 12).
 *
 * The offline arrival-log queue (Req 13.5, 13.6) is implemented with an
 * IDEMPOTENT sync: `flushOffline` returns every queued entry and clears the
 * queue, so a second flush returns an empty list — no duplicate sync
 * (Property 24).
 */

import type { OfflineEntry, StorageKey, StoragePort } from "../../ports";

/** Minimal key/value backend shared by the localStorage and memory variants. */
interface KeyValueBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Prefix keeps mock data from colliding with other localStorage usage. */
const NAMESPACE = "ehime-tourism-app:mock:";

/** The dedicated key under which the offline arrival queue is persisted. */
const OFFLINE_QUEUE_KEY: StorageKey = "offlineQueue";

/**
 * Returns a working `localStorage` if the environment provides one that can
 * actually be written to; otherwise `null` (e.g. SSR, locked-down browsers,
 * or a test runner without DOM). A write probe is used because some
 * environments expose the object but throw on access.
 */
function detectLocalStorage(): Storage | null {
  try {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (!candidate) return null;
    const probe = `${NAMESPACE}__probe__`;
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return null;
  }
}

/** In-memory backend used when no usable `localStorage` exists. */
function createMemoryBackend(): KeyValueBackend {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
}

/** Wraps a real `Storage` as a {@link KeyValueBackend}. */
function createLocalStorageBackend(storage: Storage): KeyValueBackend {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
  };
}

export class MockStorageAdapter implements StoragePort {
  private readonly backend: KeyValueBackend;

  constructor(backend?: KeyValueBackend) {
    const localStorageBackend = detectLocalStorage();
    this.backend =
      backend ??
      (localStorageBackend
        ? createLocalStorageBackend(localStorageBackend)
        : createMemoryBackend());
  }

  private namespaced(key: StorageKey): string {
    return `${NAMESPACE}${key}`;
  }

  async load<T>(key: StorageKey): Promise<T | null> {
    const raw = this.backend.getItem(this.namespaced(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupted entry — treat as absent rather than throwing.
      return null;
    }
  }

  async save<T>(key: StorageKey, value: T): Promise<void> {
    this.backend.setItem(this.namespaced(key), JSON.stringify(value));
  }

  private readQueue(): OfflineEntry[] {
    const raw = this.backend.getItem(this.namespaced(OFFLINE_QUEUE_KEY));
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw) as OfflineEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeQueue(entries: OfflineEntry[]): void {
    this.backend.setItem(
      this.namespaced(OFFLINE_QUEUE_KEY),
      JSON.stringify(entries),
    );
  }

  async enqueueOffline(entry: OfflineEntry): Promise<void> {
    const queue = this.readQueue();
    queue.push(entry);
    this.writeQueue(queue);
  }

  async flushOffline(): Promise<OfflineEntry[]> {
    const queue = this.readQueue();
    // Idempotent sync: hand back everything queued and clear it, so a second
    // flush returns [] and nothing is synced twice (Req 13.6, Property 24).
    this.backend.removeItem(this.namespaced(OFFLINE_QUEUE_KEY));
    return queue;
  }
}
