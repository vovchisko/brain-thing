import { app, BrowserWindow, Menu, shell, Tray } from 'electron'

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
    { label: 'Check for Updates', click: () => shell.openExternal('https://github.com/vovchisko/brain-thing/releases') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)
  return tray
}

