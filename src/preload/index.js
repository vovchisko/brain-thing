import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI }                from '@electron-toolkit/preload'
import { IPC }                        from '../shared/ipc'

const api = {
  config: {
    system: {
      get: () => ipcRenderer.invoke(IPC.CONFIG_SYSTEM_GET),
      set: (patch) => ipcRenderer.invoke(IPC.CONFIG_SYSTEM_SET, patch),
      reset: () => ipcRenderer.invoke(IPC.CONFIG_SYSTEM_RESET),
      onChanged: (cb) => ipcRenderer.on(IPC.CONFIG_SYSTEM_CHANGED, () => cb()),
    },
    vault: {
      get: () => ipcRenderer.invoke(IPC.CONFIG_VAULT_GET),
      set: (patch) => ipcRenderer.invoke(IPC.CONFIG_VAULT_SET, patch),
      reset: () => ipcRenderer.invoke(IPC.CONFIG_VAULT_RESET),
      onChanged: (cb) => ipcRenderer.on(IPC.CONFIG_VAULT_CHANGED, () => cb()),
    },
    paths: () => ipcRenderer.invoke(IPC.CONFIG_PATHS),
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
    onProjects: (cb) => ipcRenderer.on(IPC.STAT_PROJECTS, (_e, d) => cb(d)),
  },
  mcp: {
    status: () => ipcRenderer.invoke(IPC.MCP_STATUS),
    register: () => ipcRenderer.invoke(IPC.MCP_REGISTER),
    unregister: () => ipcRenderer.invoke(IPC.MCP_UNREGISTER),
  },
  autostart: {
    get: () => ipcRenderer.invoke(IPC.AUTOSTART_GET),
    set: (v) => ipcRenderer.invoke(IPC.AUTOSTART_SET, v),
  },
  pickFolder: () => ipcRenderer.invoke(IPC.PICK_FOLDER),
  isDirectory: (p) => ipcRenderer.invoke(IPC.FS_IS_DIR, p),
  isEmpty: (p) => ipcRenderer.invoke(IPC.FS_IS_EMPTY, p),
  moveVault: (from, to) => ipcRenderer.invoke(IPC.FS_MOVE_VAULT, from, to),
}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
