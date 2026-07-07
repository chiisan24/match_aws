/**
 * SpotContext — the app-wide spot catalogue, read through the {@link SpotPort}.
 *
 * Screens no longer import the static `EHIME_SPOTS` array directly; they read
 * the list from this provider, which is backed by the gateway's spot port:
 *   - mock gateway → real seed dataset + additions persisted in localStorage;
 *   - aws gateway  → seed + additions from the serverless API (DynamoDB), and
 *     `addSpot` writes through that API so new spots reach every client with no
 *     redeploy.
 *
 * The provider loads the catalogue once on mount and keeps it in state; adding
 * a spot delegates to the port and then prepends the created spot so it shows
 * on the 重ねるマップ immediately. Swapping mock↔aws needs no screen changes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { NewSpotInput, Spot, SpotPort } from "../ports";

// Re-exported so existing importers (e.g. TourismLayeredMap) keep working.
export type { NewSpotInput } from "../ports";

export interface SpotContextValue {
  /** The full catalogue (seed dataset + runtime additions). */
  spots: Spot[];
  /** True until the initial catalogue load resolves. */
  loading: boolean;
  /** Add one spot; resolves to the created {@link Spot}. */
  addSpot: (input: NewSpotInput) => Promise<Spot>;
}

const SpotContext = createContext<SpotContextValue | null>(null);

export interface SpotProviderProps {
  /** Catalogue backend (gateway.spots). */
  spots: SpotPort;
  children: ReactNode;
}

export function SpotProvider({
  spots: port,
  children,
}: SpotProviderProps): JSX.Element {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const list = await port.listSpots();
        if (!cancelled) setSpots(list);
      } catch {
        if (!cancelled) setSpots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port]);

  const addSpot = useCallback(
    async (input: NewSpotInput): Promise<Spot> => {
      const spot = await port.addSpot(input);
      // New spot first so it's easy to find after adding.
      setSpots((prev) => [spot, ...prev]);
      return spot;
    },
    [port],
  );

  const value = useMemo<SpotContextValue>(
    () => ({ spots, loading, addSpot }),
    [spots, loading, addSpot],
  );

  return <SpotContext.Provider value={value}>{children}</SpotContext.Provider>;
}

/** Access the spot catalogue. Throws outside a {@link SpotProvider}. */
export function useSpots(): SpotContextValue {
  const ctx = useContext(SpotContext);
  if (ctx === null) {
    throw new Error("useSpots must be used within a <SpotProvider>.");
  }
  return ctx;
}
