/**
 * Helpers for the responsive, weight-optimized hero photos under
 * `public/images/screens/`. The variant files (`<name>-<w>.jpg` / `.webp`) are
 * produced by `scripts/optimize-images.mjs`; these helpers build the matching
 * `srcSet` strings so the browser downloads the lightest file that fits the
 * layout (mobile → smallest), keeping the original only as a last-resort src.
 */

/** Strip a raster extension from a `public/` image path. */
function stripExt(src: string): string {
  return src.replace(/\.(jpe?g|png)$/i, "");
}

/** `"<base>-<w>.<ext> <w>w, …"` for a `<source srcSet>` / `<img srcSet>`. */
export function screenSrcSet(
  src: string,
  widths: number[],
  ext: "jpg" | "webp",
): string {
  const base = stripExt(src);
  return widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
}

/** A concrete mid-size variant used as the plain `src` fallback. */
export function screenFallback(src: string, width: number): string {
  return `${stripExt(src)}-${width}.jpg`;
}
