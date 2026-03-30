import { app, BrowserWindow, dialog, ipcMain, shell }         from 'electron'
import { join }                                              from 'path'
import { cpSync, readdirSync, renameSync, rmSync, statSync } from 'fs'
import { electronApp, is, optimizer }                        from '@electron-toolkit/utils'
import { init, config, getConfig, setConfig, resetConfig, getConfigPath } from '../brain/config.js'
import { start, hotSwap, server }                            from '../brain/server.js'
import { onBrainEvent }                                      from '../brain/lib/bus.js'
import { createTray }                                        from './tray'
import { IPC }                                               from '../shared/ipc'
import { LOG_BUFFER_SIZE }                                   from '../shared/constants'
import icon                                                  from '../../resources/icon.png?asset'

if (process.platform === 'win32') process.env.LANG = 'en_US.UTF-8'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

// --- Log bridge ---
const logMap = new Map()
const logOrder = []

onBrainEvent((event) => {
  if (logMap.has(event.id)) {
    const existing = logMap.get(event.id)
    Object.assign(existing, event)
  } else {
    const entry = { ...event }
    logMap.set(event.id, entry)
    logOrder.push(entry)
    if (logOrder.length > LOG_BUFFER_SIZE) {
      const removed = logOrder.shift()
      logMap.delete(removed.id)
    }
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.LOG_PUSH, event)
  }
})

// --- Stats bridge ---
const statsCache = {
  status: { phase: 'idle' },
  entries: 0,
  issues: { summary: 0, links: 0 },
  fields: {},
  scopes: { scopes: [], unscoped: 0 },
}

function pushStat (channel, key, value) {
  statsCache[key] = value
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, value)
  }
}

server.onStatus    = (s) => pushStat(IPC.STAT_STATUS, 'status', s)
server.onEntries   = (n) => pushStat(IPC.STAT_ENTRIES, 'entries', n)
server.onIssues    = (d) => pushStat(IPC.STAT_ISSUES, 'issues', d)
server.onFields    = (d) => pushStat(IPC.STAT_FIELDS, 'fields', d)
server.onScopes    = (d) => pushStat(IPC.STAT_SCOPES, 'scopes', d)
server.onLiveCount = (n) => pushStat(IPC.STAT_ENTRIES, 'entries', n)

// --- Window ---
let mainWindow

function createWindow () {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }

  const wb = getConfig().windowBounds || {}

  mainWindow = new BrowserWindow({
    width: wb.width || 900,
    height: wb.height || 670,
    x: wb.x,
    y: wb.y,
    minWidth: 400,
    minHeight: 400,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  })

  const saveBounds = () => setConfig({ windowBounds: mainWindow.getBounds() })
  mainWindow.on('resized', saveBounds)
  mainWindow.on('moved', saveBounds)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) mainWindow.webContents.openDevTools({ mode: 'right' })
  })

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

// --- Init ---
const dataDir = app.getPath('userData')
init(dataDir)

// Set paths that need Electron APIs
config.resourcesPath = app.isPackaged ? process.resourcesPath : null
config.brainDir = join(app.getAppPath(), 'src', 'brain')

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.vovchisko.brain-thing')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Config IPC — delegates to brain/config.js
  ipcMain.handle(IPC.CONFIG_GET, () => getConfig())
  ipcMain.handle(IPC.CONFIG_SET, (_e, patch) => setConfig(patch))
  ipcMain.handle(IPC.CONFIG_RESET, () => resetConfig())
  ipcMain.handle(IPC.CONFIG_PATH, () => getConfigPath())

  // FS helpers
  ipcMain.handle(IPC.FS_IS_DIR, (_e, p) => {
    try { return statSync(p).isDirectory() } catch { return false }
  })
  ipcMain.handle(IPC.FS_IS_EMPTY, (_e, p) => {
    try { return readdirSync(p).length === 0 } catch { return true }
  })
  ipcMain.handle(IPC.FS_MOVE_VAULT, (_e, from, to) => {
    const entries = readdirSync(from)
    for (const name of entries) {
      const src = join(from, name)
      const dst = join(to, name)
      try { renameSync(src, dst) }
      catch { cpSync(src, dst, { recursive: true }); rmSync(src, { recursive: true, force: true }) }
    }
    return { moved: entries.length }
  })

  // Brain
  ipcMain.handle(IPC.BRAIN_SWAP, () => hotSwap())
  ipcMain.handle(IPC.LOG_BUFFER, () => [...logOrder])
  ipcMain.handle(IPC.STAT_GET, () => ({ ...statsCache }))

  ipcMain.handle(IPC.PICK_FOLDER, async () => {
    const win = mainWindow || BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  createTray(icon, createWindow)
  createWindow()

  start().catch((err) => {
    console.error('[brain] Failed to start:', err.message)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (is.dev) app.quit()
})
