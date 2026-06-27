/**
 * Pure map-layer filtering for the 重ねるマップ (Req 14.1-14.3 / Property 25).
 *
 * No I/O.
 */

import type { LayerKind, MapFeature } from "./types";

/**
 * Return the map features whose layer is in the active layer set (Req 14.1-14.3).
 *
 * Guarantees (Property 25): the result is exactly the set of features whose
 * `layer` is contained in `active` — covering overlay (add a layer), removal
 * (drop a layer), and multi-select (several active layers at once). Order is
 * preserved and the input arrays are never mutated.
 */
export function filterByLayers(
  features: MapFeature[],
  active: LayerKind[],
): MapFeature[] {
  const activeSet = new Set<LayerKind>(active);
  return features.filter((feature) => activeSet.has(feature.layer));
}
