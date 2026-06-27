export type PlaceholderMotif = "mikan" | "temple" | "spot";

export interface PlaceholderImageProps {
  /** Which hand-drawn motif to show. Defaults to a generic spot photo motif. */
  motif?: PlaceholderMotif;
  /** Primary caption (e.g. the spot / temple name). */
  label?: string;
  /** Secondary line, e.g. "写真は準備中です". */
  sublabel?: string;
  /** Optional fixed aspect ratio (e.g. "4 / 3"). Otherwise fills container. */
  aspectRatio?: string;
}

/**
 * Tasteful placeholder for images that are not yet provided (Req 4.7 / A3).
 *
 * Matching, spot and temple photos arrive later; until then this renders a
 * washi-textured tile with a simple hand-drawn mikan / temple motif so empty
 * slots still feel intentional and on-brand. Sized to fill its container by
 * default. Marked as an accessible image with the label as its alt text.
 */
export function PlaceholderImage({
  motif = "spot",
  label,
  sublabel = "写真は準備中です",
  aspectRatio,
}: PlaceholderImageProps): JSX.Element {
  const altText = label ? `${label}（${sublabel}）` : sublabel;

  return (
    <div
      className="ek-placeholder"
      role="img"
      aria-label={altText}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      <Motif motif={motif} />
      {label != null && <span className="ek-placeholder__label">{label}</span>}
      <span className="ek-placeholder__sub">{sublabel}</span>
    </div>
  );
}

function Motif({ motif }: { motif: PlaceholderMotif }): JSX.Element {
  const stroke = "var(--color-teal-700)";
  const accent = "var(--color-mikan-500)";

  if (motif === "mikan") {
    return (
      <svg
        className="ek-placeholder__motif"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="32" cy="36" r="20" fill={accent} opacity="0.9" />
        <path
          d="M32 16c4-6 11-7 14-5-2 4-7 7-11 7"
          fill="var(--color-moss-500)"
        />
        <path
          d="M32 16v6M22 36c2 3 16 3 20 0"
          stroke="var(--color-mikan-700)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    );
  }

  if (motif === "temple") {
    return (
      <svg
        className="ek-placeholder__motif"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        {/* roof */}
        <path
          d="M8 26 32 12l24 14H8Z"
          fill="var(--color-vermilion-500)"
          opacity="0.85"
        />
        {/* eaves */}
        <path d="M12 26h40" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* pillars */}
        <path
          d="M18 28v22M46 28v22M28 30v20M36 30v20"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M12 52h40" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // generic spot: mountains over sea
  return (
    <svg
      className="ek-placeholder__motif"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="46" cy="18" r="7" fill={accent} opacity="0.85" />
      <path
        d="M4 46 22 24l12 14 8-9 18 17Z"
        fill="var(--color-moss-500)"
        opacity="0.85"
      />
      <path
        d="M4 50c6 3 12-3 18 0s12 3 18 0 12-3 20 0"
        stroke="var(--color-teal-500)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
