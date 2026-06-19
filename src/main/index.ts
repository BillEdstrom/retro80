// Electron main process for Retro80.
// Creates the window and exposes a tiny file-storage API so the renderer can
// save/load BASIC programs as .bas files in the app's user-data folder.

import { app, shell, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Replaced at build time by Vite (see `define` in electron.vite.config.ts).
declare const __APP_VERSION__: string

function programsDir(): string {
  return join(app.getPath('userData'), 'programs')
}

async function ensureProgramsDir(): Promise<string> {
  const dir = programsDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

// Keep file names tame: letters, numbers, dash, underscore, space.
function safeName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'untitled'
  return base.slice(0, 64)
}

// Build the application menu. Help carries the Development Log and About
// items, which tell the renderer to show the corresponding overlay.
function buildMenu(win: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin'
  const show = (which: 'about' | 'devlog'): void => {
    win.webContents.send('show-overlay', which)
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Retro80',
            submenu: [
              { label: 'About Retro80', click: () => show('about') },
              { label: 'Development Log', click: () => show('devlog') },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          } as MenuItemConstructorOptions
        ]
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Development Log', click: () => show('devlog') },
        { label: 'About Retro80', click: () => show('about') }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: `Retro80 v${__APP_VERSION__}`,
    backgroundColor: '#0b0f10',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  Menu.setApplicationMenu(buildMenu(mainWindow))

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.edstrom.retro80')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ---- IPC: program storage ----

  // Programs are stored by language: BASIC as .bas, Python as .py, in one folder.
  const extFor = (kind?: string): string => (kind === 'python' ? '.py' : '.bas')

  ipcMain.handle('programs:list', async (_e, kind?: string) => {
    const dir = await ensureProgramsDir()
    const ext = extFor(kind)
    const files = await fs.readdir(dir)
    const result: { name: string; mtime: number }[] = []
    for (const f of files) {
      if (!f.endsWith(ext)) continue
      const stat = await fs.stat(join(dir, f))
      result.push({ name: f.slice(0, -ext.length), mtime: stat.mtimeMs })
    }
    result.sort((a, b) => b.mtime - a.mtime)
    return result
  })

  ipcMain.handle('programs:load', async (_e, name: string, kind?: string) => {
    const dir = await ensureProgramsDir()
    return fs.readFile(join(dir, safeName(name) + extFor(kind)), 'utf8')
  })

  ipcMain.handle('programs:save', async (_e, name: string, content: string, kind?: string) => {
    const dir = await ensureProgramsDir()
    await fs.writeFile(join(dir, safeName(name) + extFor(kind)), content, 'utf8')
    return safeName(name)
  })

  ipcMain.handle('programs:delete', async (_e, name: string, kind?: string) => {
    const dir = await ensureProgramsDir()
    await fs.rm(join(dir, safeName(name) + extFor(kind)), { force: true })
  })

  ipcMain.handle('programs:export', async (_e, name: string, content: string, kind?: string) => {
    const py = kind === 'python'
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: py ? 'Export Python program' : 'Export BASIC program',
      defaultPath: safeName(name) + extFor(kind),
      filters: py
        ? [{ name: 'Python', extensions: ['py', 'txt'] }]
        : [{ name: 'BASIC', extensions: ['bas', 'txt'] }]
    })
    if (canceled || !filePath) return null
    await fs.writeFile(filePath, content, 'utf8')
    return filePath
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
