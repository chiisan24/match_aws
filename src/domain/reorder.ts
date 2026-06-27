/**
 * Pure shiori (旅程) reordering (Req 6.2 / Property 11).
 *
 * No I/O, no mutation of the input array.
 */

/**
 * Move the element at index `from` to index `to`, returning a new array.
 *
 * Guarantees (Property 11):
 * - The result has the same length as `items`.
 * - The result is a permutation of `items` (same multiset of elements).
 * - For an in-range `from` and a `to` clamped into `[0, length - 1]`, the moved
 *   element ends up at the target index.
 *
 * The input array is never mutated. Out-of-range `from` indices are treated as
 * a no-op (a shallow copy is returned) so the function is total and never throws.
 */
export function reorder<T>(items: T[], from: number, to: number): T[] {
  const result = items.slice();

  // Out-of-range source index: nothing to move — return an unchanged copy.
  if (from < 0 || from >= result.length) {
    return result;
  }

  const [moved] = result.splice(from, 1);

  // Clamp the destination into the valid insertion range of the now-shorter
  // array so the moved element always lands at a real index.
  const target = Math.max(0, Math.min(to, result.length));
  result.splice(target, 0, moved);

  return result;
}
