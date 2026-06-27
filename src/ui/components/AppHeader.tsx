import type { AppMode } from "../../app/modeManager";
import { IconButton } from "./IconButton";
import { ModeToggle } from "./ModeToggle";

export interface AppHeaderProps {
  /** Currently selected mode, shown and reflected in the toggle. */
  mode: AppMode;
  tourismLabel: string;
  pilgrimageLabel: string;
  /** Small caption above the mode name (e.g. "現在のモード"). */
  currentLabel: string;
  /** Accessible name for the mode toggle. */
  switchAriaLabel: string;
  /** Accessible name for the settings button. */
  settingsLabel: string;
  /** Switch to the chosen mode (header toggle — Q4). */
  onSelectMode: (mode: AppMode) => void;
  /** Open the settings screen (the other mode-switch surface — Q4). */
  onOpenSettings: () => void;
}

/**
 * Persistent app header for the per-mode layouts (Req 2.4).
 *
 * Always shows the current mode and offers an inline mode-switch toggle, plus a
 * gear that opens settings (where the same toggle also lives — both surfaces
 * adopted per Q4). Presentational: the screen wires `useMode` / `useI18n` to it.
 */
export function AppHeader({
  mode,
  tourismLabel,
  pilgrimageLabel,
  currentLabel,
  switchAriaLabel,
  settingsLabel,
  onSelectMode,
  onOpenSettings,
}: AppHeaderProps): JSX.Element {
  const currentName = mode === "tourism" ? tourismLabel : pilgrimageLabel;

  return (
    <header className="ek-app-header">
      <div className="ek-app-header__brand">
        <span className="ek-app-header__mark" aria-hidden="true">
          🍊
        </span>
        <span className="ek-app-header__current">
          <span className="ek-app-header__current-label">{currentLabel}</span>
          <span className="ek-app-header__current-mode" data-testid="header-current-mode">
            {currentName}
          </span>
        </span>
      </div>

      <div className="ek-app-header__actions">
        <ModeToggle
          mode={mode}
          tourismLabel={tourismLabel}
          pilgrimageLabel={pilgrimageLabel}
          onSelect={onSelectMode}
          ariaLabel={switchAriaLabel}
          size="sm"
        />
        <IconButton
          label={settingsLabel}
          icon="⚙"
          onClick={onOpenSettings}
        />
      </div>
    </header>
  );
}
