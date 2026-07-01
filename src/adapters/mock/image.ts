/**
 * Mock ImagePort adapter — self-generated, royalty-free images.
 *
 * The real product generates spot/temple photos with a generative-AI model on
 * AWS (Amazon Bedrock — see the aws adapter). For the default mock backend we
 * can't call AWS, so instead of leaving an empty slot we synthesize a tasteful,
 * on-brand SVG "scene" tinted by the spot category and varied per subject id.
 *
 * Because the image is generated locally from primitives there is no third-party
 * content and nothing to license — it is genuinely royalty-free (Q3). It returns
 * a `data:` URL usable directly as an `<img src>`, after a small artificial
 * delay so the UI's "生成中" state is exercised just like the real backend.
 */

import type { GeneratedImage, ImagePort, ImagePrompt } from "../../ports";

/** Category → scene palette (sky top, sky bottom, land, water/accent). */
const PALETTES: Record<string, [string, string, string, string]> = {
  onsen: ["#fdebd0", "#f6c6a8", "#9c5a4a", "#e08a6a"],
  sightseeing: ["#cfeaf3", "#a7d8e8", "#5a8f57", "#3f7e8c"],
  food: ["#fce8d6", "#f4b97f", "#c2682f", "#e0913f"],
  souvenir: ["#efe6f6", "#cdbbe6", "#6f5a99", "#9b7fc4"],
  default: ["#d7eef0", "#aedbe0", "#5e9a72", "#3f8aa0"],
};

/** Cheap deterministic hash so the same subject always yields the same scene. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Builds a 4:3 SVG scene (gradient sky, sun, hills, water band) as a string. */
function buildSvg(prompt: ImagePrompt): string {
  const palette = PALETTES[prompt.category ?? "default"] ?? PALETTES.default!;
  const [skyTop, skyBottom, land, water] = palette;
  const h = hash(prompt.id);

  // Per-subject variation: sun position and hill heights.
  const sunX = 70 + (h % 220);
  const sunY = 60 + ((h >> 3) % 60);
  const hillA = 250 + ((h >> 5) % 50);
  const hillB = 230 + ((h >> 9) % 70);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384" viewBox="0 0 512 384">`,
    `<defs>`,
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${skyTop}"/>`,
    `<stop offset="1" stop-color="${skyBottom}"/>`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="512" height="384" fill="url(#sky)"/>`,
    `<circle cx="${sunX}" cy="${sunY}" r="34" fill="#ffd27a" opacity="0.9"/>`,
    // back hill
    `<path d="M0 ${hillA} Q128 ${hillA - 70} 256 ${hillA} T512 ${hillA} V384 H0 Z" fill="${land}" opacity="0.55"/>`,
    // front hill
    `<path d="M0 ${hillB + 30} Q160 ${hillB - 40} 320 ${hillB + 20} T512 ${hillB + 10} V384 H0 Z" fill="${land}" opacity="0.85"/>`,
    // water band
    `<rect x="0" y="336" width="512" height="48" fill="${water}" opacity="0.8"/>`,
    `<path d="M0 350 q32 -10 64 0 t64 0 t64 0 t64 0 t64 0 t64 0 t64 0" stroke="#ffffff" stroke-opacity="0.4" stroke-width="3" fill="none"/>`,
    `</svg>`,
  ].join("");
}

export class MockImageAdapter implements ImagePort {
  /** Optional simulated latency (ms) before returning the image. */
  constructor(private readonly delayMs = 350) {}

  async generateImage(prompt: ImagePrompt): Promise<GeneratedImage | null> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    const svg = buildSvg(prompt);
    // utf8 data URL (subject text is never embedded, so this stays ASCII-safe).
    const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return { src, source: "ai-mock" };
  }
}
