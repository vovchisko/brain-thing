import { app, BrowserWindow, Menu, Tray } from 'electron'

let tray = null

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

function checkForUpdate () {
  // TODO: fetch GitHub releases API, compare semver
  console.log('[tray] Check for update — stub')
}
