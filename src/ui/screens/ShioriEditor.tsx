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

import { useMemo } from "react";

import { useTourism } from "../../app/TourismContext";
import type { SharePlan } from "../../domain/share";
import type { LangCode, Spot } from "../../domain/types";
import { useI18n } from "../../i18n";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { PlanShare } from "./PlanShare";

/** Resolve a spot's description in the active language, falling back to ja. */
function localizedDescription(spot: Spot, lang: LangCode): string {
  return spot.localizedDescriptions[lang] ?? spot.localizedDescriptions.ja ?? "";
}

export function ShioriEditor(): JSX.Element {
  const { t, lang } = useI18n();
  const { shiori, removeFromShiori, reorderShiori } = useTourism();

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
