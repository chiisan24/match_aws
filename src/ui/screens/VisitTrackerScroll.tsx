/**
 * VisitTrackerScroll — the お遍路マッチ-style 行った/行ってない setup screen
 * (Req 11.1–11.4). This is where, on first entry into お遍路モード, the user
 * quickly sets the initial value of their巡礼進捗 by sweeping through every 札所
 * and tapping ○行った / ×行ってない — the matching-app feel from the mockup
 * (お遍路マッチ -愛媛-), but built from real, accessible buttons rather than a
 * drag-only gesture so it works with keyboard and screen readers.
 *
 * Behaviour:
 *  - Renders one card per 札所 (number badge, name, address, a hand-drawn
 *    placeholder photo) in a scrollable column (Req 11.1).
 *  - Each card offers two explicit choices: ×行ってない (unvisited) and
 *    ○行った (visited). Tapping ○行った marks the 札所 visited; tapping
 *    ×行ってない marks it unvisited, including reverting a previously-visited
 *    札所 (Req 11.2, 11.3). The active choice is reflected with `aria-pressed`.
 *  - A live header tally shows how many 札所 are set to 行った, and a 完了 button
 *    closes the setup and returns to the納経帳.
 *
 * State is owned by the shared pilgrimage store; this component is purely
 * prop-driven (temples + visited set + an `onSetVisited` callback) so it stays
 * trivially testable and the same toggle feeds {@link applyVisit}, under which
 * design Property 21 (訪問状態トグルの往復) holds. Because the store persists the
 * visited set resiliently, a failed save never blocks the user — the on-screen
 * choice always stands (Req 11.5).
 */

import type { Temple } from "../../domain/types";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { SectionHeader } from "../components/SectionHeader";

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

  const ordered = [...temples].sort((a, b) => a.number - b.number);
  const visitedCount = ordered.filter((tm) => visited.has(tm.id)).length;

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
          <p className="visit-tracker__tally" role="status" data-testid="visit-tally">
            {t("visit.tally")
              .replace("{visited}", String(visitedCount))
              .replace("{total}", String(ordered.length))}
          </p>

          <ul className="visit-tracker__deck" role="list">
            {ordered.map((temple) => {
              const isVisited = visited.has(temple.id);
              const description =
                temple.localizedDescriptions[
                  lang as keyof typeof temple.localizedDescriptions
                ] ??
                temple.localizedDescriptions.ja ??
                "";
              return (
                <li key={temple.id} className="visit-tracker__item">
                  <article
                    className={
                      "visit-card" + (isVisited ? " visit-card--visited" : "")
                    }
                    data-testid="visit-card"
                  >
                    <div className="visit-card__photo">
                      <PlaceholderImage
                        motif="temple"
                        label={`${temple.number} ${temple.name}`}
                        sublabel={t("visit.photoSoon")}
                        aspectRatio="5 / 3"
                      />
                      {isVisited && (
                        <span className="visit-card__stamp" aria-hidden="true">
                          ○
                        </span>
                      )}
                    </div>

                    <div className="visit-card__body">
                      <p className="visit-card__no">
                        <span className="visit-card__badge" aria-hidden="true">
                          {temple.number}
                        </span>
                        {t("map.detail.number")} {temple.number}
                      </p>
                      <h3 className="visit-card__name">{temple.name}</h3>
                      <p className="visit-card__address">{temple.address}</p>
                      {description && (
                        <p className="visit-card__desc">{description}</p>
                      )}
                    </div>

                    <div
                      className="visit-card__choices"
                      role="group"
                      aria-label={`${temple.number} ${temple.name}`}
                    >
                      <button
                        type="button"
                        className={
                          "visit-choice visit-choice--no" +
                          (!isVisited ? " visit-choice--active" : "")
                        }
                        data-testid="visit-no"
                        aria-pressed={!isVisited}
                        aria-label={`${temple.name}：${t("visit.notVisited")}`}
                        onClick={() => onSetVisited(temple.id, false)}
                      >
                        <span className="visit-choice__mark" aria-hidden="true">
                          ×
                        </span>
                        {t("visit.notVisited")}
                      </button>
                      <button
                        type="button"
                        className={
                          "visit-choice visit-choice--yes" +
                          (isVisited ? " visit-choice--active" : "")
                        }
                        data-testid="visit-yes"
                        aria-pressed={isVisited}
                        aria-label={`${temple.name}：${t("visit.visited")}`}
                        onClick={() => onSetVisited(temple.id, true)}
                      >
                        <span className="visit-choice__mark" aria-hidden="true">
                          ○
                        </span>
                        {t("visit.visited")}
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>

          {onDone && (
            <Button variant="accent" block leading="🙏" onClick={onDone}>
              {t("visit.finish")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
