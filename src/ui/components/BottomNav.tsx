import type { ReactNode } from "react";

export interface BottomNavItem {
  /** Stable identifier for the destination. */
  id: string;
  label: string;
  /** Icon content (svg / emoji). Decorative; `label` is the accessible name. */
  icon: ReactNode;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  /** Currently active item id. */
  activeId: string;
  onSelect: (id: string) => void;
  /** Accessible label for the navigation landmark. */
  label?: string;
}

/**
 * Bottom navigation scaffold. Screens supply their own items; this only renders
 * the bar and wires selection. Rendered as a <nav> with buttons so it is
 * keyboard-operable and exposes the active item via aria-current.
 */
export function BottomNav({
  items,
  activeId,
  onSelect,
  label = "メインナビゲーション",
}: BottomNavProps): JSX.Element {
  return (
    <nav className="ek-bottom-nav" aria-label={label}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className="ek-bottom-nav__item"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="ek-bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="ek-bottom-nav__text">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
