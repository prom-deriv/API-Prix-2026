/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DERIV_APP_ID: string
  readonly VITE_DERIV_API_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
