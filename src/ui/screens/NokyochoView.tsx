/**
 * NokyochoView — the お遍路モード "nokyocho" tab, now built around the
 * 行った/行ってない マッチングアプリ風 tracker (Req 11.1–11.4) as its main
 * experience.
 *
 * The earlier デジタル納経帳 (記録フォーム＋記録一覧) proved confusing, so this
 * tab is simplified to the one thing users actually want here: sweeping through
 * every 札所 and tapping ○行った / ×行ってない to set and update their
 * 巡礼進捗. This mirrors the mockup's お遍路マッチ feel.
 *
 * This component is a thin container: it loads the selected 対象県's temples
 * through the {@link MapLocationPort} (mock by default — Req 8.5) and wires the
 * shared {@link usePilgrimage} visited set into {@link VisitTrackerScroll}.
 * Because the store persists the visited set resiliently, a failed save never
 * blocks the user — the on-screen choice always stands (Req 11.5) — and the
 * same visited set is read by the 巡礼進捗ダッシュボード / 札所マップ, so all
 * three stay in agreement (Req 11.4).
 */

import { useEffect, useState } from "react";

import { EHIME_TEMPLES } from "../../adapters/mock";
import { usePilgrimage } from "../../app/PilgrimageContext";
import type { Temple } from "../../domain/types";
import type { MapLocationPort } from "../../ports";
import { VisitTrackerScroll } from "./VisitTrackerScroll";

export interface NokyochoViewProps {
  /** Map/location backend; inject `gateway.map` in the app, a fake in tests. */
  map: MapLocationPort;
}

export function NokyochoView({ map }: NokyochoViewProps): JSX.Element {
  const { area, visited, setVisited } = usePilgrimage();

  const [temples, setTemples] = useState<Temple[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch the お遍路 (temple) data for the 行った/行ってない deck through the map
  // port (mock/AWS by default — Req 8.5). Mirrors the 通常観光モード SwipeDeck,
  // which seeds from fetched candidates and falls back to the curated
  // catalogue: when the port yields nothing (e.g. an area with no live dataset
  // yet) we fall back to the curated EHIME_TEMPLES so the deck is never empty.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const loaded = await map.getTemples(area);
        if (!cancelled) {
          setTemples(loaded.length > 0 ? loaded : EHIME_TEMPLES);
        }
      } catch {
        if (!cancelled) setTemples(EHIME_TEMPLES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, area]);

  return (
    <VisitTrackerScroll
      temples={temples}
      visited={visited}
      onSetVisited={setVisited}
      loading={loading}
    />
  );
}
