export interface AppInfo {
  version: string
  name: string
  platform: string
}

export interface WorkspaceInfo {
  path: string
  displayName: string
  lastOpenedAt: string | null
  sessionCount: number
}

export interface SessionListItem {
  path: string
  id: string
  workspacePath: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  active: boolean
  pinned: boolean
}

export interface SkillInfo {
  name: string
  description: string
  path: string
  source: string
}

export interface AddWorkspaceResult {
  cancelled: boolean
  path?: string
}

export interface ElectronAPI {
  getAppInfo: () => Promise<AppInfo>
  openExternal: (url: string): Promise<void>
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }

  // Workspaces & Sessions
  getWorkspaces: () => Promise<WorkspaceInfo[]>
  getSessions: (workspacePath: string) => Promise<SessionListItem[]>
  addWorkspace: () => Promise<AddWorkspaceResult>
  removeWorkspace: (path: string) => Promise<void>
  openSession: (path: string) => Promise<void>
  newSession: (cwd?: string) => Promise<void>
  renameSession: (sessionPath: string, newTitle: string) => Promise<void>
  deleteSession: (sessionPath: string) => Promise<void>
  pinSession: (sessionPath: string, pinned: boolean) => Promise<void>

  // Terminal
  ptyInput: (data: string) => Promise<void>
  ptyResize: (cols: number, rows: number) => Promise<void>
  ptyKill: () => Promise<void>

  // Skills
  getInstalledSkills: () => Promise<SkillInfo[]>
  searchSkills: (query: string) => Promise<{ skills: Array<{ id: string; skillId: string; name: string; installs: number; source: string }> }>
  installSkill: (spec: string, global: boolean, cwd?: string) => Promise<{ success: boolean; stdout: string; stderr: string }>

  // Extensions
  searchExtensions: (query: string) => Promise<{ packages: Array<{ name: string; description: string; version: string; keywords?: string[] }> }>
  installExtension: (packageName: string) => Promise<{ success: boolean; stdout: string; stderr: string }>
  getInstalledExtensions: () => Promise<Array<{ name: string; version: string; description?: string; installedAt?: string }>>

  // Window controls
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => () => void

  // Events
  onSessionIndexUpdated: (callback: () => void) => () => void
  onPtyData: (callback: (data: string) => void) => () => void
  onPtyExit: (callback: (code: number | null, signal: number | null) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
