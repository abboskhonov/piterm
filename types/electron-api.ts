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

export interface ModelInfo {
  provider: string
  id: string
  name: string
  contextWindow: string
}

export interface PiSettings {
  defaultProvider: string
  defaultModel: string
  defaultThinkingLevel: string
}

export interface AddWorkspaceResult {
  cancelled: boolean
  path?: string
}

export interface ElectronAPI {
  getAppInfo(): Promise<AppInfo>
  openExternal(url: string): Promise<void>
  openPath(filePath: string): Promise<void>
  getPathForFile(file: File): string
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }

  // Workspaces & Sessions
  getWorkspaces(): Promise<WorkspaceInfo[]>
  getSessions(workspacePath: string): Promise<SessionListItem[]>
  addWorkspace(): Promise<AddWorkspaceResult>
  removeWorkspace(path: string): Promise<void>
  openSession(path: string): Promise<void>
  newSession(key: string, cwd?: string, initialPrompt?: string, model?: string): Promise<void>
  renameSession(sessionPath: string, newTitle: string): Promise<void>
  deleteSession(sessionPath: string): Promise<void>
  pinSession(sessionPath: string, pinned: boolean): Promise<void>

  // Models
  getModels(): Promise<ModelInfo[]>
  getDefaultModel(): Promise<PiSettings | null>
  setDefaultModel(provider: string, modelId: string): Promise<void>

  // Terminal
  ptyInput(key: string, data: string): Promise<void>
  ptyResize(key: string, cols: number, rows: number): Promise<void>
  ptyKill(key?: string): Promise<void>
  getActivePtySessions(): Promise<string[]>

  // Skills
  getInstalledSkills(): Promise<SkillInfo[]>
  searchSkills(query: string): Promise<{ skills: Array<{ id: string; skillId: string; name: string; installs: number; source: string }> }>
  installSkill(spec: string, global: boolean, cwd?: string): Promise<{ success: boolean; stdout: string; stderr: string }>

  // Extensions
  searchExtensions(query: string): Promise<{ packages: Array<{ name: string; description: string; version: string; keywords?: string[]; author?: string; date?: string; links?: { npm?: string; repository?: string; homepage?: string; bugs?: string } }> }>
  installExtension(packageName: string): Promise<{ success: boolean; stdout: string; stderr: string }>
  getInstalledExtensions(): Promise<Array<{ name: string; version: string; description?: string; installedAt?: string }>>

  // Window controls
  windowMinimize(): Promise<void>
  windowMaximize(): Promise<void>
  windowClose(): Promise<void>
  windowIsMaximized(): Promise<boolean>
  onWindowMaximized(callback: (isMaximized: boolean) => void): () => void

  // Events
  // Git
  getGitDiff(cwd: string): Promise<{ added: number; deleted: number; branch?: string } | null>

  onSessionIndexUpdated(callback: (workspacePath?: string) => void): () => void
  onPtyData(sessionKey: string, callback: (data: string) => void): () => void
  onPtyExit(sessionKey: string, callback: (code: number | null, signal: number | null) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
