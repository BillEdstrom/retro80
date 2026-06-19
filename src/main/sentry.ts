// Crash & error reporting (main process).
//
// We use @sentry/electron, which captures native crashes plus unhandled errors
// in BOTH the main and renderer processes. Initialize this as early as possible
// in main, and call the renderer-side init in the renderer entry (main.tsx).
//
// The DSN is injected at build time from the SENTRY_DSN env var (see
// electron.vite.config.ts). When it's empty — local/dev builds without the
// env var — Sentry is simply not initialized, so nothing is sent.

import * as Sentry from '@sentry/electron/main'
import { app } from 'electron'

declare const __SENTRY_DSN__: string
declare const __APP_VERSION__: string

export function initSentry(): void {
  const dsn = __SENTRY_DSN__
  if (!dsn) return // no DSN configured → reporting disabled
  Sentry.init({
    dsn,
    // Tie every event to the exact released version — essential, since
    // auto-update means users are spread across versions.
    release: `retro80@${__APP_VERSION__}`,
    environment: app.isPackaged ? 'production' : 'development'
  })
}
