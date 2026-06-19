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
  }
}

contextBridge.exposeInMainWorld('api', api)

export type RetroBasicApi = typeof api
