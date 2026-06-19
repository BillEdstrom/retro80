// Preload bridge — exposes a minimal, safe API to the renderer.
import { contextBridge, ipcRenderer } from 'electron'

// `kind` selects the language store: 'basic' (.bas, default) or 'python' (.py).
const api = {
  listPrograms: (kind?: string): Promise<{ name: string; mtime: number }[]> =>
    ipcRenderer.invoke('programs:list', kind),
  loadProgram: (name: string, kind?: string): Promise<string> =>
    ipcRenderer.invoke('programs:load', name, kind),
  saveProgram: (name: string, content: string, kind?: string): Promise<string> =>
    ipcRenderer.invoke('programs:save', name, content, kind),
  deleteProgram: (name: string, kind?: string): Promise<void> =>
    ipcRenderer.invoke('programs:delete', name, kind),
  exportProgram: (name: string, content: string, kind?: string): Promise<string | null> =>
    ipcRenderer.invoke('programs:export', name, content, kind),
  // Menu -> renderer: show the About / Development Log overlay. Returns an
  // unsubscribe function.
  onShowOverlay: (cb: (which: string) => void): (() => void) => {
    const listener = (_e: unknown, which: string): void => cb(which)
    ipcRenderer.on('show-overlay', listener)
    return () => ipcRenderer.removeListener('show-overlay', listener)
  },
  // ---- in-app feedback ----
  submitFeedback: (payload: {
    type: string
    message: string
    email?: string
    consent?: boolean
  }): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke('feedback:submit', payload),
  // ---- auto-update ----
  updater: {
    check: (): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke('updater:check'),
    download: (): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke('updater:download'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    currentVersion: (): Promise<string> => ipcRenderer.invoke('updater:current-version'),
    // Subscribe to updater status events. Returns an unsubscribe function.
    onEvent: (cb: (evt: unknown) => void): (() => void) => {
      const listener = (_e: unknown, evt: unknown): void => cb(evt)
      ipcRenderer.on('updater:event', listener)
      return () => ipcRenderer.removeListener('updater:event', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type RetroBasicApi = typeof api
