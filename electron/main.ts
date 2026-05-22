import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { readdir, stat, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { spawn, execSync, exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { spawn as spawnPty } from 'node-pty'
import { readWindowState, writeWindowState } from './window-state'
import { SessionIndexStore } from './sessionIndex'

const execAsync = promisify(execCallback)

// ─── Resolve pi binary ─────────────────────────────────────────────────────
function resolvePiBinary(): string {
  // 1. Try via shell (sources .bashrc / .zshrc)
  try {
    const shell = process.env.SHELL || '/bin/bash'
    const which = execSync(`${shell} -ilc "which pi"`, { encoding: 'utf-8', timeout: 3000 }).trim()
    if (which && existsSync(which)) return which
  } catch { /* ignore */ }

  // 2. Try common npm global bin locations
  const candidates = [
    path.join(homedir(), '.npm-global', 'bin', 'pi'),
    path.join(homedir(), '.local', 'bin', 'pi'),
    path.join(homedir(), '.nvm', 'versions', 'node', process.versions.node, 'bin', 'pi'),
    '/usr/local/bin/pi',
    '/usr/bin/pi',
    '/opt/homebrew/bin/pi',
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }

  // 3. Fallback — hope PATH is correct at runtime
  return 'pi'
}

const PI_BINARY = resolvePiBinary()

const currentDir = path.dirname(fileURLToPath(import.meta.url))

// ── Linux GPU fixes ─────────────────────────────────────────────────────────
if (process.platform === 'linux' && process.env.PI_DISABLE_GPU) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu-sandbox')
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

// ─── State ─────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let sessionIndex: SessionIndexStore | null = null

// ─── Terminal Manager ────────────────────────────────────────────────────────

class TerminalManager {
  private ptys = new Map<string, ReturnType<typeof spawnPty>>()
  private cwdMap = new Map<string, string>()

  spawn(key: string, cwd: string, sessionFile?: string, initialPrompt?: string, model?: string): void {
    if (this.ptys.has(key)) return // Already running

    const shell = process.platform === 'win32' ? 'pi.exe' : PI_BINARY
    const args = sessionFile ? ['--session', sessionFile] : []
    if (model) {
      args.push('--model', model)
    }
    if (initialPrompt) {
      args.push(initialPrompt)
    }

    const pty = spawnPty(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: process.env,
    })

    this.ptys.set(key, pty)
    this.cwdMap.set(key, cwd)

    pty.onData((data) => {
      mainWindow?.webContents.send('pty-data', key, data)
    })

    pty.onExit(({ exitCode, signal }) => {
      mainWindow?.webContents.send('pty-exit', key, { exitCode, signal })
      const ptyCwd = this.cwdMap.get(key)
      if (ptyCwd) {
        sessionIndex?.refreshSessions(ptyCwd).catch(console.error)
        mainWindow?.webContents.send('session-index-updated', ptyCwd)
      }
      this.ptys.delete(key)
      this.cwdMap.delete(key)
    })
  }

  write(key: string, data: string): void {
    this.ptys.get(key)?.write(data)
  }

  resize(key: string, cols: number, rows: number): void {
    this.ptys.get(key)?.resize(cols, rows)
  }

  dispose(key?: string): void {
    if (key) {
      const pty = this.ptys.get(key)
      if (pty) {
        pty.kill()
        this.ptys.delete(key)
        this.cwdMap.delete(key)
      }
    } else {
      for (const pty of this.ptys.values()) {
        pty.kill()
      }
      this.ptys.clear()
      this.cwdMap.clear()
    }
  }

  getActiveKeys(): string[] {
    return Array.from(this.ptys.keys())
  }
}

const terminalManager = new TerminalManager()

// ─── Window ────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const saved = readWindowState()

  const win = new BrowserWindow({
    x: saved.x,
    y: saved.y,
    width: saved.width ?? 1200,
    height: saved.height ?? 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: process.platform === 'darwin',
    icon: path.join(currentDir, '../../build/favicon.svg'),
    webPreferences: {
      preload: path.join(currentDir, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,
  })

  if (saved.isMaximized) win.maximize()
  if (saved.isFullScreen) win.setFullScreen(true)

  win.once('ready-to-show', () => {
    win.show()
    if (process.env.NODE_ENV === 'development') {
      win.webContents.openDevTools()
    }
  })

  win.on('maximize', () => {
    win.webContents.send('window-maximized', true)
  })

  win.on('unmaximize', () => {
    win.webContents.send('window-maximized', false)
  })

  win.on('close', () => {
    const bounds = win.getBounds()
    writeWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
    })
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

async function loadURL(win: BrowserWindow): Promise<void> {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await win.loadFile(path.join(currentDir, '../renderer/index.html'))
  }
}

// ─── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
  }
  mainWindow = createWindow()
  void loadURL(mainWindow)

  registerIpcHandlers()

  // Initialize session index
  try {
    const dbPath = path.join(app.getPath('userData'), 'pi-desktop.sqlite')
    sessionIndex = new SessionIndexStore(dbPath)
    sessionIndex.refreshSessions().catch((err) => {
      console.error('Initial session refresh failed:', err)
    })
  } catch (err) {
    console.error('Session index init failed (better-sqlite3 may need rebuild):', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      void loadURL(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  terminalManager.dispose()
  sessionIndex?.close()
})

// ─── IPC handlers ──────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // ── App info ──────────────────────────────────────────────────────────
  ipcMain.handle('get-app-info', async () => ({
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
  }))

  ipcMain.handle('open-external', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('open-path', async (_event, filePath: string) => {
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
  })

  // ── Window controls ────────────────────────────────────────────────────
  ipcMain.handle('window-minimize', async () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window-maximize', async () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window-close', async () => {
    mainWindow?.close()
  })

  ipcMain.handle('window-is-maximized', async () => {
    return mainWindow?.isMaximized() ?? false
  })

  // ── Workspaces ─────────────────────────────────────────────────────────
  ipcMain.handle('get-workspaces', async () => {
    return sessionIndex?.listWorkspaces() ?? []
  })

  ipcMain.handle('get-sessions', async (_event, workspacePath: string) => {
    return sessionIndex?.listSessions(workspacePath) ?? []
  })

  ipcMain.handle('add-workspace', async () => {
    if (!mainWindow) return { cancelled: true }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Add Workspace',
      properties: ['openDirectory'],
      buttonLabel: 'Add Workspace',
    })
    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true }
    }
    const workspacePath = result.filePaths[0]
    try {
      sessionIndex?.upsertWorkspace(workspacePath)
      sessionIndex?.refreshSessions(workspacePath).catch(console.error)
      mainWindow?.webContents.send('session-index-updated', workspacePath)
    } catch (err) {
      console.error('Failed to add workspace:', err)
      return { cancelled: true }
    }
    return { cancelled: false, path: workspacePath }
  })

  ipcMain.handle('remove-workspace', async (_event, workspacePath: string) => {
    sessionIndex?.removeWorkspace(workspacePath)
    mainWindow?.webContents.send('session-index-updated', workspacePath)
  })

  // ── Session management ─────────────────────────────────────────────────
  ipcMain.handle('open-session', async (_event, sessionPath: string) => {
    const workspacePath = sessionIndex?.getSessionWorkspace(sessionPath)
    if (!workspacePath) {
      console.error('No workspace found for session:', sessionPath)
      return
    }
    terminalManager.spawn(sessionPath, workspacePath, sessionPath)
  })

  ipcMain.handle('new-session', async (_event, key: string, cwd?: string, initialPrompt?: string, model?: string) => {
    const workspacePath = cwd ?? sessionIndex?.getLastWorkspace()
    if (!workspacePath) return
    terminalManager.spawn(key, workspacePath, undefined, initialPrompt, model)
    // pi writes the session file shortly after spawn — refresh sidebar a few times
    const refresh = () => {
      sessionIndex?.refreshSessions(workspacePath).catch(console.error)
      mainWindow?.webContents.send('session-index-updated', workspacePath)
    }
    setTimeout(refresh, 400)
    setTimeout(refresh, 1500)
  })

  ipcMain.handle('rename-session', async (_event, sessionPath: string, newTitle: string) => {
    sessionIndex?.renameSession(sessionPath, newTitle)
    const ws = sessionIndex?.getSessionWorkspace(sessionPath)
    mainWindow?.webContents.send('session-index-updated', ws)
  })

  ipcMain.handle('delete-session', async (_event, sessionPath: string) => {
    const ws = sessionIndex?.getSessionWorkspace(sessionPath)
    sessionIndex?.deleteSession(sessionPath)
    mainWindow?.webContents.send('session-index-updated', ws)
  })

  ipcMain.handle('pin-session', async (_event, sessionPath: string, pinned: boolean) => {
    sessionIndex?.pinSession(sessionPath, pinned)
    const ws = sessionIndex?.getSessionWorkspace(sessionPath)
    mainWindow?.webContents.send('session-index-updated', ws)
  })

  // ── Terminal ───────────────────────────────────────────────────────────
  ipcMain.handle('pty-input', async (_event, key: string, data: string) => {
    terminalManager.write(key, data)
  })

  ipcMain.handle('pty-resize', async (_event, key: string, cols: number, rows: number) => {
    terminalManager.resize(key, cols, rows)
  })

  ipcMain.handle('pty-kill', async (_event, key?: string) => {
    terminalManager.dispose(key)
  })

  ipcMain.handle('get-active-pty-sessions', async () => {
    return terminalManager.getActiveKeys()
  })

  // ── Skills ───────────────────────────────────────────────────────────
  ipcMain.handle('get-installed-skills', async () => {
    const home = homedir()
    const [agentsSkills, piSkills] = await Promise.all([
      scanSkillsDir(path.join(home, '.agents', 'skills')),
      scanSkillsDir(path.join(home, '.pi', 'agent', 'skills')),
    ])
    return [...agentsSkills, ...piSkills]
  })

  ipcMain.handle('search-skills', async (_event, query: string) => {
    const q = encodeURIComponent(query)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(`https://skills.sh/api/search?q=${q}&limit=24`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`skills.sh returned ${res.status}`)
    return await res.json()
  })

  ipcMain.handle('install-skill', async (_event, spec: string, global: boolean, cwd?: string) => {
    const args = ['skills', 'add', spec, '-y']
    if (global) args.push('-g')
    return new Promise<{ success: boolean; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn('npx', args, { cwd, env: process.env, shell: true })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => { stdout += String(d) })
      proc.stderr.on('data', (d) => { stderr += String(d) })
      proc.on('error', (err) => {
        resolve({ success: false, stdout, stderr: err.message })
      })
      proc.on('close', (code) => {
        resolve({ success: code === 0, stdout, stderr })
      })
    })
  })

  // ── Extensions ─────────────────────────────────────────────────────────
  ipcMain.handle('search-extensions', async (_event, query: string) => {
    const raw = query?.trim().toLowerCase()
    // Search with pi-extension as an anchor term, then post-filter because
    // npm's text search does OR-style matching, so generic packages that
    // happen to contain "extension" (e.g. @tiptap/extension-paragraph) leak in.
    const searchText = raw ? `${raw} pi-extension` : 'pi-extension'
    const q = encodeURIComponent(searchText)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${q}&size=250`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`npm registry returned ${res.status}`)
    const data = await res.json()
    const rawObjects = Array.isArray(data.objects) ? data.objects : []
    const packages: Array<{ name: string; description: string; version: string; keywords?: string[]; author?: string; date?: string; links?: { npm?: string; repository?: string; homepage?: string; bugs?: string } }> = []
    for (const obj of rawObjects) {
      const pkg = (obj as {
        package?: {
          name?: string
          description?: string
          version?: string
          keywords?: string[]
          publisher?: { username?: string; email?: string }
          date?: string
          links?: { npm?: string; repository?: string; homepage?: string; bugs?: string }
        }
      }).package
      if (!pkg) continue
      const name = pkg.name ?? ''
      const keywords = pkg.keywords ?? []
      const description = pkg.description ?? ''
      if (isPiRelated({ name, keywords, description }, raw)) {
        packages.push({
          name,
          description,
          version: pkg.version ?? '',
          keywords,
          author: pkg.publisher?.username,
          date: pkg.date,
          links: pkg.links,
        })
      }
    }
    return { packages }
  })

  ipcMain.handle('get-installed-extensions', async () => {
    return await scanPiExtensions()
  })

  ipcMain.handle('install-extension', async (_event, packageName: string) => {
    const result = await new Promise<{ success: boolean; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn('pi', ['install', `npm:${packageName}`], { env: process.env, shell: true })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => { stdout += String(d) })
      proc.stderr.on('data', (d) => { stderr += String(d) })
      proc.on('error', (err) => {
        resolve({ success: false, stdout, stderr: err.message })
      })
      proc.on('close', (code) => {
        resolve({ success: code === 0, stdout, stderr })
      })
    })

    if (result.success) {
      mainWindow?.webContents.send('session-index-updated')
    }

    return result
  })

  // ── Models ─────────────────────────────────────────────────────────────
  ipcMain.handle('get-models', async () => {
    return getPiModels()
  })

  ipcMain.handle('get-default-model', async () => {
    return readPiSettings()
  })

  ipcMain.handle('set-default-model', async (_event, provider: string, modelId: string) => {
    const settingsPath = path.join(homedir(), '.pi', 'agent', 'settings.json')
    try {
      const raw = readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(raw) as Record<string, unknown>
      settings.defaultProvider = provider
      settings.defaultModel = modelId
      const fs = await import('node:fs/promises')
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n')
    } catch {
      // ignore write errors
    }
  })
}

// ─── Pi settings helpers ───────────────────────────────────────────────────

function readPiSettings(): { defaultProvider: string; defaultModel: string; defaultThinkingLevel: string } | null {
  const settingsPath = path.join(homedir(), '.pi', 'agent', 'settings.json')
  try {
    const raw = readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      defaultProvider: typeof parsed.defaultProvider === 'string' ? parsed.defaultProvider : '',
      defaultModel: typeof parsed.defaultModel === 'string' ? parsed.defaultModel : '',
      defaultThinkingLevel: typeof parsed.defaultThinkingLevel === 'string' ? parsed.defaultThinkingLevel : 'medium',
    }
  } catch {
    return null
  }
}

let cachedModels: Array<{ provider: string; id: string; name: string; contextWindow: string }> | null = null
let cachedModelsAt = 0
const MODEL_CACHE_TTL_MS = 30_000

async function getPiModels(): Promise<Array<{ provider: string; id: string; name: string; contextWindow: string }>> {
  if (cachedModels && Date.now() - cachedModelsAt < MODEL_CACHE_TTL_MS) {
    return cachedModels
  }
  try {
    const { stdout } = await execAsync(`${PI_BINARY} --list-models`, { encoding: 'utf-8', timeout: 8000, env: process.env })
    const lines = stdout.trim().split('\n')
    const models: Array<{ provider: string; id: string; name: string; contextWindow: string }> = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(/\s+/)
      if (parts.length >= 2) {
        models.push({
          provider: parts[0],
          id: parts[1],
          name: parts[1].split('/').pop() ?? parts[1],
          contextWindow: parts[2] ?? '',
        })
      }
    }
    cachedModels = models
    cachedModelsAt = Date.now()
    return models
  } catch {
    // If pi --list-models fails, fall back to reading settings.json default
    const settings = readPiSettings()
    if (settings?.defaultModel && settings.defaultProvider) {
      cachedModels = [{
        provider: settings.defaultProvider,
        id: settings.defaultModel,
        name: settings.defaultModel.split('/').pop() ?? settings.defaultModel,
        contextWindow: '',
      }]
      cachedModelsAt = Date.now()
      return cachedModels
    }
    return []
  }
}

// ─── Extension helpers ─────────────────────────────────────────────────────

const NON_PI_SCOPES = new Set([
  '@tiptap', '@types', '@tanstack', '@testing-library', '@storybook',
  '@babel', '@rollup', '@webpack', '@vitejs', '@vue', '@angular',
  '@react-native', '@emotion', '@mui', '@mantine', '@radix-ui',
  '@ark-ui', '@chakra-ui', '@nextui', '@ant-design', '@aws-sdk',
  '@azure', '@google-cloud', '@firebase', '@prisma', '@trpc',
  '@apollo', '@urql', '@graphql-tools', '@octokit', '@actions',
  '@semantic-release', '@commitlint', '@eslint', '@typescript-eslint',
])

function isPiRelated(pkg: { name: string; keywords?: string[]; description?: string }, userQuery?: string): boolean {
  const name = pkg.name.toLowerCase()
  const keywords = (pkg.keywords ?? []).map((k) => k.toLowerCase())
  const desc = (pkg.description ?? '').toLowerCase()
  const query = userQuery?.trim() ?? ''

  // Hard-block known non-pi scopes
  if (name.startsWith('@')) {
    const scope = name.split('/')[0]
    if (NON_PI_SCOPES.has(scope)) return false
  }

  // 1. Keyword signals (strongest)
  if (keywords.includes('pi-extension')) return true
  if (keywords.includes('pi-skill')) return true
  if (keywords.includes('pi')) return true

  // 2. Name signals: "pi" as a standalone prefix/segment
  if (name.startsWith('pi-')) return true
  if (name.includes('-pi-')) return true
  if (name.endsWith('-pi')) return true
  if (name.startsWith('@') && name.includes('/pi-')) return true
  // Scoped packages where the scope itself is pi-related
  if (name.startsWith('@pi/')) return true
  if (name.startsWith('@pi-')) return true

  // 3. Description signals
  if (desc.includes('pi extension')) return true
  if (desc.includes('pi skill')) return true
  if (desc.includes('for pi')) return true

  // 4. Exact / strong name match with user query
  if (query.length > 2) {
    const cleanName = name.replace(/^@[^/]+\//, '') // strip scope
    if (cleanName === query) return true
    if (cleanName.startsWith(query + '-')) return true
    if (cleanName.includes('-' + query + '-')) return true
    if (cleanName.endsWith('-' + query)) return true
  }

  return false
}

// ─── Extension scanning helpers ────────────────────────────────────────────

interface PiExtension {
  name: string
  version: string
  description?: string
  installedAt?: string
}

async function scanPiExtensions(): Promise<PiExtension[]> {
  const extensions: PiExtension[] = []
  const home = homedir()

  // Scan ~/.pi/extensions/ if it exists
  const piExtDir = path.join(home, '.pi', 'extensions')
  try {
    const entries = await readdir(piExtDir)
    for (const entry of entries) {
      const entryPath = path.join(piExtDir, entry)
      const s = await stat(entryPath)
      if (s.isDirectory()) {
        try {
          const pkgJson = JSON.parse(await readFile(path.join(entryPath, 'package.json'), 'utf-8'))
          extensions.push({
            name: pkgJson.name ?? entry,
            version: pkgJson.version ?? 'unknown',
            description: pkgJson.description,
            installedAt: s.mtime.toISOString(),
          })
        } catch {
          extensions.push({ name: entry, version: 'unknown' })
        }
      }
    }
  } catch {
    // Directory doesn't exist — try other methods
  }

  // Scan ~/.pi/node_modules/ for pi-extension keyword packages
  const piNodeModules = path.join(home, '.pi', 'node_modules')
  try {
    const entries = await readdir(piNodeModules)
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const entryPath = path.join(piNodeModules, entry)
      const s = await stat(entryPath)
      if (s.isDirectory()) {
        try {
          const pkgJson = JSON.parse(await readFile(path.join(entryPath, 'package.json'), 'utf-8'))
          const keywords = pkgJson.keywords ?? []
          if (keywords.includes('pi-extension')) {
            // Skip duplicates
            if (!extensions.find((e) => e.name === pkgJson.name)) {
              extensions.push({
                name: pkgJson.name ?? entry,
                version: pkgJson.version ?? 'unknown',
                description: pkgJson.description,
                installedAt: s.mtime.toISOString(),
              })
            }
          }
        } catch {
          // skip
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  // Try `pi list` command if available
  try {
    const { stdout } = await execAsync('pi list --json', { encoding: 'utf-8', timeout: 5000, env: process.env })
    const list = JSON.parse(stdout)
    if (Array.isArray(list)) {
      for (const item of list) {
        if (typeof item.name === 'string' && !extensions.find((e) => e.name === item.name)) {
          extensions.push({
            name: item.name,
            version: item.version ?? 'unknown',
            description: item.description,
          })
        }
      }
    }
  } catch {
    // pi list not available or failed
  }

  return extensions
}

// ─── Skill scanning helpers ────────────────────────────────────────────

function parseSkillMd(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return { name: '', description: '' }
  const frontmatter = match[1]
  const nameMatch = frontmatter.match(/name:\s*(.*)/)
  const descMatch = frontmatter.match(/description:\s*(.*)/)
  return {
    name: nameMatch?.[1]?.trim() ?? '',
    description: descMatch?.[1]?.trim() ?? '',
  }
}

async function scanSkillsDir(dir: string): Promise<Array<{ name: string; description: string; path: string; source: string }>> {
  const skills: Array<{ name: string; description: string; path: string; source: string }> = []
  try {
    const entries = await readdir(dir)
    for (const entry of entries) {
      const entryPath = path.join(dir, entry)
      const s = await stat(entryPath)
      if (s.isDirectory()) {
        const skillMdPath = path.join(entryPath, 'SKILL.md')
        try {
          const content = await readFile(skillMdPath, 'utf-8')
          const { name, description } = parseSkillMd(content)
          skills.push({
            name: name || entry,
            description,
            path: entryPath,
            source: 'local',
          })
        } catch {
          // No SKILL.md — skip
        }
      }
    }
  } catch {
    // Directory doesn't exist — skip
  }
  return skills
}
