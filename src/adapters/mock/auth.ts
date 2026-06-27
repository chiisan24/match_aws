/**
 * Mock AuthPort adapter (email + password).
 *
 * Login succeeds for any well-formed credentials (valid-looking email + a
 * password meeting a minimum length) and establishes a session (Req 15.1).
 * The `remember` flag controls persistence: when true the session is saved via
 * the StoragePort with a future `expiresAt` and survives a fresh adapter (a
 * reload); when false it is session-only (`expiresAt: null`) and not persisted
 * (Req 15.2 / Properties 26–28). Malformed credentials yield `null` (Req 15.3).
 */

import type { AuthPort, Session, StoragePort } from "../../ports";
import { MockStorageAdapter } from "./storage";

/** Remembered sessions stay valid for 30 days (mock). */
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 6;

/** Conservative well-formed-email check (mock-grade, not RFC-complete). */
function isWellFormedEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isWellFormedPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/** Derives a stable mock user id from the email local-part. */
function userIdFor(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `mock-user:${normalized}`;
}

export class MockAuthAdapter implements AuthPort {
  private current: Session | null = null;

  constructor(private readonly storage: StoragePort = new MockStorageAdapter()) {}

  async login(
    email: string,
    password: string,
    remember: boolean,
  ): Promise<Session | null> {
    if (!isWellFormedEmail(email) || !isWellFormedPassword(password)) {
      return null;
    }

    const session: Session = {
      userId: userIdFor(email),
      email: email.trim(),
      expiresAt: remember
        ? new Date(Date.now() + REMEMBER_DURATION_MS).toISOString()
        : null,
    };

    this.current = session;
    if (remember) {
      // Persist only when asked to be remembered, so a fresh adapter (reload)
      // can restore it (Property 27).
      await this.storage.save("session", session);
    } else {
      // Ensure no stale remembered session lingers.
      await this.storage.save("session", null);
    }
    return session;
  }

  async logout(): Promise<void> {
    this.current = null;
    await this.storage.save("session", null);
  }

  async currentSession(): Promise<Session | null> {
    if (this.current) return this.current;
    // Fall back to a persisted (remembered) session, e.g. after a reload.
    const persisted = await this.storage.load<Session>("session");
    if (persisted) {
      this.current = persisted;
    }
    return persisted;
  }
}
