/**
 * TypeScript mirror of the design tokens declared in `tokens.css` (Req 18.1).
 *
 * Components that need token values in logic (e.g. computing an SVG stroke for
 * the ProgressRing) should import from here so there is a single conceptual
 * source of truth. Visual styling still flows through CSS custom properties;
 * these constants reference the same variables via `var(--...)` where they are
 * consumed as inline styles, and expose raw values where computation is needed.
 */

/** Raw hex values, kept in sync with the `:root` block in tokens.css. */
export const colors = {
  teal900: "#143f3c",
  teal800: "#1d544f",
  teal700: "#2b7a78",
  teal600: "#379490",
  teal500: "#3aafa9",
  teal300: "#8fd3ce",
  teal100: "#def2f1",
  teal50: "#f0f9f8",
  moss700: "#4a6b3f",
  moss500: "#6f9460",
  moss100: "#e6efdf",
  mikan700: "#c96a14",
  mikan500: "#f08a24",
  mikan300: "#f8b56b",
  mikan100: "#fde7cf",
  vermilion500: "#b5462f",
  paper: "#fbf7f0",
  paperDeep: "#f3ece0",
  surface: "#fffdf9",
  ink: "#2a2a28",
  inkSoft: "#5a5750",
  inkFaint: "#8a857c",
} as const;

/** CSS custom property references for use as inline style values. */
export const cssVar = {
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  text: "var(--color-text)",
  surface: "var(--color-surface)",
  radiusMd: "var(--radius-md)",
  radiusPill: "var(--radius-pill)",
  spaceColumn: "var(--app-max-width)",
} as const;

export const space = {
  s1: "0.375rem",
  s2: "0.625rem",
  s3: "1rem",
  s4: "1.5rem",
  s5: "2.25rem",
  s6: "3.25rem",
} as const;

export const radius = {
  xs: "6px",
  sm: "10px",
  md: "16px",
  lg: "22px",
  pill: "999px",
  blob: "18px 20px 16px 22px",
} as const;

export type ColorToken = keyof typeof colors;
