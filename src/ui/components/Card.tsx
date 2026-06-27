import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Use the soft asymmetric "blob" radius for a more hand-crafted feel. */
  blob?: boolean;
  /** Stronger elevation. */
  raised?: boolean;
  /** Hover lift + pointer affordance (for clickable cards). */
  interactive?: boolean;
  /** Wrap children in a padded body. Set false to control padding yourself. */
  padded?: boolean;
  children: ReactNode;
}

/**
 * Generic surface container. Specific screens compose their own content inside.
 */
export function Card({
  blob = false,
  raised = false,
  interactive = false,
  padded = true,
  children,
  className,
  ...rest
}: CardProps): JSX.Element {
  const classes = [
    "ek-card",
    blob ? "ek-card--blob" : "",
    raised ? "ek-card--raised" : "",
    interactive ? "ek-card--interactive" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {padded ? <div className="ek-card__body">{children}</div> : children}
    </div>
  );
}
