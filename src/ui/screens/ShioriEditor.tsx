/**
 * ShioriEditor — the しおり（旅程）editor for the 通常観光モード "shiori" tab
 * (Req 6.1–6.4), with プラン共有 embedded (Req 7).
 *
 * The screen answers three questions, top to bottom:
 *
 *  1. **Which trip am I looking at?** Every confirmed route is saved as its own
 *     itinerary, so {@link ItineraryLibrary} lists the saved headings and
 *     switches between them. It only appears once there is more than one — with a
 *     single trip the card below already names it.
 *  2. **Can I get there from here?** {@link ItineraryAccess} puts the distance to
 *     the itinerary's starting point next to a per-transport estimate (walk /
 *     bike / car / transit), because "3 km away" means something different on
 *     foot than in a car. Every figure is a straight-line estimate and is
 *     labelled as such.
 *  3. **What is the plan?** {@link ItineraryCard} keeps the map plus the
 *     time-ordered timeline, and the spot list underneath stays the editable
 *     bag of places.
 *
 * Behaviour of the spot list (unchanged):
 *  - Lists the spots added to the しおり (`useTourism().shiori` — the spots
 *    swiped 上, Req 6.1), in their saved order (Req 6.2).
 *  - Reorders items with **accessible up/down move buttons** (each with an
 *    aria-label naming the spot) rather than drag-only, driving the pure
 *    {@link reorder} via `useTourism().reorderShiori` (Req 6.2, Property 11).
 *    Buttons disable at the list boundaries.
 *  - Removes an item with `useTourism().removeFromShiori` (Req 6.3,
 *    Property 10).
 *  - The しおり is persisted through the StoragePort under the `"shiori"` key by
 *    the {@link TourismProvider}; persistence is resilient, so reordering /
 *    removing keep working even if a save fails (Req 6.4).
 *  - Embeds {@link PlanShare}, handing it the current しおり as a shareable plan
 *    (Req 7.1–7.3).
 *
 * The only dependency it takes is the {@link MapLocationPort}, used once on mount
 * to read the current location. It is **optional**: without it the screen renders
 * exactly as before minus the distance block, which keeps the component mountable
 * in a test with nothing but a {@link TourismProvider}.
 */

import { useEffect, useMemo, useState } from "react";

import { useTourism } from "../../app/TourismContext";
import {
  itineraryMapItems,
  itinerarySummary,
  itineraryStartStop,
  MAX_SAVED_ITINERARIES,
} from "../../domain/savedItinerary";
import type { SharePlan } from "../../domain/share";
import {
  estimateTravelAllModes,
  formatDistanceMeters,
  splitDurationMinutes,
  straightLineMeters,
  type TravelEstimate,
  type TravelMode,
} from "../../domain/travelEstimate";
import type { GeoPoint, LangCode, SavedItinerary, Spot } from "../../domain/types";
import { useI18n } from "../../i18n";
import type { MapLocationPort } from "../../ports";
import { Button } from "../components/Button";
import { GoogleTourismMap } from "../components/GoogleTourismMap";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { Tag } from "../components/Tag";
import { PlanShare } from "./PlanShare";

/** Resolve a spot's description in the active language, falling back to ja. */
function localizedDescription(spot: Spot, lang: LangCode): string {
  return spot.localizedDescriptions[lang] ?? spot.localizedDescriptions.ja ?? "";
}

/**
 * What the screen knows about where the user is.
 *
 * Four states rather than `GeoPoint | null`, because the three "no coordinates"
 * cases need different words: still asking, asked and refused/failed, and never
 * asked at all. Showing 「現在地が分かりません」 while the request is still in
 * flight would send the user to their settings for nothing.
 */
type CurrentLocationState =
  | { status: "unsupported" }
  | { status: "locating" }
  | { status: "ready"; point: GeoPoint }
  | { status: "unavailable" };

/** Icons for the transport rows. Decorative — the label carries the meaning. */
const TRAVEL_MODE_ICONS: Readonly<Record<TravelMode, string>> = {
  walk: "🚶",
  bicycle: "🚲",
  car: "🚗",
  transit: "🚃",
};

export interface ShioriEditorProps {
  /**
   * Location backend used once on mount to read the current position. Omit to
   * render without the distance block (tests, or any caller with no gateway).
   */
  map?: MapLocationPort;
  /**
   * Start planning another trip. Omit to hide the button — a visible action that
   * does nothing is worse than no action.
   */
  onCreateItinerary?: () => void;
}

export function ShioriEditor({
  map,
  onCreateItinerary,
}: ShioriEditorProps = {}): JSX.Element {
  const { t, lang } = useI18n();
  const {
    shiori,
    removeFromShiori,
    reorderShiori,
    savedItineraries,
    savedItinerary,
    selectItinerary,
    renameItinerary,
    removeItinerary,
    clearItinerary,
  } = useTourism();

  const [location, setLocation] = useState<CurrentLocationState>(() =>
    map ? { status: "locating" } : { status: "unsupported" },
  );

  // Read the current location once per port. Single-shot rather than a watch:
  // the figures here are "roughly how far is this trip from me", which does not
  // need to track a moving user, and a watch would re-render the whole screen
  // every few seconds while the user is reordering stops.
  useEffect(() => {
    if (!map) {
      setLocation({ status: "unsupported" });
      return;
    }
    let cancelled = false;
    setLocation({ status: "locating" });
    void (async () => {
      try {
        const point = await map.getCurrentLocation();
        if (cancelled) return;
        setLocation(
          point ? { status: "ready", point } : { status: "unavailable" },
        );
      } catch {
        // A refused permission or a timeout is not an error the user can act on
        // here beyond checking their settings, which the message says.
        if (!cancelled) setLocation({ status: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map]);

  // The current しおり as a shareable plan for PlanShare (Req 7.1). Names are
  // carried so the recipient can read the plan without the catalogue.
  const plan = useMemo<SharePlan>(
    () => ({
      title: t("shiori.plan.title"),
      items: shiori.map((spot) => ({ id: spot.id, name: spot.name })),
    }),
    [shiori, t],
  );

  return (
    <section className="shiori" aria-labelledby="shiori-heading">
      <header className="shiori__header">
        <h2 id="shiori-heading" className="shiori__title">
          <span className="shiori__title-icon" aria-hidden="true">
            📖
          </span>
          {t("shiori.title")}
        </h2>
        <p className="shiori__lead">{t("shiori.lead")}</p>
        {/* しおりは何本でも作れる。ここが唯一の入口なので、保存済みが0件でも出す。 */}
        {onCreateItinerary ? (
          <Button
            variant="accent"
            size="sm"
            leading="＋"
            className="shiori__create"
            data-testid="shiori-create"
            onClick={onCreateItinerary}
          >
            {t("shiori.create")}
          </Button>
        ) : null}
      </header>

      {/* 保存済みしおりの切り替え。1件のときは下のカードが見出しを名乗るので出さない。 */}
      {savedItineraries.length > 1 ? (
        <ItineraryLibrary
          itineraries={savedItineraries}
          activeId={savedItinerary?.id ?? null}
          onSelect={selectItinerary}
          onRemove={removeItinerary}
        />
      ) : null}

      {/* 確定した行程（時刻 + 地図）。立寄先リストより先に置く: 「何時にどこへ」
          が当日いちばん知りたい情報で、下の一覧はその編集用という関係。
          key に id を与えているので、しおりを切り替えるとカード内の編集状態
          （見出しの下書き、選択中のピン）が持ち越されない。 */}
      {savedItinerary ? (
        <ItineraryCard
          key={savedItinerary.id}
          itinerary={savedItinerary}
          location={location}
          onRename={(title) => renameItinerary(savedItinerary.id, title)}
          onClear={clearItinerary}
        />
      ) : null}

      {shiori.length === 0 ? (
        <div className="shiori__empty" data-testid="shiori-empty">
          <PlaceholderImage
            motif="spot"
            label={t("shiori.empty.title")}
            sublabel={t("shiori.empty.lead")}
            aspectRatio="4 / 3"
          />
        </div>
      ) : (
        <ol className="shiori__list" data-testid="shiori-list">
          {shiori.map((spot, index) => (
            <li key={spot.id} className="shiori-item" data-testid={`shiori-item-${spot.id}`}>
              <span className="shiori-item__order" aria-hidden="true">
                {index + 1}
              </span>

              <span className="shiori-item__thumb">
                <SpotThumb spot={spot} />
              </span>

              <span className="shiori-item__meta">
                <span className="shiori-item__name">{spot.name}</span>
                <span className="shiori-item__desc">
                  {localizedDescription(spot, lang)}
                </span>
              </span>

              {/* Accessible reordering — up/down move buttons (Req 6.2). */}
              <span
                className="shiori-item__moves"
                role="group"
                aria-label={t("shiori.moveControls").replace("{name}", spot.name)}
              >
                <button
                  type="button"
                  className="shiori-item__move"
                  aria-label={t("shiori.moveUp").replace("{name}", spot.name)}
                  data-testid={`shiori-up-${spot.id}`}
                  disabled={index === 0}
                  onClick={() => reorderShiori(index, index - 1)}
                >
                  <span aria-hidden="true">▲</span>
                </button>
                <button
                  type="button"
                  className="shiori-item__move"
                  aria-label={t("shiori.moveDown").replace("{name}", spot.name)}
                  data-testid={`shiori-down-${spot.id}`}
                  disabled={index === shiori.length - 1}
                  onClick={() => reorderShiori(index, index + 1)}
                >
                  <span aria-hidden="true">▼</span>
                </button>
              </span>

              {/* Remove from しおり (Req 6.3). */}
              <button
                type="button"
                className="shiori-item__remove"
                aria-label={t("shiori.remove").replace("{name}", spot.name)}
                data-testid={`shiori-remove-${spot.id}`}
                onClick={() => removeFromShiori(spot.id)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* プラン共有 (Req 7) — shares the current しおり as a plan. */}
      <PlanShare plan={plan} />
    </section>
  );
}

/**
 * The saved-itinerary switcher.
 *
 * A list of headings and nothing else: date, stop count, and the two things you
 * can do to a saved trip (open it, delete it). It deliberately does *not*
 * summarise the schedule — that is the card's job, and repeating it here would
 * make the list as tall as the thing it is meant to help you navigate.
 *
 * The open entry is marked with `aria-current="true"` as well as a visible badge,
 * so "which one am I looking at" survives with the styles off.
 */
function ItineraryLibrary({
  itineraries,
  activeId,
  onSelect,
  onRemove,
}: {
  itineraries: SavedItinerary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <section
      className="shiori-library"
      aria-labelledby="shiori-library-heading"
      data-testid="shiori-library"
    >
      <header className="shiori-library__header">
        <h3 id="shiori-library-heading" className="shiori-library__title">
          {t("shiori.library.heading")}
          <span className="shiori-library__count">
            {t("shiori.library.count").replace(
              "{count}",
              String(itineraries.length),
            )}
          </span>
        </h3>
        <p className="shiori-library__lead">{t("shiori.library.lead")}</p>
      </header>

      <ul className="shiori-library__list">
        {itineraries.map((itinerary) => {
          const isActive = itinerary.id === activeId;
          return (
            <li
              key={itinerary.id}
              className={
                isActive
                  ? "shiori-library__item shiori-library__item--active"
                  : "shiori-library__item"
              }
              data-testid={`shiori-library-item-${itinerary.id}`}
            >
              <button
                type="button"
                className="shiori-library__open"
                aria-label={t("shiori.library.select").replace(
                  "{title}",
                  itinerary.title,
                )}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelect(itinerary.id)}
              >
                <span className="shiori-library__item-title">{itinerary.title}</span>
                <span className="shiori-library__item-meta">
                  <span>{itinerary.savedAt.slice(0, 10)}</span>
                  <span>
                    {t("shiori.itinerary.stops").replace(
                      "{count}",
                      String(itinerary.stops.length),
                    )}
                  </span>
                  {isActive ? (
                    <span className="shiori-library__badge">
                      {t("shiori.library.current")}
                    </span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                className="shiori-library__remove"
                aria-label={t("shiori.library.remove").replace(
                  "{title}",
                  itinerary.title,
                )}
                data-testid={`shiori-library-remove-${itinerary.id}`}
                onClick={() => onRemove(itinerary.id)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 上限に達してからではなく、達する前に伝える。次の保存で古いものが消える。 */}
      {itineraries.length >= MAX_SAVED_ITINERARIES ? (
        <p className="shiori-library__full" role="status">
          {t("shiori.library.full").replace(
            "{max}",
            String(MAX_SAVED_ITINERARIES),
          )}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The confirmed schedule: an editable heading, the access estimate, a numbered
 * map and a time-ordered timeline.
 *
 * Built to be readable at a glance, which drives four choices:
 *  - the heading is editable, because a library of trips called 「松山まちあるき」
 *    three times over cannot be managed;
 *  - the summary is one line of facts (stops / time span / length / transport)
 *    instead of prose;
 *  - the map numbers its pins with the itinerary position, so the map and the
 *    timeline below can be matched by eye without tapping anything;
 *  - the timeline shows time, name and — when the location is known — how far
 *    that stop is from the user. Descriptions live in the spot list underneath;
 *    repeating them here would bury the schedule.
 *
 * The saved date is rendered from the ISO prefix (`YYYY-MM-DD`) rather than a
 * locale format: it is stable across locales and time zones, needs no
 * per-language date pattern, and stays deterministic in tests.
 */
function ItineraryCard({
  itinerary,
  location,
  onRename,
  onClear,
}: {
  itinerary: SavedItinerary;
  location: CurrentLocationState;
  onRename: (title: string) => void;
  onClear: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // `null` means "not editing". A draft string (even an empty one) means the
  // field is open, which is why this is not `""`-as-closed.
  const [draftTitle, setDraftTitle] = useState<string | null>(null);

  const items = useMemo(() => itineraryMapItems(itinerary), [itinerary]);
  const summary = useMemo(() => itinerarySummary(itinerary), [itinerary]);

  const current = location.status === "ready" ? location.point : null;

  function commitRename(): void {
    if (draftTitle != null) onRename(draftTitle);
    setDraftTitle(null);
  }

  return (
    <section
      className="shiori-itinerary"
      aria-labelledby="shiori-itinerary-heading"
      data-testid="shiori-itinerary"
    >
      <header className="shiori-itinerary__header">
        {draftTitle == null ? (
          <div className="shiori-itinerary__title-row">
            <h3 id="shiori-itinerary-heading" className="shiori-itinerary__title">
              {itinerary.title}
            </h3>
            <button
              type="button"
              className="shiori-itinerary__rename"
              data-testid="shiori-itinerary-rename"
              onClick={() => setDraftTitle(itinerary.title)}
            >
              <span aria-hidden="true">✎</span> {t("shiori.itinerary.rename")}
            </button>
          </div>
        ) : (
          // A form so Enter submits — renaming is a one-field edit and reaching
          // for a button to confirm it would be the slowest part of the flow.
          <form
            className="shiori-itinerary__rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              commitRename();
            }}
          >
            <label
              className="shiori-itinerary__rename-label"
              htmlFor="shiori-itinerary-title-input"
            >
              {t("shiori.itinerary.renameLabel")}
            </label>
            <input
              id="shiori-itinerary-title-input"
              className="shiori-itinerary__rename-input"
              data-testid="shiori-itinerary-title-input"
              type="text"
              value={draftTitle}
              maxLength={60}
              autoFocus
              onChange={(event) => setDraftTitle(event.target.value)}
            />
            <span className="shiori-itinerary__rename-actions">
              <Button type="submit" variant="primary" size="sm">
                {t("shiori.itinerary.renameSave")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraftTitle(null)}
              >
                {t("shiori.itinerary.renameCancel")}
              </Button>
            </span>
          </form>
        )}

        <p className="shiori-itinerary__meta">
          <span>{t("shiori.itinerary.heading")}</span>
          <span>
            {t("shiori.itinerary.stops").replace(
              "{count}",
              String(summary.stopCount),
            )}
          </span>
          {summary.startTime && summary.endTime ? (
            <span>
              {t("shiori.itinerary.span")
                .replace("{start}", summary.startTime)
                .replace("{end}", summary.endTime)}
            </span>
          ) : null}
          {itinerary.duration ? <span>{itinerary.duration}</span> : null}
          {itinerary.transport ? <span>{itinerary.transport}</span> : null}
        </p>
        <p className="shiori-itinerary__saved">
          {t("shiori.itinerary.savedAt").replace(
            "{date}",
            itinerary.savedAt.slice(0, 10),
          )}
        </p>
      </header>

      {/* 現在地からのアクセス。位置情報を持たない呼び出し（テストなど）では出さない。 */}
      {location.status === "unsupported" ? null : (
        <ItineraryAccess itinerary={itinerary} location={location} />
      )}

      {/* 座標を持つ立寄先が2件以上あるときだけ経路を描く。1件では線が引けず、
          0件なら地図そのものに意味がないので出さない。 */}
      {items.length > 0 ? (
        <GoogleTourismMap
          className="shiori-itinerary__map"
          ariaLabel={itinerary.title}
          items={items}
          {...(itinerary.area ? { area: itinerary.area } : {})}
          {...(selectedId ? { selectedId } : {})}
          onSelect={(item) => setSelectedId(item.id)}
          showDirections={items.length > 1}
          fallback={
            <p className="shiori-itinerary__map-fallback">
              {t("shiori.itinerary.mapFallback")}
            </p>
          }
        />
      ) : null}

      <ol className="shiori-itinerary__timeline" data-testid="shiori-itinerary-timeline">
        {itinerary.stops.map((stop, index) => {
          const meters = straightLineMeters(current, stop.location);
          return (
            <li
              key={`${itinerary.id}:${index}`}
              className={
                selectedId === `${itinerary.id}:${index}`
                  ? "shiori-itinerary__stop shiori-itinerary__stop--selected"
                  : "shiori-itinerary__stop"
              }
            >
              <span className="shiori-itinerary__order" aria-hidden="true">
                {index + 1}
              </span>
              <time className="shiori-itinerary__time" dateTime={stop.time}>
                {stop.time}
              </time>
              <span className="shiori-itinerary__stop-name">
                {stop.title}
                {meters != null ? (
                  <span className="shiori-itinerary__stop-distance">
                    {t("shiori.access.stopDistance").replace(
                      "{distance}",
                      formatDistanceMeters(meters),
                    )}
                  </span>
                ) : null}
              </span>
              <Tag tone={stop.kind === "food" || stop.kind === "cafe" ? "accent" : "teal"}>
                {t(`routeBuilder.kind.${stop.kind}`)}
              </Tag>
            </li>
          );
        })}
      </ol>

      <Button variant="ghost" size="sm" leading="✕" onClick={onClear}>
        {t("shiori.itinerary.clear")}
      </Button>
    </section>
  );
}

/**
 * How far the itinerary's starting point is, per transport mode.
 *
 * The reference point is the **first stop that has coordinates**, not the nearest
 * one: the question the user is asking on this screen is "can I make the start of
 * this day from where I am", and answering it with the nearest stop would quietly
 * measure a different trip.
 *
 * One straight-line distance is shown once, then one row per mode with that
 * mode's route distance and duration. Splitting it that way is the whole point of
 * the block — 3 km is a 40-minute walk or a 10-minute drive, and a single
 * "distance" figure cannot say which of those the trip is.
 *
 * Every branch renders *something*: locating, unavailable, and "this schedule has
 * no coordinates at all" each get their own sentence, so the block never
 * collapses into an unexplained gap.
 */
function ItineraryAccess({
  itinerary,
  location,
}: {
  itinerary: SavedItinerary;
  location: Exclude<CurrentLocationState, { status: "unsupported" }>;
}): JSX.Element {
  const { t } = useI18n();

  const start = useMemo(() => itineraryStartStop(itinerary), [itinerary]);
  const current = location.status === "ready" ? location.point : null;

  const straightMeters = start ? straightLineMeters(current, start.location) : null;
  const estimates = useMemo<TravelEstimate[]>(
    () => (start ? estimateTravelAllModes(current, start.location) : []),
    [current, start],
  );

  return (
    <section
      className="shiori-access"
      aria-labelledby="shiori-access-heading"
      data-testid="shiori-access"
    >
      <h4 id="shiori-access-heading" className="shiori-access__heading">
        {t("shiori.access.heading")}
      </h4>

      {start == null ? (
        <p className="shiori-access__status">{t("shiori.access.noLocation")}</p>
      ) : (
        <>
          <p className="shiori-access__target">
            <span className="shiori-access__target-name">
              {t("shiori.access.startStop")
                .replace("{order}", String(start.order))
                .replace("{title}", start.stop.title)}
            </span>
            {straightMeters != null ? (
              <span className="shiori-access__straight">
                {t("shiori.access.straight").replace(
                  "{distance}",
                  formatDistanceMeters(straightMeters),
                )}
              </span>
            ) : null}
          </p>

          {location.status === "locating" ? (
            <p className="shiori-access__status" role="status">
              {t("shiori.access.locating")}
            </p>
          ) : null}

          {location.status === "unavailable" ? (
            <p className="shiori-access__status">
              {t("shiori.access.unavailable")}
            </p>
          ) : null}

          {estimates.length > 0 ? (
            <>
              <dl className="shiori-access__modes">
                {estimates.map((estimate) => (
                  <div
                    key={estimate.mode}
                    className="shiori-access__mode"
                    data-testid={`shiori-access-${estimate.mode}`}
                  >
                    <dt className="shiori-access__mode-name">
                      <span aria-hidden="true">
                        {TRAVEL_MODE_ICONS[estimate.mode]}
                      </span>{" "}
                      {t(`shiori.access.mode.${estimate.mode}`)}
                    </dt>
                    <dd className="shiori-access__mode-figures">
                      <span className="shiori-access__mode-distance">
                        {formatDistanceMeters(estimate.routeMeters)}
                      </span>
                      <span className="shiori-access__mode-duration">
                        {formatDurationLabel(estimate.minutes, t)}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="shiori-access__note">{t("shiori.access.note")}</p>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * Render a duration in minutes using the existing 「約{min}分」/「約{h}時間{m}分」/
 * 「約{h}時間」 patterns, so a travel time reads the same here as it does on the
 * 札所ナビ.
 */
function formatDurationLabel(
  minutes: number,
  t: (key: string) => string,
): string {
  const parts = splitDurationMinutes(minutes);
  if (parts.hours === 0) {
    return t("progress.next.minutesUnit").replace("{min}", String(parts.minutes));
  }
  if (parts.minutes === 0) {
    return t("progress.next.durationH").replace("{h}", String(parts.hours));
  }
  return t("progress.next.durationHm")
    .replace("{h}", String(parts.hours))
    .replace("{m}", String(parts.minutes));
}

/**
 * A spot thumbnail that renders the real image when usable and otherwise the
 * on-brand placeholder (Req 4.7). Stateless — falls back when no URL is present.
 */
function SpotThumb({ spot }: { spot: Spot }): JSX.Element {
  const url = spot.imageUrls[0];
  if (!url) {
    return <PlaceholderImage motif="spot" label={spot.name} aspectRatio="1 / 1" />;
  }
  return (
    <img
      className="shiori-item__img"
      src={url}
      alt={spot.name}
      loading="lazy"
    />
  );
}
