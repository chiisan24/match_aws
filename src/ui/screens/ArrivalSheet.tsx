/**
 * 札所到着時の自動表示 — ArrivalSheet + ArrivalNotifier (Req 13 / Property 23, 24).
 *
 * Two pieces live here:
 *
 *  - {@link ArrivalSheet}: the presentational 到着シート. An accessible modal
 *    dialog that, on 到着, surfaces the 到着通知 plus the temple's 説明・歴史・
 *    見どころ・写真スポット (Req 13.1) and offers 「納経帳に記録」 and
 *    「しおりに追加」 actions (Req 13.2). Real dialog semantics: `role="dialog"`,
 *    `aria-modal`, labelled by its heading, initial focus moved inside, Escape
 *    + backdrop close, and a focus trap so keyboarding stays in the sheet.
 *
 *  - {@link ArrivalNotifier}: the wiring the 札所マップ tab mounts. It loads the
 *    selected area's temples through the {@link MapLocationPort}, builds a
 *    geofence (既定 100m) per temple and subscribes via
 *    `map.watchGeofences(...)` (Req 13.1). The mock never fires events (auto
 *    GPS is 後続フェーズ / Q5), so a manual 「到着をシミュレート」 affordance moves
 *    a simulated position onto a temple and confirms the arrival with the pure
 *    domain {@link isInsideGeofence} check — the same predicate the live watcher
 *    uses. When 現在地 is unavailable it still offers manual 到着記録 (Req 13.4).
 *
 *    Connectivity: an online/offline indicator (seeded from `navigator.onLine`,
 *    kept in sync with the browser's online/offline events, and toggleable for
 *    demos) drives the offline queue. Every 到着 is logged through
 *    `storage.enqueueOffline(...)`; while offline it stays queued locally
 *    (Req 13.5), and on reconnect it is synced with `storage.flushOffline()`,
 *    which is idempotent so nothing syncs twice (Req 13.6 / Property 24).
 *
 * Both are prop-driven (port + storage injected) so they stay testable — the
 * app passes `gateway.map` / `gateway.storage`; the mock backs them by default.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePilgrimage } from "../../app/PilgrimageContext";
import { isInsideGeofence } from "../../domain/geofence";
import type {
  Geofence,
  GeoPoint,
  OfflineEntry,
  Temple,
  VisitRecord,
} from "../../domain/types";
import type { MapLocationPort, StoragePort } from "../../ports";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";

/** Default geofence radius around each temple — 100m per the design (Req 13). */
export const GEOFENCE_RADIUS_METERS = 100;

// ---------------------------------------------------------------------------
// ArrivalSheet — presentational 到着シート (Req 13.1, 13.2)
// ---------------------------------------------------------------------------

export interface ArrivalSheetProps {
  /** The temple the user has arrived at. */
  temple: Temple;
  /** Resolved display language for the localized description. */
  lang: string;
  /** Whether this temple is already recorded in the 納経帳. */
  recorded: boolean;
  /** Whether this temple is already in the お遍路 しおり. */
  inShiori: boolean;
  /** 「納経帳に記録」 — register a visit record (Req 13.3). */
  onRecord: () => void;
  /** 「しおりに追加」 — add to the お遍路 しおり (Req 13.2). */
  onAddToShiori: () => void;
  /** Close the sheet. */
  onClose: () => void;
}

/** Selector for the focusable elements used by the focus trap. */
const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The 到着シート modal dialog. Self-contained accessibility: it moves focus to
 * the close button on mount, restores focus to the previously-focused element
 * on unmount, closes on Escape / backdrop click, and traps Tab within itself.
 */
export function ArrivalSheet({
  temple,
  lang,
  recorded,
  inShiori,
  onRecord,
  onAddToShiori,
  onClose,
}: ArrivalSheetProps): JSX.Element {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on open; restore it to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Escape to close + a simple Tab focus trap within the dialog.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const description =
    temple.localizedDescriptions[
      lang as keyof typeof temple.localizedDescriptions
    ] ??
    temple.localizedDescriptions.ja ??
    "";

  const headingId = "arrival-sheet-heading";

  return (
    <div
      className="arrival-overlay"
      data-testid="arrival-overlay"
      onClick={(e) => {
        // Backdrop click (not a click inside the sheet) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="arrival-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="arrival-sheet"
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <div className="arrival-sheet__bar" aria-hidden="true" />

        <div className="arrival-sheet__head">
          <span className="arrival-sheet__chime" aria-hidden="true">
            🔔
          </span>
          <div className="arrival-sheet__titles">
            <p className="arrival-sheet__notice">{t("arrival.notice")}</p>
            <h2 id={headingId} className="arrival-sheet__name">
              <span className="arrival-sheet__badge" aria-hidden="true">
                {temple.number}
              </span>
              {temple.name}
            </h2>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="arrival-sheet__close"
            aria-label={t("arrival.close")}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="arrival-sheet__body">
          {description && (
            <section className="arrival-sheet__section">
              <h3 className="arrival-sheet__label">{t("arrival.about")}</h3>
              <p className="arrival-sheet__text">{description}</p>
            </section>
          )}

          {temple.history && (
            <section className="arrival-sheet__section">
              <h3 className="arrival-sheet__label">{t("arrival.history")}</h3>
              <p className="arrival-sheet__text">{temple.history}</p>
            </section>
          )}

          {temple.highlights.length > 0 && (
            <section className="arrival-sheet__section">
              <h3 className="arrival-sheet__label">{t("arrival.highlights")}</h3>
              <ul className="arrival-sheet__chips" role="list">
                {temple.highlights.map((h) => (
                  <li key={h}>
                    <Tag tone="teal">{h}</Tag>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {temple.photoSpots.length > 0 && (
            <section className="arrival-sheet__section">
              <h3 className="arrival-sheet__label">{t("arrival.photoSpots")}</h3>
              <ul className="arrival-sheet__chips" role="list">
                {temple.photoSpots.map((s) => (
                  <li key={s}>
                    <Tag tone="accent" leading="📷">
                      {s}
                    </Tag>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="arrival-sheet__actions">
          <Button
            variant="accent"
            block
            leading="🖌"
            onClick={onRecord}
            disabled={recorded}
            data-testid="arrival-record"
          >
            {recorded ? t("arrival.recorded") : t("arrival.record")}
          </Button>
          <Button
            variant="soft"
            block
            leading="📖"
            onClick={onAddToShiori}
            disabled={inShiori}
            data-testid="arrival-shiori"
          >
            {inShiori ? t("arrival.inShiori") : t("arrival.addShiori")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArrivalNotifier — geofence watch + offline sync wiring (Req 13.1–13.6)
// ---------------------------------------------------------------------------

export interface ArrivalNotifierProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
  /** Storage backend for the offline arrival queue (`gateway.storage`). */
  storage: StoragePort;
}

/** Today's date as an ISO `YYYY-MM-DD` string for the recorded visit. */
function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Build the default 100m geofence for a temple. */
function fenceFor(temple: Temple): Geofence {
  return {
    templeId: temple.id,
    center: temple.location,
    radiusMeters: GEOFENCE_RADIUS_METERS,
  };
}

export function ArrivalNotifier({
  map,
  storage,
}: ArrivalNotifierProps): JSX.Element {
  const { t, lang } = useI18n();
  const {
    area,
    visited,
    isInShiori,
    addToShiori,
    addVisitRecord,
    setVisited,
  } = usePilgrimage();

  const [temples, setTemples] = useState<Temple[]>([]);
  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);

  // The temple whose 到着シート is open (null = closed).
  const [arrivedId, setArrivedId] = useState<string | null>(null);

  // Connectivity (Req 13.5, 13.6). Seeded from navigator.onLine; kept in sync
  // with browser events and toggleable for demos.
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true,
  );
  const [pending, setPending] = useState(0);
  const [lastSynced, setLastSynced] = useState(0);

  // Keep the latest online flag readable from the (stable) geofence callback.
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  // Flush the offline queue — idempotent, so safe to call freely (Property 24).
  const flush = useCallback(async (): Promise<void> => {
    try {
      const synced = await storage.flushOffline();
      setPending(0);
      if (synced.length > 0) setLastSynced(synced.length);
    } catch {
      // Sync failed — entries remain queued; the indicator keeps showing them.
    }
  }, [storage]);

  // Log a 到着 to the offline queue, then sync immediately when online (Req
  // 13.5/13.6). Resilient: a storage failure never blocks the UI.
  const logArrival = useCallback(
    async (templeId: string): Promise<void> => {
      const entry: OfflineEntry = {
        kind: "arrival",
        templeId,
        at: new Date().toISOString(),
      };
      try {
        await storage.enqueueOffline(entry);
        if (onlineRef.current) {
          await flush();
        } else {
          setPending((n) => n + 1);
        }
      } catch {
        // Ignore — keep the UI responsive.
      }
    },
    [storage, flush],
  );

  // Open the 到着シート and log the arrival. Stable so watchGeofences can hold
  // a single subscription for the lifetime of the temple set.
  const handleArrival = useCallback(
    (templeId: string): void => {
      setArrivedId(templeId);
      void logArrival(templeId);
    },
    [logArrival],
  );

  // Load temples + current location, then subscribe to geofence enter events
  // through the port (the mock is a no-op; the contract is honored — Req 13.1).
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    void (async () => {
      try {
        const [loadedTemples, loadedLocation] = await Promise.all([
          map.getTemples(area),
          map.getCurrentLocation(),
        ]);
        if (cancelled) return;
        setTemples(loadedTemples);
        setCurrent(loadedLocation);

        const fences = loadedTemples.map(fenceFor);
        unsubscribe = map.watchGeofences(fences, (templeId) => {
          handleArrival(templeId);
        });

        // If a real current location is already inside a fence, surface the
        // arrival immediately using the pure domain check (Req 13.1).
        if (loadedLocation) {
          const here = loadedTemples.find((temple) =>
            isInsideGeofence(loadedLocation, fenceFor(temple)),
          );
          if (here) handleArrival(here.id);
        }
      } catch {
        if (!cancelled) {
          setTemples([]);
          setCurrent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [map, area, handleArrival]);

  // Track browser connectivity so the indicator and queue reflect reality.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // On reconnect, sync anything queued while offline (Req 13.6).
  useEffect(() => {
    if (online && pending > 0) void flush();
  }, [online, pending, flush]);

  // Manually "arrive" at a temple: move a simulated position onto it and let
  // the domain geofence check confirm it — the same predicate the live watcher
  // relies on (Req 13.1 / Property 23). Demos without real GPS rely on this.
  const simulateArrival = useCallback(
    (temple: Temple): void => {
      if (isInsideGeofence(temple.location, fenceFor(temple))) {
        handleArrival(temple.id);
      }
    },
    [handleArrival],
  );

  const ordered = useMemo(
    () => [...temples].sort((a, b) => a.number - b.number),
    [temples],
  );

  const arrived = useMemo(
    () => temples.find((temple) => temple.id === arrivedId) ?? null,
    [temples, arrivedId],
  );

  const handleRecord = useCallback((): void => {
    if (!arrived) return;
    const record: VisitRecord = {
      templeId: arrived.id,
      visitDate: todayIso(),
      photos: [],
      route: undefined,
      memo: undefined,
      impression: undefined,
    };
    addVisitRecord(record);
    // Recording a 到着 also marks the 札所 visited so progress/map agree (Req
    // 13.3 / 11.4).
    setVisited(arrived.id, true);
  }, [arrived, addVisitRecord, setVisited]);

  const handleAddShiori = useCallback((): void => {
    if (arrived) addToShiori(arrived.id);
  }, [arrived, addToShiori]);

  return (
    <section className="arrival" aria-labelledby="arrival-heading">
      <SectionHeader
        eyebrow="ARRIVAL"
        title={<span id="arrival-heading">{t("arrival.title")}</span>}
      />
      <p className="arrival__lead">{t("arrival.lead")}</p>

      {/* Connectivity indicator (Req 13.5/13.6). */}
      <Card className="arrival-net" blob>
        <div className="arrival-net__row">
          <span
            className={
              "arrival-net__dot" +
              (online ? " arrival-net__dot--on" : " arrival-net__dot--off")
            }
            aria-hidden="true"
          />
          <span className="arrival-net__status" role="status">
            {online ? t("arrival.online") : t("arrival.offline")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOnline((v) => !v)}
            data-testid="arrival-toggle-net"
          >
            {online ? t("arrival.goOffline") : t("arrival.goOnline")}
          </Button>
        </div>
        {pending > 0 && (
          <p className="arrival-net__pending" data-testid="arrival-pending">
            {t("arrival.pending").replace("{count}", String(pending))}
          </p>
        )}
        {pending === 0 && lastSynced > 0 && (
          <p className="arrival-net__synced" data-testid="arrival-synced">
            {t("arrival.synced").replace("{count}", String(lastSynced))}
          </p>
        )}
      </Card>

      {/* 現在地の状態 + 手動到着記録への導線 (Req 13.4). */}
      {!loading && !current && (
        <p className="arrival__nogps" role="status">
          {t("arrival.noLocation")}
        </p>
      )}

      {/* 「到着をシミュレート」 — manual arrival affordance (auto GPS is 後続
          フェーズ; this keeps the sheet demoable and doubles as the manual
          到着記録 entry point for Req 13.4). */}
      <div className="arrival-sim">
        <h3 className="arrival-sim__title">{t("arrival.simulateTitle")}</h3>
        <p className="arrival-sim__hint">{t("arrival.simulateHint")}</p>
        {loading ? (
          <p className="arrival-sim__status" role="status">
            {t("arrival.loading")}
          </p>
        ) : ordered.length === 0 ? (
          <p className="arrival-sim__status">{t("arrival.empty")}</p>
        ) : (
          <ul className="arrival-sim__list" role="list">
            {ordered.map((temple) => (
              <li key={temple.id} className="arrival-sim__item">
                <button
                  type="button"
                  className="arrival-sim__btn"
                  data-testid="arrival-simulate"
                  onClick={() => simulateArrival(temple)}
                >
                  <span className="arrival-sim__num" aria-hidden="true">
                    {temple.number}
                  </span>
                  <span className="arrival-sim__name">{temple.name}</span>
                  {visited.has(temple.id) && (
                    <span className="arrival-sim__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {arrived && (
        <ArrivalSheet
          temple={arrived}
          lang={lang}
          recorded={visited.has(arrived.id)}
          inShiori={isInShiori(arrived.id)}
          onRecord={handleRecord}
          onAddToShiori={handleAddShiori}
          onClose={() => setArrivedId(null)}
        />
      )}
    </section>
  );
}
