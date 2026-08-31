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
  GeoPoint,
  PlacePhotoAttribution,
  RecommendedPlan,
  RouteCandidate,
  RouteCandidateKind,
} from "../../ports";
import { useOptionalDiscovery } from "../../app/DiscoveryContext";
import { useTourism } from "../../app/TourismContext";
import { debugSkipSwipeEnabled } from "../../config/debug";
import {
  CANDIDATE_MAXIMUM_COUNT,
  CANDIDATE_MINIMUM_COUNT,
  centerDistanceLabel,
  finalizeCandidates,
} from "../../domain/candidateFallback";
import { haversineDistanceMeters } from "../../domain/geofence";
import {
  spotFromRouteCandidate,
  spotsFromRouteCandidates,
} from "../../domain/routeCandidate";
import { DEFAULT_FALLBACK_POOLS } from "../../data/fallbackPools";
import { useI18n } from "../../i18n";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { GoogleTourismMap } from "../components/GoogleTourismMap";
import { PhotoCredit } from "../components/PhotoCredit";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { Tag } from "../components/Tag";
import { usePlacePhotos } from "./usePlacePhotos";
import { useWikipediaImage } from "./useWikipediaImage";

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

/**
 * デバッグでスワイプを飛ばすとき、残り候補の先頭から何件を自動で「興味あり」に
 * するか。ルートが空だと以降のステップが disabled になるため、後続の画面
 * （ルートプレビュー / 最終プラン）が成立する最小限だけ拾う。
 */
const DEBUG_SKIP_AUTO_PICK = 2;

/**
 * 写真が無い候補のサムネイル枠に入れる無地タイル（和紙色の地に細い斜線）。
 *
 * `<img>` の src として差し替えられるので、一覧側の既存のサイズ指定（3.5rem 角 /
 * 高さ 6rem）がそのまま効く。以前はここに種別ごとの固定写真（観光なら松山城）を
 * 当てていたため、写真の無い候補が全部同じ絵になり、しかも実在しない場所の写真を
 * 見せていた。
 */
const BLANK_PHOTO =
  "data:image/svg+xml;utf8,"
  + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">'
    + '<rect width="16" height="16" fill="#f3ece0"/>'
    + '<path d="M0 16 16 0" stroke="#e4dac6" stroke-width="1.5"/>'
    + "</svg>",
  );

function fallbackRouteTimes(count: number): string[] {
  const interval = Math.max(45, Math.min(90, Math.floor(600 / Math.max(1, count))));
  return Array.from({ length: count }, (_, index) => {
    const minutes = 9 * 60 + index * interval;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
}

function initialRouteFromTheme(theme: RecommendedPlan): {
  route: RouteCandidate[];
  times: string[];
} {
  const center = theme.area?.center
    ?? theme.stops.find((stop) => stop.place?.location)?.place?.location;
  const radiusMeters = Math.min(5_000, theme.area?.radiusMeters ?? 5_000);
  const seen = new Set<string>();
  const route: RouteCandidate[] = [];
  const times: string[] = [];

  theme.stops.forEach((stop, index) => {
    const place = stop.place;
    const location = place?.location;
    if (
      !place
      || !location
      || seen.has(place.id)
      || (center && haversineDistanceMeters(center, location) > radiusMeters)
    ) return;
    seen.add(place.id);
    route.push({
      id: `theme:${theme.id}:${index}:${place.id}`,
      kind: stop.kind,
      title: stop.title,
      description: stop.description,
      searchQuery: stop.searchQuery,
      place: { ...place, location },
    });
    times.push(stop.time);
  });

  return { route, times };
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

/**
 * この候補の写真を ja.wikipedia に探しに行ってよいか。
 *
 * 観光地だけ。城・美術館・山・神社は ja.wikipedia に記事があり、名前が一致すれば
 * その画像は信頼できる。一方で飲食店やカフェの記事はまず存在しないので、返って
 * くる「ヒット」は全文検索が拾った無関係な記事でしかない（`喫茶ニジ` のカードに
 * 他人の集合写真が出たのがこれ）。引かなければ誤りは起きず、失うものもない。
 *
 * custom（自由記述）も同じ理由で対象外。何が返るか事前に見当がつかない。
 */
function mayUseWikipediaPhoto(candidate: RouteCandidate): boolean {
  return candidate.kind === "sightseeing";
}

/** Google Places の帰属表示。Places 由来の写真を出しているときだけ描く。 */
function PlacesCredit({
  attributions,
}: {
  attributions: readonly PlacePhotoAttribution[];
}): JSX.Element | null {
  if (attributions.length === 0) return null;
  return (
    <small className="route-builder-card__credit">
      Photo: {attributions.map((item, index) => (
        <span key={`${item.displayName}-${index}`}>
          {index > 0 ? ", " : ""}
          {item.uri
            ? <a href={item.uri} target="_blank" rel="noreferrer">{item.displayName}</a>
            : item.displayName}
        </span>
      ))}
    </small>
  );
}

/**
 * 候補に使える Places の写真を、出どころの違いを畳んで返す。
 *
 * 一次候補（AI が名前を挙げ、API が Places で実在確認したもの）は `place.photoUrl`
 * を持って来る。カタログ由来の補完候補は持たない — OpenStreetMap の行には名前と
 * 座標しかないため。後者は {@link usePlacePhotos} が名前で引いて共有キャッシュに
 * 入れるので、ここで拾い上げる。
 */
function usePlacesPhoto(
  candidate: RouteCandidate,
  primaryErrored: boolean,
  cachedErrored: boolean,
): { src: string; attributions: readonly PlacePhotoAttribution[] } | null {
  // 任意依存。キャッシュが無い環境（プロバイダ未マウント、テストなど）でも
  // 一次候補の写真とプレースホルダーで成立させる。
  const discovery = useOptionalDiscovery();

  const primarySrc = primaryErrored ? undefined : candidate.place.photoUrl;
  if (primarySrc) {
    return { src: primarySrc, attributions: candidate.place.photoAttributions ?? [] };
  }
  if (cachedErrored) return null;

  const cached = discovery?.cachedPhoto(candidate.place.id);
  return cached
    ? { src: cached.photoUrl, attributions: cached.attributions }
    : null;
}

/**
 * スワイプカードの写真。優先順位は
 *   1. Google Places の実写真。一次候補は API が付けた `place.photoUrl`、
 *      カタログ由来の補完候補は施設名で引いた共有キャッシュ（{@link usePlacePhotos}）
 *   2. 観光地に限り、施設名で引いた ja.wikipedia の実写真（キー不要・CORS 可）
 *   3. 施設名を載せたプレースホルダー
 *
 * 以前は 3 が種別ごとの固定画像（観光なら松山城）だったため、写真の無い候補が
 * すべて同じ絵になり、しかも「ハタダ（みやげ）」に松山城が出るような取り違えが
 * 起きていた。実在しない写真を当てるより、無いことを示すほうが誤解が少ない。
 * 2 を観光地だけに絞ったのも同じ判断で、こちらは同じ取り違えが別経路で
 * 再発していた（{@link mayUseWikipediaPhoto}）。
 *
 * 1 に「名前で引いた Places」を足したのは、その厳格化で補完候補がほぼ全部
 * プレースホルダーになったため。実在の写真が Places にあるのに出せていない、
 * というのが残っていた穴だった。
 */
function CandidatePhoto({ candidate }: { candidate: RouteCandidate }): JSX.Element {
  const { t } = useI18n();
  const [placePhotoErrored, setPlacePhotoErrored] = useState(false);
  const [cachedPhotoErrored, setCachedPhotoErrored] = useState(false);
  const [wikiErrored, setWikiErrored] = useState(false);

  const places = usePlacesPhoto(candidate, placePhotoErrored, cachedPhotoErrored);
  const isPrimary = places != null && !placePhotoErrored && Boolean(candidate.place.photoUrl);

  // Places の写真が無い（または壊れている）ときだけ、しかも観光地に限って
  // 名前で Wikipedia を検索する。
  const wikiQuery = places === null && mayUseWikipediaPhoto(candidate)
    ? candidate.place.name
    : null;
  const wiki = useWikipediaImage(wikiQuery, wikiQuery !== null);
  const wikiReady = wiki.status === "ready" && !wikiErrored;
  // 検索しない候補で「検索中」と出し続けないよう、問い合わせている場合に限る。
  const searching = wikiQuery !== null && !wikiReady
    && (wiki.status === "loading" || wiki.status === "idle");

  return (
    <div className="route-builder-card__photo-wrap">
      {places ? (
        <>
          <img
            className="route-builder-card__photo"
            src={places.src}
            alt={candidate.place.name}
            onError={() =>
              isPrimary ? setPlacePhotoErrored(true) : setCachedPhotoErrored(true)
            }
          />
          <PlacesCredit attributions={places.attributions} />
        </>
      ) : wikiReady ? (
        <>
          <img
            className="route-builder-card__photo"
            src={wiki.photo.src}
            alt={candidate.place.name}
            onError={() => setWikiErrored(true)}
          />
          {/* Wikimedia の写真はライセンス上クレジットが必須。撮影者を出せない
              画像はフック側で弾いてあるので、ここに来た写真は必ず名前を出せる。 */}
          <PhotoCredit
            artist={wiki.photo.artist}
            license={wiki.photo.license}
            href={wiki.photo.descriptionUrl}
            overlay
          />
        </>
      ) : (
        <PlaceholderImage
          motif={candidate.kind === "sightseeing" ? "spot" : "mikan"}
          label={candidate.place.name}
          sublabel={searching ? t("visit.photoSearching") : t("visit.photoSoon")}
        />
      )}
    </div>
  );
}

/**
 * 一覧用の小さなサムネイル。写真の出どころは {@link CandidatePhoto} と同じ順序
 * （Places → 観光地なら名前で ja.wikipedia → 無地タイル）。どちらもキャッシュから
 * 読むだけなので、この一覧が通信を起こすことはない。
 *
 * サムネイルは名前がすぐ隣に並ぶぶんだけ取り違えが目につきやすい面もあるが、
 * 一致判定は {@link CandidatePhoto} と共通にしてある。片方だけ緩いと、同じ候補が
 * 画面によって違う写真を持つことになる。
 *
 * ただし Wikipedia 側は、クレジットの必要な写真をここでは使わない。40px の枠に
 * 撮影者名を読める形で収める方法がなく、Wikimedia の CC BY / BY-SA は「表示する
 * 場所ごとに著作者を示す」ことを求めるため。クレジット不要な写真（パブリック
 * ドメイン等）だけを通し、それ以外は無地タイルにする。
 */
function CandidateThumb({ candidate }: { candidate: RouteCandidate }): JSX.Element {
  const [placePhotoErrored, setPlacePhotoErrored] = useState(false);
  const [cachedPhotoErrored, setCachedPhotoErrored] = useState(false);
  const [wikiErrored, setWikiErrored] = useState(false);

  const places = usePlacesPhoto(candidate, placePhotoErrored, cachedPhotoErrored);
  const isPrimary = places != null && !placePhotoErrored && Boolean(candidate.place.photoUrl);

  const wikiQuery = places === null && mayUseWikipediaPhoto(candidate)
    ? candidate.place.name
    : null;
  const wiki = useWikipediaImage(wikiQuery, wikiQuery !== null);
  const creditFreeWiki = wiki.status === "ready"
    && !wikiErrored
    && !wiki.photo.requiresAttribution
    ? wiki.photo
    : null;

  if (places) {
    return (
      <img
        src={places.src}
        alt=""
        loading="lazy"
        onError={() =>
          isPrimary ? setPlacePhotoErrored(true) : setCachedPhotoErrored(true)
        }
      />
    );
  }
  if (creditFreeWiki) {
    return (
      <img
        src={creditFreeWiki.src}
        alt=""
        loading="lazy"
        onError={() => setWikiErrored(true)}
      />
    );
  }
  return <img src={BLANK_PHOTO} alt="" />;
}

function BinarySwipeDeck({
  candidates,
  index,
  center,
  minimumCount,
  onDecision,
}: {
  candidates: RouteCandidate[];
  index: number;
  /** 距離表示の基準となるエリア中心。未指定なら距離を表示しない。 */
  center?: GeoPoint;
  /** 候補確定に用いられた下限件数。これを下回るときは不足注記を表示する。 */
  minimumCount: number;
  onDecision: (interested: boolean) => void;
}): JSX.Element | null {
  const { t, lang } = useI18n();
  const current = candidates[index];
  const startX = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  useEffect(() => setOffsetX(0), [index]);
  const decide = useCallback((interested: boolean): void => {
    setOffsetX(0);
    startX.current = null;
    onDecision(interested);
  }, [onDecision]);

  // カタログ由来の補完候補は写真を持たないので、名前で Places に引きに行く。
  // 対象は表示中のカードと次の1枚だけ。1件ごとに課金されるうえ、利用者が
  // たどり着かない候補まで先に払う必要はない。一次候補は既に写真を持っているので
  // 除外する。結果は共有キャッシュに入り、カード側はそこから読む。
  const photoTargets = useMemo(
    () => [candidates[index], candidates[index + 1]]
      .filter((candidate): candidate is RouteCandidate =>
        candidate != null && !candidate.place.photoUrl)
      .map((candidate) => ({ id: candidate.place.id, name: candidate.place.name })),
    [candidates, index],
  );
  usePlacePhotos(photoTargets, lang);

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
  const distance = center
    ? centerDistanceLabel(haversineDistanceMeters(center, current.place.location))
    : null;

  return (
    <div className="route-builder-swipe">
      <p className="route-builder-swipe__progress" role="status">
        {t("routeBuilder.progress")
          .replace("{current}", String(index + 1))
          .replace("{total}", String(candidates.length))}
      </p>
      {candidates.length < minimumCount ? (
        <p className="route-builder-swipe__notice" role="status">
          {t("routeBuilder.shortageNotice").replace("{count}", String(candidates.length))}
        </p>
      ) : null}
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
              {current.source === "temple" ? (
                <Tag tone="moss" leading="🛕">{t("routeBuilder.templeTag")}</Tag>
              ) : null}
            </div>
            {distance ? (
              <small className="route-builder-card__distance">
                {t(distance.key).replace("{value}", distance.value)}
              </small>
            ) : null}
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
  // ストアへの書き込みは props のコールバックではなくコンテキスト経由で行う。
  // 「興味あり」の瞬間 (`decide`) にお気に入りへ入れる必要があり (Req 2.1)、
  // `onComplete` まで待つ経路では間に合わない。
  const { addFavorite, addSpotsToShiori } = useTourism();
  const initialSelection = useMemo(() => initialRouteFromTheme(theme), [theme]);
  const [stage, setStage] = useState<BuilderStage>("sightseeing");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [index, setIndex] = useState(0);
  const [route, setRoute] = useState<RouteCandidate[]>(() => initialSelection.route);
  const [routeTimes, setRouteTimes] = useState<string[]>(() => initialSelection.times);
  const [planStatus, setPlanStatus] = useState<LoadStatus>("idle");
  const [planError, setPlanError] = useState("");
  const [rejected, setRejected] = useState<RouteCandidate[]>([]);
  const [customRequest, setCustomRequest] = useState("");
  /**
   * 応答の `appliedRadiusMeters` を反映した実効エリア。半径が拡大された場合に
   * マップ範囲が立寄先を切り落とさないよう、プレビューへはこちらを渡す。
   */
  const [effectiveArea, setEffectiveArea] = useState<GeoArea | null>(null);
  /** 不足注記の判定に使う、候補確定に用いられた下限件数。 */
  const [minimumCount, setMinimumCount] = useState(CANDIDATE_MINIMUM_COUNT);
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
      const result = await chat.generateRouteCandidates({
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
      // 距離判定は「要求半径」ではなく「応答で実際に適用された半径」に従う。
      // サーバーが段階拡大した候補をクライアントが取りこぼさないようにする。
      const appliedRadius = Math.max(area.radiusMeters, result.appliedRadiusMeters);
      const bounded = result.candidates.filter(
        (candidate) => haversineDistanceMeters(area.center, candidate.place.location) <= appliedRadius,
      );
      // 最終ガード: サーバー応答が下限に届かない場合はクライアント側でも
      // ローカルデータから補完する（上限は CANDIDATE_MAXIMUM_COUNT）。
      const guarded = bounded.length >= result.minimumCount
        ? {
          candidates: bounded,
          appliedRadiusMeters: appliedRadius,
          minimumCount: result.minimumCount,
        }
        : finalizeCandidates(bounded, {
          kind,
          lang,
          center: area.center,
          baseRadiusMeters: area.radiusMeters,
          usedPlaceIds: routeContext.map((stop) => stop.placeId),
          maximumCount: CANDIDATE_MAXIMUM_COUNT,
          minimumCount: result.minimumCount,
        }, DEFAULT_FALLBACK_POOLS);
      if (guarded.candidates.length === 0) throw new Error(t("routeBuilder.loadError"));
      setCandidates(guarded.candidates);
      setMinimumCount(guarded.minimumCount);
      setEffectiveArea({
        center: area.center,
        radiusMeters: Math.max(appliedRadius, guarded.appliedRadiusMeters),
      });
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
      // 「興味あり」はその場でお気に入りへ (Req 2.1)。ルート挿入は従来どおり
      // 維持する (Req 2.2)。ルートから外してもお気に入りは残る (Req 2.5)。
      addFavorite(spotFromRouteCandidate(candidate, lang));
      setRoute((current) => current.some((item) => item.place.id === candidate.place.id)
        ? current
        : insertAlongRoute(current, candidate));
      setRejected((current) => current.filter((item) => item.id !== candidate.id));
    } else {
      // 「興味なし」はお気に入りに触れない (Req 2.4)。
      setRoute((current) => current.filter((item) => item.id !== candidate.id));
      setRejected((current) => current.some((item) => item.id === candidate.id)
        ? current
        : [...current, candidate]);
    }
    setIndex((current) => current + 1);
  }, [addFavorite, candidates, index, lang]);

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

  const candidateStage = stage === "sightseeing" || stage === "food" || stage === "cafe" || stage === "custom";
  const canDebugOpenFinal = route.length > 0
    || (candidateStage && status === "ready" && index < candidates.length);

  // ---- Debug-only skip shortcuts ----------------------------------------
  // Gated by `debugSkipSwipeEnabled`, so a production build drops both the
  // handlers and the UI below. Nothing here touches the normal swipe path.

  /** 残り候補の先頭から最大 count 件を自動で採用し、デッキを消化済みにする。 */
  const debugAutoAccept = useCallback((count: number): RouteCandidate[] => {
    let next = route;
    for (const candidate of candidates.slice(index, index + count)) {
      if (!next.some((item) => item.place.id === candidate.place.id)) {
        // 一括追加も通常のスワイプと同じくお気に入りへ入れる (Req 2.8)。
        addFavorite(spotFromRouteCandidate(candidate, lang));
        next = insertAlongRoute(next, candidate);
      }
    }
    setRoute(next);
    setIndex(candidates.length);
    return next;
  }, [addFavorite, candidates, index, lang, route]);

  /** 現在のデッキを飛ばして、そのステージのルートプレビューまで進める。 */
  const debugSkipDeck = useCallback((): void => {
    debugAutoAccept(DEBUG_SKIP_AUTO_PICK);
  }, [debugAutoAccept]);

  /** 残りのスワイプ・質問を全部飛ばして最終プランへ。 */
  const debugSkipToFinal = useCallback((): void => {
    if (!canDebugOpenFinal) return;
    const next = debugAutoAccept(DEBUG_SKIP_AUTO_PICK);
    if (next.length === 0) return;
    openFinal(next);
  }, [canDebugOpenFinal, debugAutoAccept, openFinal]);

  /**
   * ルートビルダーごと飛ばしてアプリ本体（地図タブ）へ。AI 旅程の立寄先
   * （`theme.stops`）をそのまま採用するので、スワイプも最終プラン生成も
   * 一切走らない。プラン作成フローを毎回通さずに先の画面を触りたいとき用。
   */
  const debugSkipScreen = useCallback((): void => {
    onComplete({
      ...theme,
      mode: "tourism",
      ...(area ? { area } : {}),
    });
  }, [area, onComplete, theme]);

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
    // 確定ルートをしおりへ流し込む (Req 4.1, 4.2)。到着予定時刻は Spot が持た
    // ないため引き継がない (下の `times` は画面表示と Active_Plan 用)。
    // `onComplete` はこの画面をアンマウントするので、書き込みを先に行う。
    // ルートが空なら追加は no-op になる (Req 4.9)。
    addSpotsToShiori(spotsFromRouteCandidates(route, lang));
    onComplete({
      ...theme,
      mode: "tourism",
      area,
      title: `${theme.title} — ${t("routeBuilder.myRoute")}`,
      imageUrl: route[0]?.place.photoUrl ?? theme.imageUrl,
      imageAttributions: route[0]?.place.photoAttributions ?? theme.imageAttributions,
      stops: route.map((candidate, stopIndex) => ({
        kind: candidate.kind,
        time: times[stopIndex],
        title: candidate.title,
        description: candidate.description,
        searchQuery: candidate.searchQuery,
        place: candidate.place,
      })),
    });
  };

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

      {/* Debug-only skip bar. Removed from production builds by the flag. */}
      {debugSkipSwipeEnabled && stage !== "final" ? (
        <div className="debug-skip" role="group" aria-label={t("debug.label")}>
          <span className="debug-skip__tag">{t("debug.label")}</span>
          <Button
            variant="ghost"
            size="sm"
            leading="⏭"
            disabled={!candidateStage || status !== "ready" || exhausted}
            onClick={debugSkipDeck}
          >
            {t("debug.skipSwipe")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leading="⏩"
            disabled={!canDebugOpenFinal}
            onClick={debugSkipToFinal}
          >
            {t("debug.skipToFinal")}
          </Button>
          <Button variant="ghost" size="sm" leading="⏏" onClick={debugSkipScreen}>
            {t("debug.skipScreen")}
          </Button>
        </div>
      ) : null}

      {candidateStage && status === "loading" ? (
        <Card className="route-builder__status" raised>
          <span className="plan-first-status__spinner" aria-hidden="true" />
          <p role="status">{t(`routeBuilder.loading.${stage}`)}</p>
        </Card>
      ) : null}

      {candidateStage && status === "error" ? (
        <Card className="route-builder__status route-builder__status--error" raised>
          <p role="alert">{error || t("routeBuilder.loadError")}</p>
          {/* 食事 / カフェ / リクエストは任意の工程で、質問画面にもスキップがある。
              面河渓のように周辺にカフェが実在しないエリアでは候補が 0 件になり、
              Candidate_API は 502 を返す（Req 3.5）。この場合いくら再試行しても
              候補は増えないので、再試行だけを出すと先へ進めなくなる。前へ進む
              出口を必ず併記する。観光は工程の土台なので再試行のみを残す。 */}
          {stage === "sightseeing" ? null : (
            <p className="route-builder__status-hint">{t("routeBuilder.loadErrorSkipHint")}</p>
          )}
          <div className="route-builder__actions">
            <Button variant="soft" onClick={() => void loadCandidates(stage, stage === "custom" ? customRequest : "")}>
              {t("routeBuilder.retry")}
            </Button>
            {stage === "sightseeing" ? null : (
              <Button variant="ghost" onClick={nextAfterDeck}>{t("routeBuilder.skip")}</Button>
            )}
          </div>
        </Card>
      ) : null}

      {candidateStage && status === "ready" && !exhausted ? (
        <>
          <div className="route-builder__step">
            <Tag tone="outline">{t(`routeBuilder.kind.${stage}`)}</Tag>
            <h2>{t(`routeBuilder.heading.${stage}`)}</h2>
            <p>{t(`routeBuilder.lead.${stage}`)}</p>
          </div>
          <BinarySwipeDeck
            candidates={candidates}
            index={index}
            {...(area ? { center: area.center } : {})}
            minimumCount={minimumCount}
            onDecision={decide}
          />
        </>
      ) : null}

      {exhausted ? (
        <Card className="route-builder__route-card" raised>
          {route.length > 0 && area ? <RoutePreview route={route} area={effectiveArea ?? area} /> : (
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
            ? <RoutePreview route={route} times={routeTimes} area={effectiveArea ?? area} />
            : <p role="alert">{t("routeBuilder.emptyRoute")}</p>}
          <Card className="route-builder-editor" raised>
            <h3>{t("routeBuilder.editTitle")}</h3>
            <ol>
              {route.map((candidate, routeIndex) => (
                <li key={candidate.id}>
                  <span className="route-builder-editor__number">{routeIndex + 1}</span>
                  <CandidateThumb candidate={candidate} />
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
                    <CandidateThumb candidate={candidate} />
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
