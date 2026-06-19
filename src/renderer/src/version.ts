// Version & build metadata for the renderer.
//
// The __APP_*__ identifiers are replaced with literals at build time by Vite
// (see `define` in electron.vite.config.ts). They are declared here so
// TypeScript is happy; at runtime they become plain constants.

declare const __APP_VERSION__: string
declare const __APP_BUILD__: number
declare const __APP_BUILD_DATE__: string

export const VERSION = __APP_VERSION__
export const BUILD = __APP_BUILD__
export const BUILD_DATE = __APP_BUILD_DATE__

// "v0.2.0 · build 12" — shown next to the Retro80 title.
export const VERSION_LABEL = `v${VERSION} · build ${BUILD}`

// "v0.2.0 · build 12 · 2026-06-09" — fuller form for the banner / about text.
export const VERSION_LABEL_FULL = `${VERSION_LABEL} · ${BUILD_DATE}`
