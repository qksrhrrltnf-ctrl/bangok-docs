/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __RHWP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
  readonly VITE_GOOGLE_APP_ID?: string;
  readonly VITE_ALLOWED_DOMAIN?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_DEV_AUTH_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
