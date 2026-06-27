export interface ProgressRingProps {
  /** Progress as a percentage 0–100. Values are clamped into range. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  /** Stroke thickness in px. */
  thickness?: number;
  /** Small caption rendered under the percentage (e.g. "達成"). */
  caption?: string;
  /** Accessible label describing what the ring measures. */
  label?: string;
}

/**
 * Circular progress indicator used for pilgrimage achievement (Req 9 screens).
 *
 * Exposes an ARIA progressbar so the value is announced to assistive tech, with
 * a redundant visible percentage in the center.
 */
export function ProgressRing({
  value,
  size = 96,
  thickness = 9,
  caption,
  label = "進捗",
}: ProgressRingProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const center = size / 2;

  return (
    <div
      className="ek-progress-ring"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          className="ek-progress-ring__track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
        />
        <circle
          className="ek-progress-ring__value"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="ek-progress-ring__label">
        <span className="ek-progress-ring__pct">{pct}%</span>
        {caption != null && (
          <span className="ek-progress-ring__caption">{caption}</span>
        )}
      </div>
    </div>
  );
}
