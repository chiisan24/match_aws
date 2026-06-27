/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AWS_REGION?: string;
  readonly VITE_AWS_IDENTITY_POOL_ID?: string;
  readonly VITE_AWS_API_ENDPOINT?: string;
  readonly VITE_AWS_LOCATION_MAP_NAME?: string;
  readonly VITE_AWS_LOCATION_PLACE_INDEX?: string;
  readonly VITE_FORCE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
