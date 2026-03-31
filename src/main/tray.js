import { app, BrowserWindow, Menu, Tray } from 'electron'
import { createBus } from '../brain/lib/bus.js'

const REPO = 'vovchisko/brain-thing'
const bus = createBus('update')

let tray = null

export async function checkForUpdate () {
  try {
    const res = await fetch(`https://api.github.com/repos/${ REPO }/releases/latest`)
    if (!res.ok) throw new Error(res.statusText)
    const { tag_name, html_url } = await res.json()
    const latest = tag_name.replace(/^v/, '')
    const current = app.getVersion()
    bus.info(`current: v${ current }, latest: v${ latest }`)
    if (latest !== current) {
      bus.warn(`update available: v${ latest } — ${ html_url }`)
    }
  } catch (err) {
    bus.error(`update check failed: ${ err.message }`)
  }
}

export function createTray (icon, showWindow) {
  tray = new Tray(icon)
  tray.setToolTip('Brain Thing')

  tray.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    } else if (showWindow) {
      showWindow()
    }
  })

  const contextMenu = Menu.buildFromTemplate([
    { label: `Brain Thing v${ app.getVersion() }`, enabled: false },
    { type: 'separator' },
    { label: 'Show Window', click: () => tray.emit('click') },
    { label: 'Check for Updates', click: () => checkForUpdate() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)
  return tray
}
