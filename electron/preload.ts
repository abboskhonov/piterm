import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  ElectronAPI,
} from '../types/electron-api'

// Per-session callback registries for PTY events
const ptyDataCallbacks = new Map<string, Set<(data: string) => void>>()
const ptyExitCallbacks = new Map<string, Set<(exitCode: number | null, signal: number | null) => void>>()

ipcRenderer.on('pty-data', (_event, key: string, data: string) => {
  ptyDataCallbacks.get(key)?.forEach((cb) => cb(data))
})

ipcRenderer.on('pty-exit', (_event, key: string, payload: { exitCode: number | null; signal: number | null }) => {
  ptyExitCallbacks.get(key)?.forEach((cb) => cb(payload.exitCode, payload.signal))
})

const api: ElectronAPI = {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Workspaces & Sessions
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  getSessions: (workspacePath) => ipcRenderer.invoke('get-sessions', workspacePath),
  addWorkspace: () => ipcRenderer.invoke('add-workspace'),
  removeWorkspace: (path) => ipcRenderer.invoke('remove-workspace', path),
  openSession: (path) => ipcRenderer.invoke('open-session', path),
  newSession: (key, cwd, initialPrompt, model) => ipcRenderer.invoke('new-session', key, cwd, initialPrompt, model),
  renameSession: (path, newTitle) => ipcRenderer.invoke('rename-session', path, newTitle),
  deleteSession: (path) => ipcRenderer.invoke('delete-session', path),
  pinSession: (path, pinned) => ipcRenderer.invoke('pin-session', path, pinned),

  // Models
  getModels: () => ipcRenderer.invoke('get-models'),
  getDefaultModel: () => ipcRenderer.invoke('get-default-model'),
  setDefaultModel: (provider, modelId) => ipcRenderer.invoke('set-default-model', provider, modelId),

  // Terminal
  ptyInput: (key, data) => ipcRenderer.invoke('pty-input', key, data),
  ptyResize: (key, cols, rows) => ipcRenderer.invoke('pty-resize', key, cols, rows),
  ptyKill: (key) => ipcRenderer.invoke('pty-kill', key),
  getActivePtySessions: () => ipcRenderer.invoke('get-active-pty-sessions'),

  // Skills
  getInstalledSkills: () => ipcRenderer.invoke('get-installed-skills'),
  searchSkills: (query) => ipcRenderer.invoke('search-skills', query),
  installSkill: (spec, global, cwd) => ipcRenderer.invoke('install-skill', spec, global, cwd),

  // Extensions
  searchExtensions: (query) => ipcRenderer.invoke('search-extensions', query),
  installExtension: (packageName) => ipcRenderer.invoke('install-extension', packageName),
  getInstalledExtensions: () => ipcRenderer.invoke('get-installed-extensions'),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback) => {
    const handler = (_event: unknown, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window-maximized', handler)
    return () => {
      ipcRenderer.removeListener('window-maximized', handler)
    }
  },

  // Events
  onSessionIndexUpdated: (callback) => {
    const handler = (_event: unknown, workspacePath?: string) => callback(workspacePath)
    ipcRenderer.on('session-index-updated', handler)
    return () => {
      ipcRenderer.removeListener('session-index-updated', handler)
    }
  },
  onPtyData: (sessionKey, callback) => {
    if (!ptyDataCallbacks.has(sessionKey)) {
      ptyDataCallbacks.set(sessionKey, new Set())
    }
    ptyDataCallbacks.get(sessionKey)!.add(callback)
    return () => {
      ptyDataCallbacks.get(sessionKey)?.delete(callback)
    }
  },
  onPtyExit: (sessionKey, callback) => {
    if (!ptyExitCallbacks.has(sessionKey)) {
      ptyExitCallbacks.set(sessionKey, new Set())
    }
    ptyExitCallbacks.get(sessionKey)!.add(callback)
    return () => {
      ptyExitCallbacks.get(sessionKey)?.delete(callback)
    }
  },
}

contextBridge.exposeInMainWorld('electron', api)
