import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required accessible name — the icon itself conveys no text (a11y). */
  label: string;
  /** Icon content (svg / emoji). Marked decorative; `label` is authoritative. */
  icon: ReactNode;
  accent?: boolean;
}

/**
 * Circular icon-only button. Because there is no visible text, an accessible
 * `label` is mandatory and applied via aria-label.
 */
export function IconButton({
  label,
  icon,
  accent = false,
  className,
  type,
  ...rest
}: IconButtonProps): JSX.Element {
  const classes = [
    "ek-icon-btn",
    accent ? "ek-icon-btn--accent" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type ?? "button"}
      className={classes}
      aria-label={label}
      title={label}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
