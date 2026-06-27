import type { HTMLAttributes, ReactNode } from "react";

export type TagTone = "teal" | "accent" | "moss" | "outline";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
  /** Optional leading adornment (icon / emoji). Decorative only. */
  leading?: ReactNode;
  children: ReactNode;
}

/**
 * Small pill used for categories, statuses and badges. Inline, non-interactive.
 */
export function Tag({
  tone = "teal",
  leading,
  children,
  className,
  ...rest
}: TagProps): JSX.Element {
  const toneClass = tone === "teal" ? "" : `ek-tag--${tone}`;
  const classes = ["ek-tag", toneClass, className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {leading != null && <span aria-hidden="true">{leading}</span>}
      {children}
    </span>
  );
}
