import type { AppMode } from "../../app/modeManager";

export interface ModeToggleProps {
  /** Currently selected mode (highlighted). */
  mode: AppMode;
  tourismLabel: string;
  pilgrimageLabel: string;
  /** Selecting a segment switches to that mode. */
  onSelect: (mode: AppMode) => void;
  /** Accessible name for the toggle group. */
  ariaLabel: string;
  /** Compact variant for the header bar. */
  size?: "sm" | "md";
}

/**
 * Segmented mode switch shared by the header and the settings screen (Q4 — both
 * surfaces use the very same control and selection logic). Rendered as a radio
 * group so the active mode is announced and it is keyboard-operable; selecting
 * the inactive segment switches modes while preserving per-mode state.
 */
export function ModeToggle({
  mode,
  tourismLabel,
  pilgrimageLabel,
  onSelect,
  ariaLabel,
  size = "md",
}: ModeToggleProps): JSX.Element {
  const classes = ["ek-mode-toggle", size === "sm" ? "ek-mode-toggle--sm" : ""]
    .filter(Boolean)
    .join(" ");

  const segments: { id: AppMode; label: string }[] = [
    { id: "tourism", label: tourismLabel },
    { id: "pilgrimage", label: pilgrimageLabel },
  ];

  return (
    <div className={classes} role="radiogroup" aria-label={ariaLabel}>
      {segments.map((seg) => {
        const isActive = seg.id === mode;
        return (
          <button
            key={seg.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className="ek-mode-toggle__seg"
            onClick={() => onSelect(seg.id)}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
