/**
 * NokyochoView — the デジタル納経帳 screen for the お遍路モード "nokyocho" tab
 * (Req 10) plus the entry into the 行った/行ってない初期設定 (Req 11.1).
 *
 * It hosts two sub-views, switched with `view`:
 *
 *  - **records** (default): the digital nokyocho. A 記録する form captures a
 *    visit — 札所名・訪問日・写真・メモ・当日のルート・感想 (Req 10.1) — appending it to
 *    the shared {@link usePilgrimage} visit-record store (persisted under
 *    `"visitRecords"`, Req 10.5 / Property 12). Below it, the recorded 札所 are
 *    listed with their訪問日 (Req 10.2); selecting one expands its saved content
 *    — 訪問日・写真・メモ・ルート・感想 (Req 10.3). Attached photos are kept on the
 *    record (Req 10.4); in the MVP they are read as local data URLs (Q6 — no
 *    upload), so they persist with the record through the storage port.
 *
 *  - **setup**: the {@link VisitTrackerScroll} 行った/行ってない初期設定. On first
 *    entry into お遍路モード (no visits recorded yet and nothing marked visited)
 *    the screen opens here so the user can set their巡礼進捗 initial value
 *    (Req 11.1); it is also reachable any time via the 初期設定 entry button.
 *
 * Recording a visit here also marks the 札所 visited, so the納経帳 and the
 * 巡礼進捗ダッシュボード / 札所マップ stay in agreement (Req 11.4) — all three read
 * the same visited set / records from the shared store. Persistence is resilient
 * end-to-end: a failed save never throws and the on-screen state stands
 * (Req 11.5).
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { usePilgrimage } from "../../app/PilgrimageContext";
import type { Temple, VisitRecord } from "../../domain/types";
import type { MapLocationPort } from "../../ports";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { SectionHeader } from "../components/SectionHeader";
import { Tag } from "../components/Tag";
import { VisitTrackerScroll } from "./VisitTrackerScroll";

export interface NokyochoViewProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
}

type View = "records" | "setup";

/** Today's date as a `YYYY-MM-DD` string for the date input default. */
function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function NokyochoView({ map }: NokyochoViewProps): JSX.Element {
  const { t } = useI18n();
  const {
    area,
    visited,
    setVisited,
    visitRecords,
    addVisitRecord,
  } = usePilgrimage();

  const [temples, setTemples] = useState<Temple[]>([]);
  const [loading, setLoading] = useState(true);

  // First-run heuristic: with nothing recorded and nothing marked visited, open
  // the 行った/行ってない初期設定 so the user sets their starting progress (Req
  // 11.1). Computed once on mount so it never yanks the view out from under the
  // user as they start interacting.
  const firstRun = useRef(visitRecords.length === 0 && visited.size === 0);
  const [view, setView] = useState<View>(
    firstRun.current ? "setup" : "records",
  );

  // Load the selected area's temples for the名前 lookup, the record form's 札所
  // picker and the初期設定 deck (mock by default — Req 8.5).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const loaded = await map.getTemples(area);
        if (!cancelled) setTemples(loaded);
      } catch {
        if (!cancelled) setTemples([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, area]);

  // templeId → Temple for resolving names in the records list/detail.
  const templeById = useMemo(() => {
    const m = new Map<string, Temple>();
    for (const tm of temples) m.set(tm.id, tm);
    return m;
  }, [temples]);

  if (view === "setup") {
    return (
      <VisitTrackerScroll
        temples={temples}
        visited={visited}
        onSetVisited={setVisited}
        onDone={() => setView("records")}
        loading={loading}
      />
    );
  }

  return (
    <section className="nokyocho" aria-labelledby="nokyocho-heading">
      <SectionHeader
        eyebrow="NOKYOCHO"
        title={<span id="nokyocho-heading">{t("nokyocho.title")}</span>}
        action={
          <Button
            variant="ghost"
            size="sm"
            leading="🗂"
            onClick={() => setView("setup")}
          >
            {t("nokyocho.openSetup")}
          </Button>
        }
      />
      <p className="nokyocho__lead">{t("nokyocho.lead")}</p>

      <RecordForm
        temples={temples}
        onSave={(record) => {
          addVisitRecord(record);
          // Recording a visit also marks the 札所 visited so progress/map agree
          // (Req 11.4).
          setVisited(record.templeId, true);
        }}
      />

      <RecordList records={visitRecords} templeById={templeById} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 記録する form (Req 10.1)
// ---------------------------------------------------------------------------

interface RecordFormProps {
  temples: Temple[];
  onSave: (record: VisitRecord) => void;
}

function RecordForm({ temples, onSave }: RecordFormProps): JSX.Element {
  const { t } = useI18n();
  const ordered = useMemo(
    () => [...temples].sort((a, b) => a.number - b.number),
    [temples],
  );

  const [templeId, setTempleId] = useState("");
  const [visitDate, setVisitDate] = useState(todayIso());
  const [photos, setPhotos] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [route, setRoute] = useState("");
  const [impression, setImpression] = useState("");
  const [saved, setSaved] = useState(false);

  // Default the 札所 picker to the first temple once data loads.
  useEffect(() => {
    if (!templeId && ordered.length > 0) {
      setTempleId(ordered[0].id);
    }
  }, [ordered, templeId]);

  // Read selected photo files as local data URLs (MVP: local-only, no upload —
  // Q6). They persist with the record via the storage port (Req 10.4).
  const onPickPhotos = (files: FileList | null): void => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const canSave = templeId !== "" && visitDate !== "";

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!canSave) return;
    const record: VisitRecord = {
      templeId,
      visitDate,
      photos,
      memo: memo.trim() || undefined,
      route: route.trim() || undefined,
      impression: impression.trim() || undefined,
    };
    onSave(record);
    // Reset the editable fields (keep the date) and confirm.
    setPhotos([]);
    setMemo("");
    setRoute("");
    setImpression("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };

  return (
    <Card className="nokyocho-form" blob raised>
      <form onSubmit={handleSubmit} aria-label={t("nokyocho.form.title")}>
        <h3 className="nokyocho-form__title">{t("nokyocho.form.title")}</h3>

        <label className="nokyocho-field">
          <span className="nokyocho-field__label">
            {t("nokyocho.form.temple")}
          </span>
          <select
            className="nokyocho-field__control"
            value={templeId}
            onChange={(e) => setTempleId(e.target.value)}
            data-testid="nokyocho-temple"
          >
            {ordered.length === 0 && (
              <option value="">{t("nokyocho.form.noTemples")}</option>
            )}
            {ordered.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.number}　{tm.name}
              </option>
            ))}
          </select>
        </label>

        <label className="nokyocho-field">
          <span className="nokyocho-field__label">
            {t("nokyocho.form.date")}
          </span>
          <input
            type="date"
            className="nokyocho-field__control"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            data-testid="nokyocho-date"
          />
        </label>

        <div className="nokyocho-field">
          <span className="nokyocho-field__label">
            {t("nokyocho.form.photos")}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="nokyocho-field__file"
            onChange={(e) => onPickPhotos(e.target.files)}
            data-testid="nokyocho-photos"
          />
          <span className="nokyocho-field__hint">
            {t("nokyocho.form.photosHint")}
          </span>
          {photos.length > 0 && (
            <ul className="nokyocho-thumbs" role="list">
              {photos.map((src, i) => (
                <li key={i} className="nokyocho-thumbs__item">
                  <img
                    src={src}
                    alt={t("nokyocho.form.photoAlt").replace(
                      "{n}",
                      String(i + 1),
                    )}
                    className="nokyocho-thumbs__img"
                  />
                  <button
                    type="button"
                    className="nokyocho-thumbs__remove"
                    aria-label={t("nokyocho.form.removePhoto")}
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="nokyocho-field">
          <span className="nokyocho-field__label">
            {t("nokyocho.form.memo")}
          </span>
          <textarea
            className="nokyocho-field__control"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t("nokyocho.form.memoPlaceholder")}
          />
        </label>

        <label className="nokyocho-field">
          <span className="nokyocho-field__label">
            {t("nokyocho.form.route")}
          </span>
          <input
            type="text"
            className="nokyocho-field__control"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            placeholder={t("nokyocho.form.routePlaceholder")}
          />
        </label>

        <label className="nokyocho-field">
          <span className="nokyocho-field__label">
            {t("nokyocho.form.impression")}
          </span>
          <textarea
            className="nokyocho-field__control"
            rows={3}
            value={impression}
            onChange={(e) => setImpression(e.target.value)}
            placeholder={t("nokyocho.form.impressionPlaceholder")}
          />
        </label>

        <Button type="submit" variant="accent" block leading="🖌" disabled={!canSave}>
          {t("nokyocho.form.save")}
        </Button>
        {saved && (
          <p className="nokyocho-form__saved" role="status">
            {t("nokyocho.form.saved")}
          </p>
        )}
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recorded 札所 list + detail (Req 10.2, 10.3)
// ---------------------------------------------------------------------------

interface RecordListProps {
  records: readonly VisitRecord[];
  templeById: Map<string, Temple>;
}

/** Format an ISO date for display, gracefully tolerating odd values. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${m}.${day}`;
}

function RecordList({ records, templeById }: RecordListProps): JSX.Element {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Newest first, by visit date.
  const ordered = useMemo(
    () =>
      records
        .map((record, index) => ({ record, index }))
        .sort(
          (a, b) =>
            new Date(b.record.visitDate).getTime() -
            new Date(a.record.visitDate).getTime(),
        ),
    [records],
  );

  return (
    <div className="nokyocho-list">
      <h3 className="nokyocho-list__title">
        {t("nokyocho.list.title")}
        <span className="nokyocho-list__count">
          {t("nokyocho.list.count").replace("{count}", String(records.length))}
        </span>
      </h3>

      {records.length === 0 ? (
        <Card className="nokyocho-empty" blob>
          <div className="nokyocho-empty__art">
            <PlaceholderImage
              motif="temple"
              label={t("nokyocho.empty.label")}
              sublabel={t("nokyocho.empty.sub")}
              aspectRatio="4 / 3"
            />
          </div>
          <p className="nokyocho-empty__note">{t("nokyocho.empty.note")}</p>
        </Card>
      ) : (
        <ul className="nokyocho-records" role="list">
          {ordered.map(({ record, index }) => {
            const temple = templeById.get(record.templeId);
            const name = temple
              ? `${temple.number}　${temple.name}`
              : record.templeId;
            const isOpen = openIndex === index;
            return (
              <li key={index} className="nokyocho-records__item">
                <Card className="nokyocho-record" blob raised padded={false}>
                  <button
                    type="button"
                    className="nokyocho-record__head"
                    data-testid="nokyocho-record"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span className="nokyocho-record__badge" aria-hidden="true">
                      {temple?.number ?? "—"}
                    </span>
                    <span className="nokyocho-record__titles">
                      <span className="nokyocho-record__name">{name}</span>
                      <span className="nokyocho-record__date">
                        {formatDate(record.visitDate)}
                      </span>
                    </span>
                    <span className="nokyocho-record__chevron" aria-hidden="true">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      className="nokyocho-record__detail"
                      data-testid="nokyocho-detail"
                    >
                      <RecordDetail record={record} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecordDetail({ record }: { record: VisitRecord }): JSX.Element {
  const { t } = useI18n();
  return (
    <>
      <div className="nokyocho-detail__photos">
        {record.photos.length > 0 ? (
          <ul className="nokyocho-detail__gallery" role="list">
            {record.photos.map((src, i) => (
              <li key={i}>
                <img
                  src={src}
                  alt={t("nokyocho.form.photoAlt").replace("{n}", String(i + 1))}
                  className="nokyocho-detail__photo"
                />
              </li>
            ))}
          </ul>
        ) : (
          <PlaceholderImage
            motif="temple"
            sublabel={t("nokyocho.detail.noPhotos")}
            aspectRatio="4 / 3"
          />
        )}
      </div>

      <dl className="nokyocho-detail__facts">
        <div className="nokyocho-detail__fact">
          <dt>{t("nokyocho.form.date")}</dt>
          <dd>{formatDate(record.visitDate)}</dd>
        </div>
        {record.route && (
          <div className="nokyocho-detail__fact">
            <dt>{t("nokyocho.form.route")}</dt>
            <dd>{record.route}</dd>
          </div>
        )}
      </dl>

      {record.memo && (
        <div className="nokyocho-detail__block">
          <span className="nokyocho-detail__label">
            {t("nokyocho.form.memo")}
          </span>
          <p className="nokyocho-detail__text">{record.memo}</p>
        </div>
      )}

      {record.impression && (
        <div className="nokyocho-detail__block">
          <span className="nokyocho-detail__label">
            {t("nokyocho.form.impression")}
          </span>
          <p className="nokyocho-detail__text">{record.impression}</p>
        </div>
      )}

      {!record.memo && !record.impression && !record.route && (
        <p className="nokyocho-detail__sparse">
          <Tag tone="teal">{t("nokyocho.detail.recordedOnly")}</Tag>
        </p>
      )}
    </>
  );
}
