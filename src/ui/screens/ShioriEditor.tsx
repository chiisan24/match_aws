/**
 * ShioriEditor — the しおり（旅程）editor for the 通常観光モード "shiori" tab
 * (Req 6.1–6.4), with プラン共有 embedded (Req 7).
 *
 * Behaviour:
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
 * Purely presentational over the store, so it stays testable: a test wraps it in
 * a {@link TourismProvider}, seeds the しおり via swipes / addToShiori, and drives
 * the move / remove buttons.
 */

import { useMemo, useState } from "react";

import { useTourism } from "../../app/TourismContext";
import {
  itineraryMapItems,
  itinerarySummary,
} from "../../domain/savedItinerary";
import type { SharePlan } from "../../domain/share";
import type { LangCode, SavedItinerary, Spot } from "../../domain/types";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { GoogleTourismMap } from "../components/GoogleTourismMap";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { Tag } from "../components/Tag";
import { PlanShare } from "./PlanShare";

/** Resolve a spot's description in the active language, falling back to ja. */
function localizedDescription(spot: Spot, lang: LangCode): string {
  return spot.localizedDescriptions[lang] ?? spot.localizedDescriptions.ja ?? "";
}

export function ShioriEditor(): JSX.Element {
  const { t, lang } = useI18n();
  const {
    shiori,
    removeFromShiori,
    reorderShiori,
    savedItinerary,
    clearItinerary,
  } = useTourism();

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
      </header>

      {/* 確定した行程（時刻 + 地図）。立寄先リストより先に置く: 「何時にどこへ」
          が当日いちばん知りたい情報で、下の一覧はその編集用という関係。 */}
      {savedItinerary ? (
        <ItineraryCard itinerary={savedItinerary} onClear={clearItinerary} />
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
 * The confirmed schedule: a summary line, a numbered map and a time-ordered
 * timeline.
 *
 * Built to be readable at a glance, which drives three choices:
 *  - the summary is one line of facts (stops / time span / length / transport)
 *    instead of prose;
 *  - the map numbers its pins with the itinerary position, so the map and the
 *    timeline below can be matched by eye without tapping anything;
 *  - the timeline shows time and name only. Descriptions live in the spot list
 *    underneath; repeating them here would bury the schedule.
 *
 * The saved date is rendered from the ISO prefix (`YYYY-MM-DD`) rather than a
 * locale format: it is stable across locales and time zones, needs no
 * per-language date pattern, and stays deterministic in tests.
 */
function ItineraryCard({
  itinerary,
  onClear,
}: {
  itinerary: SavedItinerary;
  onClear: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const items = useMemo(() => itineraryMapItems(itinerary), [itinerary]);
  const summary = useMemo(() => itinerarySummary(itinerary), [itinerary]);

  return (
    <section
      className="shiori-itinerary"
      aria-labelledby="shiori-itinerary-heading"
      data-testid="shiori-itinerary"
    >
      <header className="shiori-itinerary__header">
        <h3 id="shiori-itinerary-heading" className="shiori-itinerary__title">
          {itinerary.title}
        </h3>
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
        {itinerary.stops.map((stop, index) => (
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
            <span className="shiori-itinerary__stop-name">{stop.title}</span>
            <Tag tone={stop.kind === "food" || stop.kind === "cafe" ? "accent" : "teal"}>
              {t(`routeBuilder.kind.${stop.kind}`)}
            </Tag>
          </li>
        ))}
      </ol>

      <Button variant="ghost" size="sm" leading="✕" onClick={onClear}>
        {t("shiori.itinerary.clear")}
      </Button>
    </section>
  );
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
