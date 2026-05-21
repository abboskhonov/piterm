import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppInfo,
  ElectronAPI,
  WorkspaceInfo,
  SessionListItem,
  AddWorkspaceResult,
} from '../types/electron-api'

const api: ElectronAPI = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('get-app-info'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Workspaces & Sessions
  getWorkspaces: (): Promise<WorkspaceInfo[]> => ipcRenderer.invoke('get-workspaces'),
  getSessions: (workspacePath: string): Promise<SessionListItem[]> =>
    ipcRenderer.invoke('get-sessions', workspacePath),
  addWorkspace: (): Promise<AddWorkspaceResult> => ipcRenderer.invoke('add-workspace'),
  removeWorkspace: (path: string): Promise<void> => ipcRenderer.invoke('remove-workspace', path),
  openSession: (path: string): Promise<void> => ipcRenderer.invoke('open-session', path),
  newSession: (cwd?: string): Promise<void> => ipcRenderer.invoke('new-session', cwd),
  renameSession: (path: string, newTitle: string): Promise<void> =>
    ipcRenderer.invoke('rename-session', path, newTitle),
  deleteSession: (path: string): Promise<void> =>
    ipcRenderer.invoke('delete-session', path),
  pinSession: (path: string, pinned: boolean): Promise<void> =>
    ipcRenderer.invoke('pin-session', path, pinned),

  // Terminal
  ptyInput: (data: string): Promise<void> => ipcRenderer.invoke('pty-input', data),
  ptyResize: (cols: number, rows: number): Promise<void> => ipcRenderer.invoke('pty-resize', cols, rows),
  ptyKill: (): Promise<void> => ipcRenderer.invoke('pty-kill'),

  // Skills
  getInstalledSkills: (): Promise<Array<{ name: string; description: string; path: string; source: string }>> =>
    ipcRenderer.invoke('get-installed-skills'),

  searchSkills: (query: string): Promise<{ skills: Array<{ id: string; skillId: string; name: string; installs: number; source: string }> }> =>
    ipcRenderer.invoke('search-skills', query),

  installSkill: (spec: string, global: boolean, cwd?: string): Promise<{ success: boolean; stdout: string; stderr: string }> =>
    ipcRenderer.invoke('install-skill', spec, global, cwd),

  // Extensions
  searchExtensions: (query: string): Promise<{ packages: Array<{ name: string; description: string; version: string; keywords?: string[] }> }> =>
    ipcRenderer.invoke('search-extensions', query),

  installExtension: (packageName: string): Promise<{ success: boolean; stdout: string; stderr: string }> =>
    ipcRenderer.invoke('install-extension', packageName),

  getInstalledExtensions: (): Promise<Array<{ name: string; version: string; description?: string; installedAt?: string }>> =>
    ipcRenderer.invoke('get-installed-extensions'),

  // Window controls
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  windowMaximize: (): Promise<void> => ipcRenderer.invoke('window-maximize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('window-close'),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback: (isMaximized: boolean) => void): (() => void) => {
    const handler = (_event: unknown, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window-maximized', handler)
    return () => {
      ipcRenderer.removeListener('window-maximized', handler)
    }
  },

  // Events
  onSessionIndexUpdated: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('session-index-updated', handler)
    return () => {
      ipcRenderer.removeListener('session-index-updated', handler)
    }
  },
  onPtyData: (callback: (data: string) => void): (() => void) => {
    const handler = (_event: unknown, data: string) => callback(data)
    ipcRenderer.on('pty-data', handler)
    return () => {
      ipcRenderer.removeListener('pty-data', handler)
    }
  },
  onPtyExit: (callback: (code: number | null, signal: number | null) => void): (() => void) => {
    const handler = (_event: unknown, { exitCode, signal }: { exitCode: number | null; signal: number | null }) => callback(exitCode, signal)
    ipcRenderer.on('pty-exit', handler)
    return () => {
      ipcRenderer.removeListener('pty-exit', handler)
    }
  },
}

contextBridge.exposeInMainWorld('electron', api)
