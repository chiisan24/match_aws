/**
 * Global debug-flow switch.
 *
 * The DEV guard prevents debug shortcuts and fixtures from being enabled in a
 * production build, even if the environment variable is set accidentally.
 */
export const debugModeEnabled =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_MODE === "true";
