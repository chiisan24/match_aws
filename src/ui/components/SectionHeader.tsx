import type { ReactNode } from "react";

export interface SectionHeaderProps {
  /** Small uppercase eyebrow shown above the title (mikan accent). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Optional trailing action (e.g. a "see all" Button). */
  action?: ReactNode;
  /** Heading level for correct document outline (a11y). Defaults to h2. */
  as?: "h1" | "h2" | "h3";
}

/**
 * Titled section heading with an inked underline accent. Keeps headings
 * semantic so the page outline stays meaningful for assistive tech.
 */
export function SectionHeader({
  eyebrow,
  title,
  action,
  as: Heading = "h2",
}: SectionHeaderProps): JSX.Element {
  return (
    <header className="ek-section-header">
      <div className="ek-section-header__titles">
        {eyebrow != null && (
          <p className="ek-section-header__eyebrow">{eyebrow}</p>
        )}
        <Heading className="ek-section-header__title">{title}</Heading>
      </div>
      {action != null && (
        <div className="ek-section-header__action">{action}</div>
      )}
    </header>
  );
}
