/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AWS_REGION?: string;
  readonly VITE_AWS_IDENTITY_POOL_ID?: string;
  readonly VITE_AWS_API_ENDPOINT?: string;
  readonly VITE_AWS_LOCATION_MAP_NAME?: string;
  readonly VITE_AWS_LOCATION_PLACE_INDEX?: string;
  readonly VITE_GOOGLE_MAPS_BROWSER_API_KEY?: string;
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
  readonly VITE_MAP_ENABLED?: string;
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_FORCE_MOCK?: string;
  readonly VITE_DEBUG_MODE?: string;
  readonly VITE_DEBUG_SKIP_SWIPE?: string;
  readonly VITE_SPOT_ADMIN_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
