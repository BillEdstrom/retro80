// Auto-update wiring for Retro80.
//
// UX model (deliberately "opt-in"): we never silently download or install.
// On launch (and on demand) we *check* the GitHub Releases feed. If a newer
// version exists we tell the renderer, which shows an "Update available" banner.
// Only when the user clicks Download do we fetch it, and only when they click
// "Restart & Install" do we quit and apply it. This is the "accept the new
// version or not" flow the app is going for.
//
// macOS note: applying an update requires the app to be signed + notarized
// (Squirrel.Mac validates the signature). In an unsigned/dev build the check
// still runs but the install step will refuse — that's expected.

// electron-updater is CommonJS; the main process bundles as ESM, so a named
// import of `autoUpdater` fails at runtime ("Named export not found"). Default-
// import the module and destructure instead.
import electronUpdater from 'electron-updater'
import type { BrowserWindow } from 'electron'
import { app, ipcMain } from 'electron'

const { autoUpdater } = electronUpdater

// What we forward to the renderer over the 'updater:event' channel.
// `userInitiated` is true when the user asked (menu / button), so the renderer
// knows to show "Checking…" / "up to date" / errors; background launch checks
// stay silent unless they actually find an update.
export type UpdaterEvent =
  | { status: 'checking'; userInitiated: boolean }
  | { status: 'available'; version: string; notes?: string }
  | { status: 'none'; version: string; userInitiated: boolean }
  | { status: 'error'; message: string; userInitiated: boolean }
  | { status: 'progress'; percent: number }
  | { status: 'downloaded'; version: string }

let wired = false
let sendEvent: ((evt: UpdaterEvent) => void) | null = null
// True while a user-initiated check is in flight, so the resulting events are
// flagged as such.
let pendingUserCheck = false

// Triggered by the "Check for Updates…" menu item.
export function checkForUpdatesFromMenu(): void {
  if (!app.isPackaged) {
    sendEvent?.({
      status: 'error',
      message: 'Updates are only available in the installed app, not in dev.',
      userInitiated: true
    })
    return
  }
  pendingUserCheck = true
  autoUpdater.checkForUpdates().catch((e) => {
    sendEvent?.({ status: 'error', message: String((e as Error)?.message || e), userInitiated: true })
    pendingUserCheck = false
  })
}

export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  // Never auto-download; the user decides. (Install is also user-triggered.)
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const send = (evt: UpdaterEvent): void => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('updater:event', evt)
  }
  sendEvent = send

  autoUpdater.on('checking-for-update', () => send({ status: 'checking', userInitiated: pendingUserCheck }))
  autoUpdater.on('update-available', (info) => {
    pendingUserCheck = false
    send({
      status: 'available',
      version: info.version,
      notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    })
  })
  autoUpdater.on('update-not-available', (info) => {
    send({ status: 'none', version: info.version, userInitiated: pendingUserCheck })
    pendingUserCheck = false
  })
  autoUpdater.on('error', (err) => {
    send({
      status: 'error',
      message: err == null ? 'unknown' : String(err.message || err),
      userInitiated: pendingUserCheck
    })
    pendingUserCheck = false
  })
  autoUpdater.on('download-progress', (p) => send({ status: 'progress', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => send({ status: 'downloaded', version: info.version }))

  if (!wired) {
    wired = true

    // Renderer -> main controls.
    ipcMain.handle('updater:check', async () => {
      if (!app.isPackaged) return { ok: false, reason: 'dev' }
      try {
        await autoUpdater.checkForUpdates()
        return { ok: true }
      } catch (e) {
        return { ok: false, reason: String((e as Error)?.message || e) }
      }
    })

    ipcMain.handle('updater:download', async () => {
      try {
        await autoUpdater.downloadUpdate()
        return { ok: true }
      } catch (e) {
        return { ok: false, reason: String((e as Error)?.message || e) }
      }
    })

    // Quits and relaunches into the freshly downloaded version.
    ipcMain.handle('updater:install', () => {
      autoUpdater.quitAndInstall()
    })

    ipcMain.handle('updater:current-version', () => app.getVersion())
  }

  // Auto-check shortly after launch — only in packaged builds.
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        /* offline / no release yet — silent */
      })
    }, 4000)
  }
}
