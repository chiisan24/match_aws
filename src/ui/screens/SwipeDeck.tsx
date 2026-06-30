/**
 * SwipeDeck — the マッチングアプリ風 spot-discovery screen for the 通常観光モード
 * "swipe" tab (Req 4.1–4.7).
 *
 * Behaviour:
 *  - Presents spot candidates as a card with all required information: name,
 *    photo (a {@link PlaceholderImage} when no usable image is provided —
 *    Req 4.7), localized description (with ja fallback), popularity ranking and
 *    reviews (Req 4.1).
 *  - Four-direction swipe, offered three accessible ways so it works for every
 *    input: labelled buttons (with aria-labels), pointer drag, and arrow keys
 *    on the focused card. Each gesture is classified by the pure domain
 *    {@link classifySwipe}:
 *      right → favorite (行きたい, Req 4.2)
 *      left  → skip     (興味なし, Req 4.3)
 *      up    → shiori   (しおりに追加, Req 4.4)
 *      down  → later    (後で見る, Req 4.5)
 *  - Every swipe is recorded through {@link useTourism.recordSwipe} so it feeds
 *    back into suggestion preferences (Req 3.3), and the spot is added to the
 *    matching store collection (favorites / shiori / later).
 *  - Candidates come from the tourism store (handed off from chat, Req 3.2);
 *    when none are pending the deck falls back to {@link EHIME_SPOTS}. The deck
 *    takes ownership of the handed-off candidates and clears them from the store.
 *  - After the swipe history updates it surfaces 「あなたへのおすすめ」 via
 *    {@link generateRecommendations}, which excludes 興味なし and already-evaluated
 *    spots (Req 4.6).
 *
 * Purely presentational over the store, so it stays testable: a test wraps it
 * in a {@link TourismProvider} with a fake ChatPort and drives the buttons /
 * keyboard.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useTourism } from "../../app/TourismContext";
import { useGeneratedImage } from "../../app/ImageContext";
import {
  classifySwipe,
  generateRecommendations,
  type SwipeDir,
} from "../../domain/swipe";
import type { ImagePrompt, LangCode, Spot } from "../../domain/types";
import { EHIME_SPOTS } from "../../adapters/mock/spots";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { PlaceholderImage } from "../components/PlaceholderImage";

/** Past this pointer travel (px) a release commits to a swipe. */
const SWIPE_THRESHOLD = 72;

/** Resolve a spot's description in the active language, falling back to ja. */
function localizedDescription(spot: Spot, lang: LangCode): string {
  return (
    spot.localizedDescriptions[lang] ?? spot.localizedDescriptions.ja ?? ""
  );
}

/** The current drag offset applied to the top card. */
interface DragOffset {
  x: number;
  y: number;
}

/** Which direction a (potential) drag is leaning, for the live hint overlay. */
function leaning(offset: DragOffset | null): SwipeDir | null {
  if (!offset) return null;
  const { x, y } = offset;
  if (Math.abs(x) < 12 && Math.abs(y) < 12) return null;
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}

export interface SwipeDeckProps {
  /** Optional jump back to the chat tab once the user is done discovering. */
  onBackToChat?: () => void;
}

export function SwipeDeck({ onBackToChat }: SwipeDeckProps): JSX.Element {
  const { t, lang } = useI18n();
  const {
    swipeCandidates,
    swipeHistory,
    recordSwipe,
    clearCandidates,
    addFavorite,
    addToShiori,
    addToLater,
  } = useTourism();

  // The deck the user is swiping through. Seeded from any pending chat
  // candidates, otherwise from the fixed mock spots (Req 3.2 / 4.1).
  const [deck, setDeck] = useState<Spot[]>(() =>
    swipeCandidates.length > 0 ? swipeCandidates : EHIME_SPOTS,
  );
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState<DragOffset | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<DragOffset | null>(null);

  // Take ownership of any handed-off candidates: adopt them as the deck, reset
  // to the top, and clear them from the store so a remount never replays them.
  useEffect(() => {
    if (swipeCandidates.length > 0) {
      setDeck(swipeCandidates);
      setIndex(0);
      clearCandidates();
    }
  }, [swipeCandidates, clearCandidates]);

  const current = deck[index];
  const exhausted = current == null;

  // 「あなたへのおすすめ」 — derived from the full spot catalogue minus every
  // evaluated spot (Req 4.6). The pool unions the catalogue with the current
  // deck so chat-handed candidates can be recommended too; evaluated ones are
  // filtered out by generateRecommendations regardless.
  const recommendations = useMemo<Spot[]>(() => {
    const pool: Spot[] = [...EHIME_SPOTS];
    const seen = new Set(pool.map((s) => s.id));
    for (const spot of deck) {
      if (!seen.has(spot.id)) {
        seen.add(spot.id);
        pool.push(spot);
      }
    }
    return generateRecommendations(pool, swipeHistory);
  }, [deck, swipeHistory]);

  const commitSwipe = useCallback(
    (dir: SwipeDir): void => {
      const spot = deck[index];
      if (spot == null) return;

      // Record first so preferences reflect the swipe (Req 3.3), then route the
      // spot into its collection based on the pure classification (Req 4.2–4.5).
      recordSwipe({ itemId: spot.id, dir });
      const classification = classifySwipe(dir);
      if (classification === "favorite") addFavorite(spot);
      else if (classification === "shiori") addToShiori(spot);
      else if (classification === "later") addToLater(spot);
      // "skip" (left) advances without saving anywhere (Req 4.3).

      setOffset(null);
      dragStart.current = null;
      setIndex((i) => i + 1);
    },
    [deck, index, recordSwipe, addFavorite, addToShiori, addToLater],
  );

  // ---- Pointer drag ------------------------------------------------------
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (exhausted) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setOffset({ x: 0, y: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragStart.current) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
      // Not far enough — snap back.
      setOffset(null);
      return;
    }
    if (Math.abs(dx) >= Math.abs(dy)) commitSwipe(dx > 0 ? "right" : "left");
    else commitSwipe(dy > 0 ? "down" : "up");
  };

  // ---- Arrow-key enhancement --------------------------------------------
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (exhausted) return;
    const map: Record<string, SwipeDir> = {
      ArrowRight: "right",
      ArrowLeft: "left",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      commitSwipe(dir);
    }
  };

  const lean = leaning(offset);
  const cardStyle = offset
    ? {
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${
          offset.x / 22
        }deg)`,
      }
    : undefined;

  return (
    <section className="swipe" aria-labelledby="swipe-heading">
      <header className="swipe__header">
        <h2 id="swipe-heading" className="swipe__title">
          {t("swipe.title")}
        </h2>
        <p className="swipe__lead">{t("swipe.lead")}</p>
      </header>

      {/* Progress / live status for assistive tech. */}
      <p className="swipe__status" role="status" aria-live="polite">
        {exhausted
          ? t("swipe.done.title")
          : t("swipe.progress")
              .replace("{current}", String(index + 1))
              .replace("{total}", String(deck.length))}
      </p>

      {exhausted ? (
        <div className="swipe__done" data-testid="swipe-done">
          <PlaceholderImage
            motif="mikan"
            label={t("swipe.done.title")}
            sublabel={t("swipe.done.lead")}
            aspectRatio="4 / 3"
          />
          <div className="swipe__done-actions">
            <Button variant="soft" onClick={() => setIndex(0)}>
              {t("swipe.restart")}
            </Button>
            {onBackToChat && (
              <Button variant="ghost" onClick={onBackToChat}>
                {t("swipe.backToChat")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="swipe__stage">
          {/* Peek of the next card for a layered, hand-stacked feel. */}
          {deck[index + 1] && (
            <div className="swipe-card swipe-card--peek" aria-hidden="true">
              <SpotPhoto spot={deck[index + 1]!} />
            </div>
          )}

          <div
            ref={cardRef}
            className={`swipe-card${lean ? ` swipe-card--lean-${lean}` : ""}`}
            style={cardStyle}
            role="group"
            tabIndex={0}
            aria-roledescription={t("swipe.cardRole")}
            aria-label={current.name}
            data-testid="swipe-card"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragStart.current = null;
              setOffset(null);
            }}
            onKeyDown={onKeyDown}
          >
            {/* Directional badge that follows the drag (decorative). */}
            {lean && (
              <span
                className={`swipe-card__badge swipe-card__badge--${lean}`}
                aria-hidden="true"
              >
                {t(`swipe.action.${classifySwipe(lean)}`)}
              </span>
            )}

            <div className="swipe-card__photo-wrap">
              <SpotPhoto spot={current} />
              {current.popularityRank != null && (
                <span className="swipe-card__rank">
                  {t("swipe.rank").replace(
                    "{rank}",
                    String(current.popularityRank),
                  )}
                </span>
              )}
            </div>

            <div className="swipe-card__body">
              <div className="swipe-card__titlerow">
                <h3 className="swipe-card__name">{current.name}</h3>
                <Tag tone="accent">{t(`swipe.category.${current.category}`)}</Tag>
              </div>

              <p className="swipe-card__desc">
                {localizedDescription(current, lang)}
              </p>

              <SpotReviews spot={current} />
            </div>
          </div>
        </div>
      )}

      {/* Accessible four-direction controls — equivalent to the gestures. */}
      {!exhausted && (
        <div className="swipe__controls" role="group" aria-label={t("swipe.controls")}>
          <button
            type="button"
            className="swipe__btn swipe__btn--skip"
            aria-label={t("swipe.aria.left")}
            data-testid="swipe-left"
            onClick={() => commitSwipe("left")}
          >
            <span aria-hidden="true">✕</span>
            <span className="swipe__btn-label">{t("swipe.action.skip")}</span>
          </button>
          <button
            type="button"
            className="swipe__btn swipe__btn--later"
            aria-label={t("swipe.aria.down")}
            data-testid="swipe-down"
            onClick={() => commitSwipe("down")}
          >
            <span aria-hidden="true">🕓</span>
            <span className="swipe__btn-label">{t("swipe.action.later")}</span>
          </button>
          <button
            type="button"
            className="swipe__btn swipe__btn--shiori"
            aria-label={t("swipe.aria.up")}
            data-testid="swipe-up"
            onClick={() => commitSwipe("up")}
          >
            <span aria-hidden="true">📖</span>
            <span className="swipe__btn-label">{t("swipe.action.shiori")}</span>
          </button>
          <button
            type="button"
            className="swipe__btn swipe__btn--favorite"
            aria-label={t("swipe.aria.right")}
            data-testid="swipe-right"
            onClick={() => commitSwipe("right")}
          >
            <span aria-hidden="true">♥</span>
            <span className="swipe__btn-label">{t("swipe.action.favorite")}</span>
          </button>
        </div>
      )}

      {!exhausted && <p className="swipe__hint">{t("swipe.hint")}</p>}

      {/* 「あなたへのおすすめ」 — appears once history exists (Req 4.6). */}
      {swipeHistory.length > 0 && (
        <section
          className="swipe__recommend"
          aria-labelledby="swipe-rec-heading"
          data-testid="swipe-recommend"
        >
          <h3 id="swipe-rec-heading" className="swipe__recommend-title">
            {t("swipe.recommend.title")}
          </h3>
          {recommendations.length === 0 ? (
            <p className="swipe__recommend-empty">
              {t("swipe.recommend.empty")}
            </p>
          ) : (
            <ul className="swipe__recommend-list">
              {recommendations.map((spot) => (
                <li key={spot.id} className="swipe__recommend-item">
                  <span className="swipe__recommend-thumb">
                    <SpotPhoto spot={spot} />
                  </span>
                  <span className="swipe__recommend-meta">
                    <span className="swipe__recommend-name">{spot.name}</span>
                    <span className="swipe__recommend-cat">
                      {t(`swipe.category.${spot.category}`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

/**
 * A spot photo that renders the real image when one is provided and resolves.
 * When no usable image exists it asks the {@link useGeneratedImage} hook to
 * auto-generate a royalty-free photo (mock SVG by default, Amazon Bedrock when
 * AWS is configured), showing a "生成中" placeholder meanwhile and the on-brand
 * placeholder if generation fails (Req 4.7).
 */
function SpotPhoto({ spot }: { spot: Spot }): JSX.Element {
  const { t } = useI18n();
  const [errored, setErrored] = useState(false);
  const url = spot.imageUrls[0];
  const hasRealImage = Boolean(url) && !errored;

  // Only request generation when there is no usable real photo.
  const prompt = useMemo<ImagePrompt | null>(
    () =>
      hasRealImage
        ? null
        : {
            id: spot.id,
            subject: spot.name,
            description: spot.localizedDescriptions.ja,
            category: spot.category,
          },
    [hasRealImage, spot.id, spot.name, spot.category, spot.localizedDescriptions],
  );
  const generated = useGeneratedImage(prompt, !hasRealImage);

  if (hasRealImage) {
    return (
      <img
        className="swipe-card__photo"
        src={url}
        alt={spot.name}
        loading="lazy"
        onError={() => setErrored(true)}
      />
    );
  }

  if (generated.status === "ready") {
    return (
      <img
        className="swipe-card__photo"
        src={generated.image.src}
        alt={spot.name}
        loading="lazy"
      />
    );
  }

  return (
    <PlaceholderImage
      motif="spot"
      label={spot.name}
      aspectRatio="4 / 3"
      sublabel={
        generated.status === "loading" ? t("image.generating") : undefined
      }
    />
  );
}

/** The reviews block for a spot card (Req 4.1). */
function SpotReviews({ spot }: { spot: Spot }): JSX.Element {
  const { t } = useI18n();

  if (spot.reviews.length === 0) {
    return <p className="swipe-card__reviews-empty">{t("swipe.noReviews")}</p>;
  }

  const avg =
    spot.reviews.reduce((sum, r) => sum + r.rating, 0) / spot.reviews.length;
  const sample = spot.reviews[0]!;

  return (
    <div className="swipe-card__reviews">
      <div className="swipe-card__reviews-head">
        <span className="swipe-card__stars" aria-hidden="true">
          {"★".repeat(Math.round(avg))}
          {"☆".repeat(Math.max(0, 5 - Math.round(avg)))}
        </span>
        <span className="swipe-card__reviews-count">
          {t("swipe.reviewCount").replace(
            "{count}",
            String(spot.reviews.length),
          )}
        </span>
      </div>
      <p className="swipe-card__review-text">“{sample.text}”</p>
    </div>
  );
}
