/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Django API base, e.g. https://api.example.ir/api/v1 (defaults to /api/v1 for same-origin/proxy) */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}