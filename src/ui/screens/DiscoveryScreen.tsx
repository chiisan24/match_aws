/**
 * DiscoveryScreen — the 発見 tab: swipe through Ehime's spots as a collection
 * game (`swipe-discovery-game` Req 1-11).
 *
 * The point of the screen is that it is reachable with nothing in progress: it
 * reads the spot catalogue and its own progress record, and touches neither the
 * route builder's state nor `activePlan` (Req 1.6). Open it while waiting for a
 * train, decide a few cards, come back later.
 *
 * Structure, top to bottom:
 *  - the achievement gauge and the badge grid, so the goal is visible first;
 *  - the deck: one card, decided with a button, an 80px drag or an arrow key
 *    (Req 2) — the same three ways as the route builder's deck, so the gesture
 *    is learned once;
 *  - when every spot is decided, a completion notice and 「もう一度見る」 that
 *    replays the deck without clearing the record (Req 5).
 *
 * 「興味あり」 adds to お気に入り and nowhere else (Req 9.5), using the catalogue
 * spot verbatim so a Places photo URL never leaks into `imageUrls` (Req 9.2).
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useDiscovery } from "../../app/DiscoveryContext";
import { useSpots } from "../../app/SpotContext";
import { useTourism } from "../../app/TourismContext";
import {
  deckOrder,
  discoveryProgress,
  type DiscoveryBadge,
} from "../../domain/discovery";
import type { LangCode, Spot } from "../../domain/types";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { useDiscoveryPhotos } from "./useDiscoveryPhoto";

/** Past this horizontal travel (px) a release commits to a decision (Req 2.4, 2.7). */
const DRAG_THRESHOLD = 80;
/** Past this (px) the card previews which way it is leaning (Req 2.14). */
const LEAN_THRESHOLD = 20;

/**
 * One bundled image per spot category (Req 8.1).
 *
 * Same source directory as the route builder's fallbacks. A category-appropriate
 * photo of somewhere else is a deliberate compromise here: the card is a
 * *browsing* surface where an empty frame reads as broken, and the spot's real
 * name and description sit right beside it, so nothing claims the photo is of
 * this particular place.
 */
const FALLBACK_IMAGE: Record<Spot["category"], string> = {
  sightseeing: "/images/ehime/matsuyama-castle.jpg",
  food: "/images/ehime/tobeyaki-shop.jpg",
  souvenir: "/images/ehime/michi-no-eki.jpg",
  onsen: "/images/ehime/onsen-bath.jpg",
};

/** Resolve a spot's description in the active language, falling back to ja. */
function localizedDescription(spot: Spot, lang: LangCode): string {
  return spot.localizedDescriptions[lang] ?? spot.localizedDescriptions.ja ?? "";
}

export function DiscoveryScreen(): JSX.Element {
  const { t, lang } = useI18n();
  const { spots, loading } = useSpots();
  const { addFavorite } = useTourism();
  const {
    seen,
    deckPosition,
    recordDecision,
    restartDeck,
    cachedPhoto,
    photoFailed,
  } = useDiscovery();

  const [offsetX, setOffsetX] = useState(0);
  const dragStartRef = useRef<number | null>(null);

  // The deck is rebuilt from the catalogue and the record. `seen` is captured
  // when the deck is built, not on every decision — re-sorting mid-session would
  // yank the next card out from under the user as soon as they decided one. The
  // record still updates immediately; only the *order* is held still.
  const initialSeenRef = useRef<ReadonlySet<string> | null>(null);
  if (initialSeenRef.current === null && !loading) {
    initialSeenRef.current = seen;
  }
  const deck = useMemo(
    () => deckOrder(spots, initialSeenRef.current ?? new Set<string>()),
    [spots],
  );

  const progress = useMemo(() => discoveryProgress(spots, seen), [spots, seen]);

  const current = deck[deckPosition];
  const next = deck[deckPosition + 1];
  const exhausted = current == null;

  // Only the visible card and the one behind it are ever looked up (Req 6.2).
  const photoTargets = useMemo(
    () => [current, next].filter((spot): spot is Spot => spot != null),
    [current, next],
  );
  useDiscoveryPhotos(photoTargets, lang);

  const decide = useCallback(
    (interested: boolean): void => {
      const spot = deck[deckPosition];
      if (spot == null) return;
      setOffsetX(0);
      dragStartRef.current = null;
      // お気に入りだけを更新する (Req 9.1, 9.4, 9.5)。カタログのスポットを
      // そのまま渡すので imageUrls は Places の URL に書き換わらない (Req 9.2)。
      if (interested) addFavorite(spot);
      recordDecision(spot.id);
    },
    [addFavorite, deck, deckPosition, recordDecision],
  );

  if (loading) {
    return (
      <section className="discover" aria-labelledby="discover-heading">
        <DiscoveryHeader />
        <p role="status">{t("discover.loading")}</p>
      </section>
    );
  }

  if (spots.length === 0) {
    return (
      <section className="discover" aria-labelledby="discover-heading">
        <DiscoveryHeader />
        <p role="status" data-testid="discover-empty">
          {t("discover.empty")}
        </p>
      </section>
    );
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragStartRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragStartRef.current != null) {
      setOffsetX(event.clientX - dragStartRef.current);
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragStartRef.current == null) return;
    const distance = event.clientX - dragStartRef.current;
    dragStartRef.current = null;
    // Short drags snap back and decide nothing (Req 2.9).
    if (Math.abs(distance) >= DRAG_THRESHOLD) decide(distance > 0);
    else setOffsetX(0);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    decide(event.key === "ArrowRight");
  };

  const leaning = Math.abs(offsetX) > LEAN_THRESHOLD
    ? offsetX > 0
      ? "like"
      : "skip"
    : null;

  return (
    <section className="discover" aria-labelledby="discover-heading">
      <DiscoveryHeader />

      <DiscoveryProgressPanel
        percent={progress.percent}
        seen={progress.seen}
        total={progress.total}
        areaBadges={progress.areaBadges}
        categoryBadges={progress.categoryBadges}
      />

      {/* 全件判定後は完了表示と再周回。記録は消さない (Req 5.1, 5.3, 5.4)。 */}
      {exhausted ? (
        <div className="discover__done" data-testid="discover-done">
          <p role="status">
            {progress.complete
              ? t("discover.complete")
              : t("discover.deckEnd")}
          </p>
          <Button variant="accent" onClick={restartDeck}>
            {t("discover.again")}
          </Button>
        </div>
      ) : (
        <>
          {/* 進捗は読み上げ領域。判定ごとに内容が変わる (Req 2.13)。 */}
          <p className="discover__position" role="status">
            {t("discover.position")
              .replace("{current}", String(deckPosition + 1))
              .replace("{total}", String(deck.length))}
          </p>

          <div className="discover__stage">
            {next ? (
              <div className="discover-card discover-card--peek" aria-hidden="true">
                <DiscoveryPhoto
                  spot={next}
                  cachedPhoto={cachedPhoto}
                  photoFailed={photoFailed}
                />
              </div>
            ) : null}

            <div
              className={`discover-card${leaning ? ` discover-card--${leaning}` : ""}`}
              style={{ transform: `translateX(${offsetX}px) rotate(${offsetX / 24}deg)` }}
              role="group"
              tabIndex={0}
              aria-label={current.name}
              data-testid="discover-card"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                dragStartRef.current = null;
                setOffsetX(0);
              }}
              onKeyDown={onKeyDown}
            >
              {leaning ? (
                <span className={`discover-card__badge discover-card__badge--${leaning}`}>
                  {t(leaning === "like" ? "discover.interested" : "discover.skip")}
                </span>
              ) : null}

              <DiscoveryPhoto
                spot={current}
                cachedPhoto={cachedPhoto}
                photoFailed={photoFailed}
              />

              <div className="discover-card__body">
                <div className="discover-card__title-row">
                  <h3 className="discover-card__name">{current.name}</h3>
                  <Tag tone={current.category === "food" ? "accent" : "teal"}>
                    {t(`spot.category.${current.category}`)}
                  </Tag>
                </div>
                <p className="discover-card__desc">
                  {localizedDescription(current, lang)}
                </p>
              </div>
            </div>
          </div>

          <div className="discover__actions">
            <Button variant="ghost" size="lg" leading="✕" onClick={() => decide(false)}>
              {t("discover.skip")}
            </Button>
            <Button variant="accent" size="lg" leading="♥" onClick={() => decide(true)}>
              {t("discover.interested")}
            </Button>
          </div>
          <p className="discover__hint">{t("discover.hint")}</p>
        </>
      )}
    </section>
  );
}

/** Heading + purpose blurb, shown in every state of the screen (Req 1.8). */
function DiscoveryHeader(): JSX.Element {
  const { t } = useI18n();
  return (
    <header className="discover__header">
      <h2 id="discover-heading" className="discover__title">
        <span aria-hidden="true">🃏</span> {t("discover.title")}
      </h2>
      <p className="discover__lead">{t("discover.lead")}</p>
    </header>
  );
}

/**
 * The gauge and the badge grid.
 *
 * Earned and unearned badges differ visually *and* in their accessible text
 * (Req 4.9): the modifier class carries the colour, and the label spells out
 * either "獲得" or the remaining count, so the distinction survives with styles
 * off or a screen reader on.
 */
function DiscoveryProgressPanel({
  percent,
  seen,
  total,
  areaBadges,
  categoryBadges,
}: {
  percent: number;
  seen: number;
  total: number;
  areaBadges: DiscoveryBadge[];
  categoryBadges: DiscoveryBadge[];
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="discover-progress" data-testid="discover-progress">
      <div className="discover-progress__head">
        <span className="discover-progress__percent">{percent}%</span>
        <span className="discover-progress__count">
          {t("discover.progress")
            .replace("{seen}", String(seen))
            .replace("{total}", String(total))}
        </span>
      </div>

      <div
        className="discover-progress__gauge"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t("discover.gaugeLabel")}
      >
        <span
          className="discover-progress__gauge-fill"
          style={{ inlineSize: `${percent}%` }}
        />
      </div>

      <ul className="discover-progress__badges" role="list">
        {[...areaBadges, ...categoryBadges].map((badge) => (
          <li
            key={badge.key}
            className={
              badge.earned
                ? "discover-badge discover-badge--earned"
                : "discover-badge"
            }
            data-testid={`discover-badge-${badge.key}`}
          >
            <span className="discover-badge__name">
              {badge.kind === "area"
                ? t(`discover.area.${badge.id}`)
                : t(`spot.category.${badge.id}`)}
            </span>
            <span className="discover-badge__state">
              {badge.earned
                ? t("discover.badgeEarned")
                : t("discover.badgeProgress")
                  .replace("{seen}", String(badge.seen))
                  .replace("{total}", String(badge.total))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The card photo: the cached Places photo when we have one, otherwise a bundled
 * image for the category.
 *
 * `onError` swaps to the fallback too (Req 8.8) — a cached proxy path can still
 * fail later if the underlying Places media expires, and the card must stay
 * readable rather than showing a broken frame. Attribution is rendered only
 * alongside a real Places photo, inside this card (Req 6.7).
 */
function DiscoveryPhoto({
  spot,
  cachedPhoto,
  photoFailed,
}: {
  spot: Spot;
  cachedPhoto: (spotId: string) => { photoUrl: string; attributions: { displayName: string; uri?: string }[] } | undefined;
  photoFailed: (spotId: string) => boolean;
}): JSX.Element {
  const [errored, setErrored] = useState(false);
  const cached = cachedPhoto(spot.id);
  const usePlaces = cached != null && !errored && !photoFailed(spot.id);
  const src = usePlaces ? cached.photoUrl : FALLBACK_IMAGE[spot.category];

  return (
    <div className="discover-card__photo-wrap">
      <img
        className="discover-card__photo"
        src={src}
        alt={spot.name}
        loading="lazy"
        onError={() => setErrored(true)}
      />
      {usePlaces && cached.attributions.length > 0 ? (
        <small className="discover-card__credit">
          Photo:{" "}
          {cached.attributions.map((item, index) => (
            <span key={`${item.displayName}-${index}`}>
              {index > 0 ? ", " : ""}
              {item.uri ? (
                <a href={item.uri} target="_blank" rel="noreferrer">
                  {item.displayName}
                </a>
              ) : (
                item.displayName
              )}
            </span>
          ))}
        </small>
      ) : null}
    </div>
  );
}
