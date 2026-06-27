import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "accent" | "soft" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. `accent` (mikan) is reserved for the primary action. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Optional leading adornment (icon / emoji). Decorative only. */
  leading?: ReactNode;
  children: ReactNode;
}

/**
 * Primary call-to-action button styled with the Ehime tokens.
 *
 * Renders a real <button> so keyboard and screen-reader semantics come for
 * free; defaults to `type="button"` to avoid accidental form submission.
 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  leading,
  children,
  className,
  type,
  ...rest
}: ButtonProps): JSX.Element {
  const classes = [
    "ek-btn",
    `ek-btn--${variant}`,
    size !== "md" ? `ek-btn--${size}` : "",
    block ? "ek-btn--block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type ?? "button"} className={classes} {...rest}>
      {leading != null && (
        <span aria-hidden="true" className="ek-btn__leading">
          {leading}
        </span>
      )}
      {children}
    </button>
  );
}
