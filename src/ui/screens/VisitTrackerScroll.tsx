/**
 * VisitTrackerScroll — the お遍路マッチ 行った/行ってない screen (Req 11.1–11.4),
 * built as a マッチングアプリ風 swipe deck: one 札所 card at a time, decided by a
 * **left/right swipe** (drag), by two clearly-labelled buttons, or by the
 * ← / → arrow keys — so it reads at a glance and stays fully accessible.
 *
 *   右スワイプ / → → ○行った (visited)
 *   左スワイプ / ← → ×行ってない (not visited)
 *
 * Each decision marks the 札所 through `onSetVisited` (true/false), including
 * reverting a previously-visited 札所 (Req 11.2, 11.3), then advances to the
 * next card. A live tally shows how many 札所 are set to 行った, and finishing
 * the deck shows a summary with a 見直す (restart) action. Nothing is
 * pre-selected, so the first-run screen never looks like 行ってない is already
 * chosen.
 *
 * State is owned by the shared pilgrimage store; this component is purely
 * prop-driven (temples + visited set + an `onSetVisited` callback) so it stays
 * trivially testable and the same toggle feeds {@link applyVisit}, under which
 * design Property 21 (訪問状態トグルの往復) holds. Because the store persists the
 * visited set resiliently, a failed save never blocks the user — the on-screen
 * choice always stands (Req 11.5).
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

import { useGeneratedImage } from "../../app/ImageContext";
import type { ImagePrompt, Temple } from "../../domain/types";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { SectionHeader } from "../components/SectionHeader";
import { useWikipediaImage } from "./useWikipediaImage";

/** Past this pointer travel (px) a release commits to a swipe. */
const SWIPE_THRESHOLD = 72;

/** The current drag offset applied to the top card. */
interface DragOffset {
  x: number;
  y: number;
}

/** Which side a (potential) drag is leaning, for the live hint overlay. */
function leaning(offset: DragOffset | null): "left" | "right" | null {
  if (!offset) return null;
  if (Math.abs(offset.x) < 14) return null;
  return offset.x > 0 ? "right" : "left";
}

export interface VisitTrackerScrollProps {
  /** Temples to set 行った/行ってない for (the selected 対象県's 札所). */
  temples: Temple[];
  /** Temple ids currently recorded as visited (行った). */
  visited: ReadonlySet<string>;
  /** Mark a temple visited (true = 行った) or unvisited (false = 行ってない). */
  onSetVisited: (templeId: string, visited: boolean) => void;
  /** Finish the setup (e.g. return to the納経帳 records view). */
  onDone?: () => void;
  /** Loading flag while temples load through the map port. */
  loading?: boolean;
}

export function VisitTrackerScroll({
  temples,
  visited,
  onSetVisited,
  onDone,
  loading = false,
}: VisitTrackerScrollProps): JSX.Element {
  const { t, lang } = useI18n();

  const ordered = useMemo(
    () => [...temples].sort((a, b) => a.number - b.number),
    [temples],
  );
  const visitedCount = ordered.filter((tm) => visited.has(tm.id)).length;

  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState<DragOffset | null>(null);
  const dragStart = useRef<DragOffset | null>(null);

  // Restart the deck whenever the temple set changes (e.g. loaded / area swap).
  useEffect(() => {
    setIndex(0);
    setOffset(null);
    dragStart.current = null;
  }, [ordered]);

  const current = ordered[index];
  const exhausted = ordered.length > 0 && current == null;

  const commit = useCallback(
    (didVisit: boolean): void => {
      const temple = ordered[index];
      if (temple == null) return;
      // 右=行った(true) / 左=行ってない(false). Records, then advances (Req 11.2/11.3).
      onSetVisited(temple.id, didVisit);
      setOffset(null);
      dragStart.current = null;
      setIndex((i) => i + 1);
    },
    [ordered, index, onSetVisited],
  );

  // ---- Pointer drag (left/right) ----------------------------------------
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
    dragStart.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) {
      setOffset(null); // not far enough — snap back
      return;
    }
    commit(dx > 0); // right → 行った, left → 行ってない
  };

  // ---- Arrow-key enhancement --------------------------------------------
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (exhausted) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      commit(true);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      commit(false);
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
    <section className="visit-tracker" aria-labelledby="visit-tracker-heading">
      <SectionHeader
        eyebrow="OHENRO MATCH"
        title={<span id="visit-tracker-heading">{t("visit.title")}</span>}
        action={
          onDone ? (
            <Button variant="primary" size="sm" onClick={onDone}>
              {t("visit.done")}
            </Button>
          ) : undefined
        }
      />
      <p className="visit-tracker__lead">{t("visit.lead")}</p>

      {loading ? (
        <p className="visit-tracker__status" role="status">
          {t("visit.loading")}
        </p>
      ) : ordered.length === 0 ? (
        <p className="visit-tracker__status" role="status">
          {t("visit.empty")}
        </p>
      ) : (
        <>
          <p
            className="visit-tracker__tally"
            role="status"
            data-testid="visit-tally"
          >
            {t("visit.tally")
              .replace("{visited}", String(visitedCount))
              .replace("{total}", String(ordered.length))}
          </p>

          {/* Progress / live status for assistive tech. */}
          <p className="visit-tracker__progress" role="status" aria-live="polite">
            {exhausted
              ? t("visit.done.title")
              : t("visit.progress")
                  .replace("{current}", String(index + 1))
                  .replace("{total}", String(ordered.length))}
          </p>

          {exhausted ? (
            <div className="swipe__done" data-testid="visit-done">
              <PlaceholderImage
                motif="temple"
                label={t("visit.done.title")}
                sublabel={t("visit.done.lead")
                  .replace("{visited}", String(visitedCount))
                  .replace("{total}", String(ordered.length))}
                aspectRatio="4 / 3"
              />
              <div className="swipe__done-actions">
                <Button variant="soft" onClick={() => setIndex(0)}>
                  {t("visit.restart")}
                </Button>
                {onDone && (
                  <Button variant="ghost" onClick={onDone}>
                    {t("visit.done")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="swipe__stage">
                {/* Peek of the next card for a layered, hand-stacked feel. */}
                {ordered[index + 1] && (
                  <div
                    className="swipe-card swipe-card--peek"
                    aria-hidden="true"
                  >
                    <div className="swipe-card__photo-wrap">
                      <TemplePhoto temple={ordered[index + 1]!} />
                    </div>
                  </div>
                )}

                <div
                  className={`swipe-card${lean ? ` swipe-card--lean-${lean}` : ""}`}
                  style={cardStyle}
                  role="group"
                  tabIndex={0}
                  aria-roledescription={t("visit.cardRole")}
                  aria-label={`${current!.number} ${current!.name}`}
                  data-testid="visit-card"
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
                      {lean === "right"
                        ? t("visit.visited")
                        : t("visit.notVisited")}
                    </span>
                  )}

                  <div className="swipe-card__photo-wrap">
                    <TemplePhoto temple={current!} />
                    {visited.has(current!.id) && (
                      <span className="visit-card__stamp" aria-hidden="true">
                        ○
                      </span>
                    )}
                  </div>

                  <div className="swipe-card__body">
                    <p className="visit-card__no">
                      <span className="visit-card__badge" aria-hidden="true">
                        {current!.number}
                      </span>
                      {t("map.detail.number")} {current!.number}
                    </p>
                    <h3 className="swipe-card__name">{current!.name}</h3>
                    <p className="visit-card__address">{current!.address}</p>
                    {(() => {
                      const description =
                        current!.localizedDescriptions[
                          lang as keyof typeof current.localizedDescriptions
                        ] ??
                        current!.localizedDescriptions.ja ??
                        "";
                      return description ? (
                        <p className="swipe-card__desc">{description}</p>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Two clear choices — equivalent to the left/right swipe. */}
              <div
                className="visit-card__choices"
                role="group"
                aria-label={`${current!.number} ${current!.name}`}
              >
                <button
                  type="button"
                  className="visit-choice visit-choice--no"
                  data-testid="visit-no"
                  aria-label={`${current!.name}：${t("visit.notVisited")}`}
                  onClick={() => commit(false)}
                >
                  <span className="visit-choice__mark" aria-hidden="true">
                    ×
                  </span>
                  {t("visit.notVisited")}
                </button>
                <button
                  type="button"
                  className="visit-choice visit-choice--yes"
                  data-testid="visit-yes"
                  aria-label={`${current!.name}：${t("visit.visited")}`}
                  onClick={() => commit(true)}
                >
                  <span className="visit-choice__mark" aria-hidden="true">
                    ○
                  </span>
                  {t("visit.visited")}
                </button>
              </div>

              <p className="visit-tracker__hint">{t("visit.hint")}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * A temple photo. Priority: a curated local photo → a **name-searched** photo
 * from Wikipedia (Req: 名前で調べて画像表示) → an AI-generated royalty-free
 * photo (mock SVG by default, Amazon Bedrock when AWS is configured) → the
 * on-brand placeholder. The layered fallback keeps お遍路マッチ cards as rich as
 * the 通常観光モード spot cards (Req 4.7).
 */
function TemplePhoto({ temple }: { temple: Temple }): JSX.Element {
  const { t } = useI18n();
  const [localErrored, setLocalErrored] = useState(false);
  const [wikiErrored, setWikiErrored] = useState(false);

  // A curated, non-placeholder local asset (e.g. 石手寺) wins outright.
  const localUrl = temple.imageUrls[0];
  const hasLocalReal =
    Boolean(localUrl) &&
    !localUrl.includes("/placeholder/") &&
    !localErrored;

  // Otherwise, look the temple up by name on Wikipedia for a real photo.
  const wikiQuery = temple.name;
  const wiki = useWikipediaImage(hasLocalReal ? null : wikiQuery, !hasLocalReal);
  const wikiReady = wiki.status === "ready" && !wikiErrored;

  // Only fall back to AI generation once the name search has produced nothing
  // usable (miss or a broken image URL).
  const needGenerate =
    !hasLocalReal && (wiki.status === "error" || wikiErrored);
  const prompt = useMemo<ImagePrompt | null>(
    () =>
      needGenerate
        ? {
            id: temple.id,
            subject: `${temple.name}（第${temple.number}番札所）`,
            description: temple.localizedDescriptions.ja,
          }
        : null,
    [needGenerate, temple.id, temple.name, temple.number, temple.localizedDescriptions],
  );
  const generated = useGeneratedImage(prompt, needGenerate);

  const alt = `${temple.number} ${temple.name}`;

  if (hasLocalReal) {
    return (
      <img
        className="visit-card__img"
        src={localUrl}
        alt={alt}
        loading="lazy"
        onError={() => setLocalErrored(true)}
      />
    );
  }

  if (wikiReady) {
    return (
      <img
        className="visit-card__img"
        src={wiki.src}
        alt={alt}
        loading="lazy"
        onError={() => setWikiErrored(true)}
      />
    );
  }

  // Still searching the name on Wikipedia.
  if (!needGenerate && (wiki.status === "loading" || wiki.status === "idle")) {
    return (
      <PlaceholderImage
        motif="temple"
        label={alt}
        sublabel={t("visit.photoSearching")}
        aspectRatio="5 / 3"
      />
    );
  }

  if (generated.status === "ready") {
    return (
      <img
        className="visit-card__img"
        src={generated.image.src}
        alt={alt}
        loading="lazy"
      />
    );
  }

  return (
    <PlaceholderImage
      motif="temple"
      label={alt}
      sublabel={
        generated.status === "loading" ? t("image.generating") : t("visit.photoSoon")
      }
      aspectRatio="5 / 3"
    />
  );
}
