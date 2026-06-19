import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// ---- version / build metadata, injected at build time ----
// Single source of truth: package.json version + build-number.json.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
const buildInfo = JSON.parse(readFileSync(resolve(__dirname, 'build-number.json'), 'utf8'))
const buildDate = new Date().toISOString().slice(0, 10)

const versionDefines = {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __APP_BUILD__: JSON.stringify(buildInfo.build),
  __APP_BUILD_DATE__: JSON.stringify(buildDate),
  // Sentry crash-reporting DSN (not secret — designed to ship in the client).
  // Supplied via the SENTRY_DSN env var (the release script sources .env). When
  // empty, Sentry stays disabled, so local/dev builds report nothing.
  __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN || ''),
  // In-app feedback endpoint (the Cloudflare Worker). Supplied via FEEDBACK_URL
  // in .env. When empty, the feedback form reports it's not configured yet.
  __FEEDBACK_URL__: JSON.stringify(process.env.FEEDBACK_URL || '')
}

export default defineConfig({
  main: {
    define: versionDefines,
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    define: versionDefines,
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@basic': resolve('src/renderer/src/basic')
      }
    },
    plugins: [react()]
  }
})
