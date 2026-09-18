/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VERCEL_DEPLOYMENT_ID?: string;
  readonly VITE_VERCEL_SKEW_PROTECTION_ENABLED?: string;
}
