/// <reference types="vite/client" />

import type { ElectronAPI } from '@slayzone/types'

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL?: string
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
