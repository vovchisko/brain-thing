import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI }                from '@electron-toolkit/preload'
import { IPC }                        from '../shared/ipc'

const api = {
  config: {
    get: () => ipcRenderer.invoke(IPC.CONFIG_GET),
    set: (patch) => ipcRenderer.invoke(IPC.CONFIG_SET, patch),
    reset: () => ipcRenderer.invoke(IPC.CONFIG_RESET),
    path: () => ipcRenderer.invoke(IPC.CONFIG_PATH),
  },
  brainSwap: () => ipcRenderer.invoke(IPC.BRAIN_SWAP),
  logs: {
    buffer: () => ipcRenderer.invoke(IPC.LOG_BUFFER),
    onPush: (cb) => ipcRenderer.on(IPC.LOG_PUSH, (_e, entry) => cb(entry)),
  },
  stats: {
    get: () => ipcRenderer.invoke(IPC.STAT_GET),
    onStatus:  (cb) => ipcRenderer.on(IPC.STAT_STATUS, (_e, d) => cb(d)),
    onEntries: (cb) => ipcRenderer.on(IPC.STAT_ENTRIES, (_e, d) => cb(d)),
    onIssues:  (cb) => ipcRenderer.on(IPC.STAT_ISSUES, (_e, d) => cb(d)),
    onFields:  (cb) => ipcRenderer.on(IPC.STAT_FIELDS, (_e, d) => cb(d)),
    onScopes:  (cb) => ipcRenderer.on(IPC.STAT_SCOPES, (_e, d) => cb(d)),
  },
  pickFolder: () => ipcRenderer.invoke(IPC.PICK_FOLDER),
  isDirectory: (p) => ipcRenderer.invoke(IPC.FS_IS_DIR, p),
  isEmpty: (p) => ipcRenderer.invoke(IPC.FS_IS_EMPTY, p),
  moveVault: (from, to) => ipcRenderer.invoke(IPC.FS_MOVE_VAULT, from, to),
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
