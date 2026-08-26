import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type {
  ChatPort,
  GeoArea,
  RecommendedPlan,
  RouteCandidate,
  RouteCandidateKind,
} from "../../ports";
import { haversineDistanceMeters } from "../../domain/geofence";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { GoogleTourismMap } from "../components/GoogleTourismMap";
import { Tag } from "../components/Tag";

interface TourismRouteBuilderProps {
  chat: ChatPort;
  theme: RecommendedPlan;
  onBack: () => void;
  onComplete: (plan: RecommendedPlan) => void;
}

type BuilderStage =
  | "sightseeing"
  | "food-question"
  | "food"
  | "cafe-question"
  | "cafe"
  | "custom-question"
  | "custom"
  | "final";

type LoadStatus = "idle" | "loading" | "ready" | "error";

const FALLBACK_IMAGE: Record<RouteCandidateKind, string> = {
  sightseeing: "/images/ehime/matsuyama-castle.jpg",
  food: "/images/ehime/michi-no-eki.jpg",
  cafe: "/images/ehime/brick-studio.jpg",
  custom: "/images/ehime/kurushima-bridge.jpg",
};

function fallbackRouteTimes(count: number): string[] {
  const interval = Math.max(45, Math.min(90, Math.floor(600 / Math.max(1, count))));
  return Array.from({ length: count }, (_, index) => {
    const minutes = 9 * 60 + index * interval;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
}

function insertAlongRoute(
  route: RouteCandidate[],
  candidate: RouteCandidate,
): RouteCandidate[] {
  if (route.length === 0 || candidate.kind === "sightseeing") return [...route, candidate];
  let bestIndex = route.length;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= route.length; index += 1) {
    const previous = route[index - 1]?.place.location;
    const next = route[index]?.place.location;
    const location = candidate.place.location;
    const cost = previous && next
      ? haversineDistanceMeters(previous, location)
        + haversineDistanceMeters(location, next)
        - haversineDistanceMeters(previous, next)
      : previous
        ? haversineDistanceMeters(previous, location)
        : next
          ? haversineDistanceMeters(location, next)
          : 0;
    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = index;
    }
  }
  const result = [...route];
  result.splice(bestIndex, 0, candidate);
  return result;
}

function CandidatePhoto({ candidate }: { candidate: RouteCandidate }): JSX.Element {
  const src = candidate.place.photoUrl ?? FALLBACK_IMAGE[candidate.kind];
  return (
    <div className="route-builder-card__photo-wrap">
      <img
        className="route-builder-card__photo"
        src={src}
        alt={candidate.place.name}
        onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE[candidate.kind]; }}
      />
      {candidate.place.photoAttributions?.length ? (
        <small className="route-builder-card__credit">
          Photo: {candidate.place.photoAttributions.map((item, index) => (
            <span key={`${item.displayName}-${index}`}>
              {index > 0 ? ", " : ""}
              {item.uri ? <a href={item.uri} target="_blank" rel="noreferrer">{item.displayName}</a> : item.displayName}
            </span>
          ))}
        </small>
      ) : null}
    </div>
  );
}

function BinarySwipeDeck({
  candidates,
  index,
  onDecision,
}: {
  candidates: RouteCandidate[];
  index: number;
  onDecision: (interested: boolean) => void;
}): JSX.Element | null {
  const { t } = useI18n();
  const current = candidates[index];
  const startX = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  useEffect(() => setOffsetX(0), [index]);
  const decide = useCallback((interested: boolean): void => {
    setOffsetX(0);
    startX.current = null;
    onDecision(interested);
  }, [onDecision]);

  if (!current) return null;
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (startX.current != null) setOffsetX(event.clientX - startX.current);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (startX.current == null) return;
    const distance = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(distance) >= 80) decide(distance > 0);
    else setOffsetX(0);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    decide(event.key === "ArrowRight");
  };
  const leaning = Math.abs(offsetX) > 20 ? (offsetX > 0 ? "like" : "skip") : null;

  return (
    <div className="route-builder-swipe">
      <p className="route-builder-swipe__progress" role="status">
        {t("routeBuilder.progress")
          .replace("{current}", String(index + 1))
          .replace("{total}", String(candidates.length))}
      </p>
      <div className="route-builder-swipe__stage">
        {candidates[index + 1] ? (
          <div className="route-builder-card route-builder-card--peek" aria-hidden="true">
            <CandidatePhoto candidate={candidates[index + 1]} />
          </div>
        ) : null}
        <div
          className={`route-builder-card${leaning ? ` route-builder-card--${leaning}` : ""}`}
          style={{ transform: `translateX(${offsetX}px) rotate(${offsetX / 24}deg)` }}
          role="group"
          tabIndex={0}
          aria-label={current.title}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { startX.current = null; setOffsetX(0); }}
          onKeyDown={onKeyDown}
        >
          {leaning ? (
            <span className={`route-builder-card__badge route-builder-card__badge--${leaning}`}>
              {t(leaning === "like" ? "routeBuilder.interested" : "routeBuilder.notInterested")}
            </span>
          ) : null}
          <CandidatePhoto candidate={current} />
          <div className="route-builder-card__body">
            <div className="route-builder-card__title-row">
              <h2>{current.title}</h2>
              <Tag tone={current.kind === "food" || current.kind === "cafe" ? "accent" : "teal"}>
                {t(`routeBuilder.kind.${current.kind}`)}
              </Tag>
            </div>
            <p>{current.description}</p>
            {current.place.rating != null ? (
              <small>★ {current.place.rating} ({current.place.userRatingCount ?? 0})</small>
            ) : null}
            {current.place.formattedAddress ? <address>{current.place.formattedAddress}</address> : null}
          </div>
        </div>
      </div>
      <div className="route-builder-swipe__actions">
        <Button variant="ghost" size="lg" leading="✕" onClick={() => decide(false)}>
          {t("routeBuilder.notInterested")}
        </Button>
        <Button variant="accent" size="lg" leading="♥" onClick={() => decide(true)}>
          {t("routeBuilder.interested")}
        </Button>
      </div>
      <p className="route-builder-swipe__hint">{t("routeBuilder.swipeHint")}</p>
    </div>
  );
}
function RoutePreview({
  route,
  times = [],
  area,
}: {
  route: RouteCandidate[];
  times?: string[];
  area: GeoArea;
}): JSX.Element {
  const { t } = useI18n();
  const [selected, setSelected] = useState<RouteCandidate | null>(null);
  const items = useMemo(() => route.map((candidate, index) => ({
    ...candidate,
    label: candidate.place.name,
    location: candidate.place.location,
    order: index + 1,
  })), [route]);
  return (
    <section className="route-builder-preview" aria-labelledby="route-preview-title">
      <h2 id="route-preview-title">{t("routeBuilder.routeTitle")}</h2>
      <p>{t("routeBuilder.routeLead").replace("{count}", String(route.length))}</p>
      <GoogleTourismMap
        className="route-builder-preview__map"
        ariaLabel={t("routeBuilder.routeTitle")}
        items={items}
        area={area}
        selectedId={selected?.id}
        onSelect={setSelected}
        showDirections
        fallback={<div className="route-builder-preview__fallback">{t("routeBuilder.mapFallback")}</div>}
      />
      {selected ? <p className="route-builder-preview__selected">📍 {selected.place.name}</p> : null}
      <ol className="route-builder-preview__list">
        {route.map((candidate, index) => (
          <li key={candidate.id}>
            {times[index] ? <time dateTime={times[index]}>🕘 {times[index]}</time> : null}
            <span>{candidate.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TourismRouteBuilder({
  chat,
  theme,
  onBack,
  onComplete,
}: TourismRouteBuilderProps): JSX.Element {
  const { t, lang } = useI18n();
  const [stage, setStage] = useState<BuilderStage>("sightseeing");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [index, setIndex] = useState(0);
  const [route, setRoute] = useState<RouteCandidate[]>([]);
  const [routeTimes, setRouteTimes] = useState<string[]>([]);
  const [planStatus, setPlanStatus] = useState<LoadStatus>("idle");
  const [planError, setPlanError] = useState("");
  const [rejected, setRejected] = useState<RouteCandidate[]>([]);
  const [customRequest, setCustomRequest] = useState("");
  const started = useRef(false);

  const area = useMemo<GeoArea | null>(() => {
    const center = theme.area?.center
      ?? theme.stops.find((stop) => stop.place?.location)?.place?.location;
    if (!center) return null;
    return {
      center,
      radiusMeters: Math.min(5_000, theme.area?.radiusMeters ?? 5_000),
    };
  }, [theme]);

  const routeContext = useMemo(() => route.map((candidate) => ({
    title: candidate.title,
    placeId: candidate.place.id,
    location: candidate.place.location,
  })), [route]);

  const loadCandidates = useCallback(async (
    kind: RouteCandidateKind,
    request = "",
  ): Promise<void> => {
    setStage(kind);
    setStatus("loading");
    setError("");
    setCandidates([]);
    setIndex(0);
    if (!area) {
      setError(t("routeBuilder.loadError"));
      setStatus("error");
      return;
    }
    try {
      const next = await chat.generateRouteCandidates({
        lang,
        kind,
        theme: {
          id: theme.id,
          title: theme.title,
          summary: theme.summary,
          reason: theme.reason,
        },
        area,
        route: routeContext,
        ...(request ? { customRequest: request } : {}),
        count: kind === "cafe" ? 4 : 6,
      });
      const bounded = next.filter(
        (candidate) => haversineDistanceMeters(area.center, candidate.place.location) <= area.radiusMeters,
      );
      if (bounded.length === 0) throw new Error(t("routeBuilder.loadError"));
      setCandidates(bounded);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("routeBuilder.loadError"));
      setStatus("error");
    }
  }, [area, chat, lang, routeContext, t, theme]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadCandidates("sightseeing");
  }, [loadCandidates]);

  const decide = useCallback((interested: boolean): void => {
    const candidate = candidates[index];
    if (!candidate) return;
    if (interested) {
      setRoute((current) => current.some((item) => item.place.id === candidate.place.id)
        ? current
        : insertAlongRoute(current, candidate));
      setRejected((current) => current.filter((item) => item.id !== candidate.id));
    } else {
      setRoute((current) => current.filter((item) => item.id !== candidate.id));
      setRejected((current) => current.some((item) => item.id === candidate.id)
        ? current
        : [...current, candidate]);
    }
    setIndex((current) => current + 1);
  }, [candidates, index]);

  const generateFinalPlan = useCallback(async (selectedRoute: RouteCandidate[]): Promise<void> => {
    setRoute(selectedRoute);
    setRouteTimes(fallbackRouteTimes(selectedRoute.length));
    setPlanStatus("loading");
    setPlanError("");
    try {
      const plan = await chat.generateTourismRoutePlan({
        lang,
        theme: {
          id: theme.id,
          title: theme.title,
          summary: theme.summary,
          reason: theme.reason,
          transport: theme.transport,
        },
        selectedStops: selectedRoute.map((candidate) => ({
          candidateId: candidate.id,
          kind: candidate.kind,
          title: candidate.title,
          location: candidate.place.location,
        })),
        startTime: "09:00",
      });
      const byId = new Map(selectedRoute.map((candidate) => [candidate.id, candidate] as const));
      const ordered = plan.stops
        .map((stop) => byId.get(stop.candidateId))
        .filter((candidate): candidate is RouteCandidate => candidate != null);
      if (ordered.length !== selectedRoute.length) throw new Error(t("routeBuilder.planError"));
      setRoute(ordered);
      setRouteTimes(plan.stops.map((stop) => stop.time));
      setPlanStatus("ready");
    } catch (cause) {
      setPlanError(cause instanceof Error ? cause.message : t("routeBuilder.planError"));
      setPlanStatus("error");
    }
  }, [chat, lang, t, theme]);

  const openFinal = useCallback((selectedRoute: RouteCandidate[] = route): void => {
    setStage("final");
    void generateFinalPlan(selectedRoute);
  }, [generateFinalPlan, route]);

  const removeFromRoute = (candidate: RouteCandidate, routeIndex: number): void => {
    setRoute((current) => current.filter((item) => item.id !== candidate.id));
    setRouteTimes((current) => current.filter((_, index) => index !== routeIndex));
    setRejected((current) => current.some((item) => item.id === candidate.id)
      ? current
      : [...current, candidate]);
  };
  const restoreCandidate = (candidate: RouteCandidate): void => {
    const nextRoute = route.some((item) => item.place.id === candidate.place.id)
      ? route
      : insertAlongRoute(route, candidate);
    setRejected((current) => current.filter((item) => item.id !== candidate.id));
    openFinal(nextRoute);
  };
  const moveRoute = (from: number, delta: -1 | 1): void => {
    setRoute((current) => {
      const to = from + delta;
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };
  const complete = (): void => {
    if (!area) return;
    const times = routeTimes.length === route.length
      ? routeTimes
      : fallbackRouteTimes(route.length);
    onComplete({
      ...theme,
      mode: "tourism",
      area,
      title: `${theme.title} — ${t("routeBuilder.myRoute")}`,
      imageUrl: route[0]?.place.photoUrl ?? theme.imageUrl,
      imageAttributions: route[0]?.place.photoAttributions ?? theme.imageAttributions,
      stops: route.map((candidate, stopIndex) => ({
        time: times[stopIndex],
        title: candidate.title,
        description: candidate.description,
        searchQuery: candidate.searchQuery,
        place: candidate.place,
      })),
    });
  };

  const candidateStage = stage === "sightseeing" || stage === "food" || stage === "cafe" || stage === "custom";
  const exhausted = candidateStage && status === "ready" && index >= candidates.length;
  const nextAfterDeck = (): void => {
    if (stage === "sightseeing") setStage("food-question");
    else if (stage === "food") setStage("cafe-question");
    else if (stage === "cafe") setStage("custom-question");
    else openFinal();
  };

  return (
    <section className="route-builder" aria-labelledby="route-builder-title">
      <header className="route-builder__header">
        <Button variant="ghost" size="sm" leading="←" onClick={onBack}>{t("routeBuilder.back")}</Button>
        <p className="route-builder__kicker">AI ROUTE BUILDER</p>
        <h1 id="route-builder-title">{theme.icon} {theme.title}</h1>
        <p>{theme.summary}</p>
      </header>

      {candidateStage && status === "loading" ? (
        <Card className="route-builder__status" raised>
          <span className="plan-first-status__spinner" aria-hidden="true" />
          <p role="status">{t(`routeBuilder.loading.${stage}`)}</p>
        </Card>
      ) : null}

      {candidateStage && status === "error" ? (
        <Card className="route-builder__status route-builder__status--error" raised>
          <p role="alert">{error || t("routeBuilder.loadError")}</p>
          <Button variant="soft" onClick={() => void loadCandidates(stage, stage === "custom" ? customRequest : "")}>
            {t("routeBuilder.retry")}
          </Button>
        </Card>
      ) : null}

      {candidateStage && status === "ready" && !exhausted ? (
        <>
          <div className="route-builder__step">
            <Tag tone="outline">{t(`routeBuilder.kind.${stage}`)}</Tag>
            <h2>{t(`routeBuilder.heading.${stage}`)}</h2>
            <p>{t(`routeBuilder.lead.${stage}`)}</p>
          </div>
          <BinarySwipeDeck candidates={candidates} index={index} onDecision={decide} />
        </>
      ) : null}

      {exhausted ? (
        <Card className="route-builder__route-card" raised>
          {route.length > 0 && area ? <RoutePreview route={route} area={area} /> : (
            <p role="alert">{t("routeBuilder.emptyRoute")}</p>
          )}
          <div className="route-builder__actions">
            <Button
              variant="soft"
              onClick={() => { setIndex(0); setStatus("ready"); }}
            >
              {t("routeBuilder.reviewAgain")}
            </Button>
            <Button variant="accent" disabled={route.length === 0} onClick={nextAfterDeck}>
              {t("routeBuilder.next")}
            </Button>
          </div>
        </Card>
      ) : null}

      {stage === "food-question" ? (
        <Card className="route-builder__question" raised>
          <span className="route-builder__question-icon">🍽️</span>
          <h2>{t("routeBuilder.foodQuestion")}</h2>
          <p>{t("routeBuilder.foodQuestionLead")}</p>
          <div className="route-builder__actions">
            <Button variant="ghost" onClick={() => setStage("cafe-question")}>{t("routeBuilder.skip")}</Button>
            <Button variant="accent" onClick={() => void loadCandidates("food")}>{t("routeBuilder.findFood")}</Button>
          </div>
        </Card>
      ) : null}

      {stage === "cafe-question" ? (
        <Card className="route-builder__question" raised>
          <span className="route-builder__question-icon">☕</span>
          <h2>{t("routeBuilder.cafeQuestion")}</h2>
          <p>{t("routeBuilder.cafeQuestionLead")}</p>
          <div className="route-builder__actions">
            <Button variant="ghost" onClick={() => setStage("custom-question")}>{t("routeBuilder.skip")}</Button>
            <Button variant="accent" onClick={() => void loadCandidates("cafe")}>{t("routeBuilder.findCafe")}</Button>
          </div>
        </Card>
      ) : null}

      {stage === "custom-question" ? (
        <Card className="route-builder__question" raised>
          <span className="route-builder__question-icon">✨</span>
          <h2>{t("routeBuilder.customQuestion")}</h2>
          <p>{t("routeBuilder.customQuestionLead")}</p>
          <form
            className="route-builder__custom-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (customRequest.trim()) void loadCandidates("custom", customRequest.trim());
            }}
          >
            <input
              value={customRequest}
              onChange={(event) => setCustomRequest(event.target.value)}
              placeholder={t("routeBuilder.customPlaceholder")}
              maxLength={160}
            />
            <Button type="submit" variant="accent" disabled={!customRequest.trim()}>{t("routeBuilder.findCustom")}</Button>
          </form>
          <Button variant="ghost" onClick={() => openFinal()}>{t("routeBuilder.skip")}</Button>
        </Card>
      ) : null}
      {stage === "final" ? (
        <div className="route-builder-final">
          <div className="route-builder__step">
            <Tag tone="accent">{t("routeBuilder.finalTag")}</Tag>
            <h2>{t("routeBuilder.finalTitle")}</h2>
            <p>{t("routeBuilder.finalLead")}</p>
          </div>
          {planStatus === "loading" ? (
            <Card className="route-builder__status" raised>
              <span className="plan-first-status__spinner" aria-hidden="true" />
              <p role="status">{t("routeBuilder.planLoading")}</p>
            </Card>
          ) : null}
          {planStatus === "error" ? (
            <Card className="route-builder__status route-builder__status--error" raised>
              <p role="alert">{planError || t("routeBuilder.planError")}</p>
              <p>{t("routeBuilder.planFallback")}</p>
              <Button variant="soft" onClick={() => void generateFinalPlan(route)}>
                {t("routeBuilder.planRetry")}
              </Button>
            </Card>
          ) : null}
          {route.length > 0 && area
            ? <RoutePreview route={route} times={routeTimes} area={area} />
            : <p role="alert">{t("routeBuilder.emptyRoute")}</p>}
          <Card className="route-builder-editor" raised>
            <h3>{t("routeBuilder.editTitle")}</h3>
            <ol>
              {route.map((candidate, routeIndex) => (
                <li key={candidate.id}>
                  <span className="route-builder-editor__number">{routeIndex + 1}</span>
                  <img src={candidate.place.photoUrl ?? FALLBACK_IMAGE[candidate.kind]} alt="" />
                  <span className="route-builder-editor__details">
                    <time className="route-builder-editor__time" dateTime={routeTimes[routeIndex]}>
                      {routeTimes[routeIndex] ?? "--:--"}
                    </time>
                    <span className="route-builder-editor__name">{candidate.title}</span>
                  </span>
                  <span className="route-builder-editor__buttons">
                    <button type="button" disabled={routeIndex === 0} onClick={() => moveRoute(routeIndex, -1)} aria-label={t("routeBuilder.moveUp")}>↑</button>
                    <button type="button" disabled={routeIndex === route.length - 1} onClick={() => moveRoute(routeIndex, 1)} aria-label={t("routeBuilder.moveDown")}>↓</button>
                    <button type="button" onClick={() => removeFromRoute(candidate, routeIndex)} aria-label={`${t("routeBuilder.remove")} ${candidate.title}`}>✕</button>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          {rejected.length > 0 ? (
            <Card className="route-builder-rejected">
              <h3>{t("routeBuilder.addAlternatives")}</h3>
              <div className="route-builder-rejected__list">
                {rejected.map((candidate) => (
                  <button key={candidate.id} type="button" onClick={() => restoreCandidate(candidate)}>
                    <img src={candidate.place.photoUrl ?? FALLBACK_IMAGE[candidate.kind]} alt="" />
                    <span>＋ {candidate.title}</span>
                  </button>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="route-builder-final__actions">
            <Button variant="soft" onClick={() => setStage("custom-question")}>{t("routeBuilder.addCustom")}</Button>
            <Button variant="soft" disabled={route.length === 0 || planStatus === "loading"} onClick={() => void generateFinalPlan(route)}>
              {t("routeBuilder.reoptimize")}
            </Button>
            <Button variant="accent" size="lg" disabled={route.length === 0 || planStatus === "loading"} onClick={complete}>
              {t("routeBuilder.complete")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
