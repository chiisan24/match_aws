/**
 * optimize-images.mjs — generate responsive, weight-optimized variants of the
 * app's heavy hero photos so mobile devices download a small image instead of
 * the multi-megabyte original.
 *
 * For each source it writes `<name>-<width>.jpg` (mozjpeg) and
 * `<name>-<width>.webp` variants alongside the original. The UI references
 * these via <picture> + srcset/sizes, so the browser picks the lightest file
 * that fits the layout and viewport (mobile → smallest).
 *
 * Run:  node scripts/optimize-images.mjs
 * (Originals are left untouched as the ultimate fallback.)
 */

import { fileURLToPath } from "node:url";
import { dirname, join, extname, basename } from "node:path";
import { stat } from "node:fs/promises";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const screens = join(root, "public", "images", "screens");

/** Sources and the widths (CSS px) to emit. Retina is covered by the top width. */
const TARGETS = [
  { file: join(screens, "welcome.jpg"), widths: [400, 640, 900] },
  { file: join(screens, "mode-tourism.jpg"), widths: [400, 800, 1200] },
  { file: join(screens, "mode-pilgrimage.jpg"), widths: [400, 800, 1200] },
];

const JPEG_OPTS = { quality: 72, mozjpeg: true };
const WEBP_OPTS = { quality: 70 };

async function kb(path) {
  try {
    return Math.round((await stat(path)).size / 102.4) / 10;
  } catch {
    return null;
  }
}

async function run() {
  for (const { file, widths } of TARGETS) {
    const ext = extname(file);
    const name = basename(file, ext);
    const orig = await kb(file);
    if (orig == null) {
      console.warn(`skip (missing): ${file}`);
      continue;
    }
    console.log(`\n${name}${ext}  (original ${orig} KB)`);

    const meta = await sharp(file).metadata();
    for (const w of widths) {
      // Never upscale beyond the source width.
      const target = meta.width ? Math.min(w, meta.width) : w;

      const jpgOut = join(screens, `${name}-${w}.jpg`);
      const webpOut = join(screens, `${name}-${w}.webp`);

      await sharp(file)
        .resize({ width: target, withoutEnlargement: true })
        .jpeg(JPEG_OPTS)
        .toFile(jpgOut);
      await sharp(file)
        .resize({ width: target, withoutEnlargement: true })
        .webp(WEBP_OPTS)
        .toFile(webpOut);

      console.log(
        `  ${w}w → jpg ${await kb(jpgOut)} KB / webp ${await kb(webpOut)} KB`,
      );
    }
  }
  console.log("\nDone.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
