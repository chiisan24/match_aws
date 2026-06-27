/**
 * FavoritesView — the お気に入り screen for the 通常観光モード "favorites" tab
 * (Req 5.1–5.4).
 *
 * Behaviour:
 *  - Lists the spots swiped 行きたい (favorites) from the tourism store
 *    (`useTourism().favorites`, Req 5.1).
 *  - Classifies saved items across four accessible tabs — すべて / スポット /
 *    しおり / プラン (Req 5.2). The split comes from the pure
 *    {@link classifyFavoriteTabs}: スポット = favorites, しおり = the しおり
 *    collection, プラン = saved plans (an empty placeholder list for now). The
 *    union of スポット + しおり + プラン is exactly the すべて tab and each entry
 *    lands in a single tab (Property 9).
 *  - Removing a favorite drops it from the list via
 *    {@link useTourism().removeFavorite} (Req 5.3, Property 8). Remove is offered
 *    on every favorite (スポット-kind) entry, in whichever tab it appears.
 *  - Selecting a spot opens a detail view with its description, reviews and a
 *    「関連スポット」 list — same-category spots from {@link EHIME_SPOTS}, falling
 *    back to the remaining spots, and degrading gracefully to an empty message
 *    (Req 5.4).
 *
 * Purely presentational over the store, so it stays testable: a test wraps it in
 * a {@link TourismProvider}, seeds favorites via swipes / addFavorite, and drives
 * the tabs and buttons.
 */

import { useMemo, useState } from "react";

import {
  classifyFavoriteTabs,
  useTourism,
  type FavoriteEntry,
  type FavoriteTabKind,
} from "../../app/TourismContext";
import { EHIME_SPOTS } from "../../adapters/mock/spots";
import type { LangCode, Spot } from "../../domain/types";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { PlaceholderImage } from "../components/PlaceholderImage";

/** The favorites tabs, in display order. すべて is the union view. */
type FavoritesTab = "all" | FavoriteTabKind;

const TAB_ORDER: FavoritesTab[] = ["all", "spot", "shiori", "plan"];

/** Resolve a spot's description in the active language, falling back to ja. */
function localizedDescription(spot: Spot, lang: LangCode): string {
  return spot.localizedDescriptions[lang] ?? spot.localizedDescriptions.ja ?? "";
}

/**
 * Related spots for the detail view (Req 5.4): same-category spots from the
 * catalogue, or — when there are none — the remaining spots. Excludes the spot
 * itself, and returns an empty array only when the catalogue holds nothing else
 * (the UI then shows a graceful empty message).
 */
function relatedSpots(spot: Spot, catalogue: Spot[]): Spot[] {
  const others = catalogue.filter((s) => s.id !== spot.id);
  const sameCategory = others.filter((s) => s.category === spot.category);
  return sameCategory.length > 0 ? sameCategory : others;
}

export function FavoritesView(): JSX.Element {
  const { t, lang } = useI18n();
  const { favorites, shiori, removeFavorite } = useTourism();

  const [activeTab, setActiveTab] = useState<FavoritesTab>("all");
  // The spot whose detail is open, or null for the list view (Req 5.4).
  const [selected, setSelected] = useState<Spot | null>(null);

  // プラン is an empty placeholder list until plan-sharing (task 8.8) lands.
  const plans = useMemo(() => [], []);
  const tabs = useMemo(
    () => classifyFavoriteTabs(favorites, shiori, plans),
    [favorites, shiori, plans],
  );

  // Detail view takes over the panel when a spot is selected (Req 5.4).
  if (selected) {
    return (
      <FavoriteDetail
        spot={selected}
        onBack={() => setSelected(null)}
        onOpenRelated={(spot) => setSelected(spot)}
      />
    );
  }

  const entries = tabs[activeTab];
  const totalCount = tabs.all.length;

  return (
    <section className="fav" aria-labelledby="fav-heading">
      <header className="fav__header">
        <h2 id="fav-heading" className="fav__title">
          <span className="fav__title-heart" aria-hidden="true">
            ♥
          </span>
          {t("fav.title")}
        </h2>
        <p className="fav__lead">{t("fav.lead")}</p>
      </header>

      {/* Accessible tabs — すべて / スポット / しおり / プラン (Req 5.2). */}
      <div
        className="fav__tablist"
        role="tablist"
        aria-label={t("fav.tablistLabel")}
      >
        {TAB_ORDER.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`fav-tab-${tab}`}
              aria-selected={isActive}
              aria-controls={`fav-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              className={`fav__tab${isActive ? " fav__tab--active" : ""}`}
              data-testid={`fav-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="fav__tab-label">{t(`fav.tab.${tab}`)}</span>
              <span className="fav__tab-count">{tabs[tab].length}</span>
            </button>
          );
        })}
      </div>

      <div
        className="fav__panel"
        role="tabpanel"
        id={`fav-panel-${activeTab}`}
        aria-labelledby={`fav-tab-${activeTab}`}
        tabIndex={0}
      >
        {totalCount === 0 ? (
          // No favorites at all — nudge the user toward the swipe deck (Req 5.1).
          <div className="fav__empty" data-testid="fav-empty">
            <PlaceholderImage
              motif="mikan"
              label={t("fav.empty.title")}
              sublabel={t("fav.empty.lead")}
              aspectRatio="4 / 3"
            />
          </div>
        ) : entries.length === 0 ? (
          // This tab is empty but others are not.
          <p className="fav__tab-empty" data-testid="fav-tab-empty">
            {t("fav.tabEmpty")}
          </p>
        ) : (
          <ul className="fav__list" data-testid="fav-list">
            {entries.map((entry) => (
              <FavoriteRow
                key={entry.key}
                entry={entry}
                lang={lang}
                onOpen={(spot) => setSelected(spot)}
                onRemove={removeFavorite}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** A single row in the favorites list. */
function FavoriteRow({
  entry,
  lang,
  onOpen,
  onRemove,
}: {
  entry: FavoriteEntry;
  lang: LangCode;
  onOpen: (spot: Spot) => void;
  onRemove: (spotId: string) => void;
}): JSX.Element {
  const { t } = useI18n();
  const { spot, plan, kind } = entry;

  // プラン entries have no spot — show a light card (placeholder list for now).
  if (!spot) {
    return (
      <li className="fav-row fav-row--plan">
        <span className="fav-row__thumb">
          <PlaceholderImage motif="spot" label={plan?.title} aspectRatio="1 / 1" />
        </span>
        <span className="fav-row__meta">
          <span className="fav-row__name">{plan?.title ?? ""}</span>
          <Tag tone="moss">{t("fav.tab.plan")}</Tag>
        </span>
      </li>
    );
  }

  return (
    <li className="fav-row">
      <button
        type="button"
        className="fav-row__open"
        aria-label={t("fav.open").replace("{name}", spot.name)}
        data-testid={`fav-open-${spot.id}`}
        onClick={() => onOpen(spot)}
      >
        <span className="fav-row__thumb">
          <SpotThumb spot={spot} />
        </span>
        <span className="fav-row__meta">
          <span className="fav-row__name">{spot.name}</span>
          <span className="fav-row__tags">
            <Tag tone="accent">{t(`swipe.category.${spot.category}`)}</Tag>
            {kind === "shiori" && <Tag tone="teal">{t("fav.tab.shiori")}</Tag>}
          </span>
          <span className="fav-row__desc">
            {localizedDescription(spot, lang)}
          </span>
        </span>
        <span className="fav-row__chevron" aria-hidden="true">
          ›
        </span>
      </button>

      {/* Remove is offered on favorites (スポット-kind), in any tab (Req 5.3). */}
      {kind === "spot" && (
        <button
          type="button"
          className="fav-row__remove"
          aria-label={t("fav.remove").replace("{name}", spot.name)}
          data-testid={`fav-remove-${spot.id}`}
          onClick={() => onRemove(spot.id)}
        >
          <span aria-hidden="true">♥</span>
        </button>
      )}
    </li>
  );
}

/** The detail view for a selected favorite spot (Req 5.4). */
function FavoriteDetail({
  spot,
  onBack,
  onOpenRelated,
}: {
  spot: Spot;
  onBack: () => void;
  onOpenRelated: (spot: Spot) => void;
}): JSX.Element {
  const { t, lang } = useI18n();
  const related = useMemo(() => relatedSpots(spot, EHIME_SPOTS), [spot]);

  const avgRating =
    spot.reviews.length > 0
      ? spot.reviews.reduce((sum, r) => sum + r.rating, 0) / spot.reviews.length
      : 0;

  return (
    <section className="fav-detail" aria-labelledby="fav-detail-heading">
      <Button variant="ghost" onClick={onBack} className="fav-detail__back">
        ‹ {t("fav.back")}
      </Button>

      <div className="fav-detail__photo">
        <SpotThumb spot={spot} large />
      </div>

      <div className="fav-detail__head">
        <h2 id="fav-detail-heading" className="fav-detail__name">
          {spot.name}
        </h2>
        <Tag tone="accent">{t(`swipe.category.${spot.category}`)}</Tag>
      </div>

      <p className="fav-detail__desc">{localizedDescription(spot, lang)}</p>

      {spot.reviews.length > 0 && (
        <div className="fav-detail__reviews">
          <span className="fav-detail__stars" aria-hidden="true">
            {"★".repeat(Math.round(avgRating))}
            {"☆".repeat(Math.max(0, 5 - Math.round(avgRating)))}
          </span>
          <span className="fav-detail__reviews-count">
            {t("swipe.reviewCount").replace(
              "{count}",
              String(spot.reviews.length),
            )}
          </span>
          <p className="fav-detail__review-text">“{spot.reviews[0]!.text}”</p>
        </div>
      )}

      {/* 関連スポット (Req 5.4) — graceful empty message when none. */}
      <section
        className="fav-detail__related"
        aria-labelledby="fav-related-heading"
        data-testid="fav-related"
      >
        <h3 id="fav-related-heading" className="fav-detail__related-title">
          {t("fav.related.title")}
        </h3>
        {related.length === 0 ? (
          <p className="fav-detail__related-empty">{t("fav.related.empty")}</p>
        ) : (
          <ul className="fav-detail__related-list">
            {related.map((rel) => (
              <li key={rel.id} className="fav-detail__related-item">
                <button
                  type="button"
                  className="fav-detail__related-btn"
                  data-testid={`fav-related-${rel.id}`}
                  onClick={() => onOpenRelated(rel)}
                >
                  <span className="fav-detail__related-thumb">
                    <SpotThumb spot={rel} />
                  </span>
                  <span className="fav-detail__related-meta">
                    <span className="fav-detail__related-name">{rel.name}</span>
                    <span className="fav-detail__related-cat">
                      {t(`swipe.category.${rel.category}`)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

/**
 * A spot thumbnail that renders the real image when usable and otherwise the
 * on-brand placeholder (Req 4.7). Tracks its own load-error state.
 */
function SpotThumb({
  spot,
  large = false,
}: {
  spot: Spot;
  large?: boolean;
}): JSX.Element {
  const [errored, setErrored] = useState(false);
  const url = spot.imageUrls[0];

  if (!url || errored) {
    return (
      <PlaceholderImage
        motif="spot"
        label={spot.name}
        aspectRatio={large ? "4 / 3" : "1 / 1"}
      />
    );
  }
  return (
    <img
      className="fav-row__img"
      src={url}
      alt={spot.name}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
