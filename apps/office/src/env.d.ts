/// <reference types="vite/client" />

// OpenClaw Office — Vite env type declarations
interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
