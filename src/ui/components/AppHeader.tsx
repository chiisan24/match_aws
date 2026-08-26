import { IconButton } from "./IconButton";

export interface AppHeaderProps {
  tourismLabel: string;
  /** Small caption above the app experience name. */
  currentLabel: string;
  /** Accessible name for the settings button. */
  settingsLabel: string;
  /** Open the settings screen. */
  onOpenSettings: () => void;
}

/** Persistent header for the tourism-only application. */
export function AppHeader({
  tourismLabel,
  currentLabel,
  settingsLabel,
  onOpenSettings,
}: AppHeaderProps): JSX.Element {
  return (
    <header className="ek-app-header">
      <div className="ek-app-header__brand">
        <span className="ek-app-header__mark" aria-hidden="true">🍊</span>
        <span className="ek-app-header__current">
          <span className="ek-app-header__current-label">{currentLabel}</span>
          <span className="ek-app-header__current-mode" data-testid="header-current-mode">
            {tourismLabel}
          </span>
        </span>
      </div>

      <div className="ek-app-header__actions">
        <IconButton
          label={settingsLabel}
          icon="⚙"
          onClick={onOpenSettings}
        />
      </div>
    </header>
  );
}
