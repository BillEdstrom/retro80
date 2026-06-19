import type { RetroBasicApi } from './index'

declare global {
  interface Window {
    api: RetroBasicApi
  }
}

export {}
