import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import Database from 'better-sqlite3'

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

interface SessionInfo {
  path: string
  id: string
  cwd: string
  name: string | null
  created: Date
  modified: Date
  messageCount: number
  firstMessage: string
}

export class SessionIndexStore {
  private readonly db: Database.Database

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')
    this.migrate()
  }

  close(): void {
    try {
      this.db.pragma('wal_checkpoint(PASSIVE)')
    } catch { /* non-fatal */ }
    this.db.close()
  }

  upsertWorkspace(cwd: string): string {
    const workspacePath = canonicalizePath(cwd)
    this.db
      .prepare(`
        insert into workspaces(path, display_name, last_opened_at)
        values (@path, @displayName, @lastOpenedAt)
        on conflict(path) do update set
          display_name = excluded.display_name,
          last_opened_at = excluded.last_opened_at
      `)
      .run({
        path: workspacePath,
        displayName: path.basename(workspacePath),
        lastOpenedAt: new Date().toISOString(),
      })
    return workspacePath
  }

  removeWorkspace(cwd: string): void {
    const workspacePath = canonicalizePath(cwd)
    this.db
      .prepare('update workspaces set last_opened_at = null where path = @path')
      .run({ path: workspacePath })
  }

  listWorkspaces(): WorkspaceInfo[] {
    const rows = this.db
      .prepare(`
        select w.path, w.display_name, w.last_opened_at,
          count(s.path) as session_count
        from workspaces w
        left join sessions s on s.workspace_path = w.path
        where w.last_opened_at is not null
        group by w.path
        order by w.last_opened_at desc, w.display_name asc
      `)
      .all() as Array<{
        path: string
        display_name: string
        last_opened_at: string | null
        session_count: number
      }>

    return rows.map((row) => ({
      path: row.path,
      displayName: row.display_name,
      lastOpenedAt: row.last_opened_at,
      sessionCount: row.session_count,
    }))
  }

  async refreshSessions(workspacePath?: string): Promise<SessionListItem[]> {
    const infos = await listSessionInfos(workspacePath)
    const seen = new Set<string>()

    const tx = this.db.transaction((sessions: SessionInfo[]) => {
      for (const info of sessions) {
        seen.add(info.path)
        this.upsertSession(info)
      }
    })
    tx(infos)

    // Delete stale rows within the scoped workspace
    if (seen.size > 0 && workspacePath) {
      const placeholders = Array.from(seen).map(() => '?').join(',')
      this.db
        .prepare(
          `delete from sessions where workspace_path = ? and path not in (${placeholders})`
        )
        .run(workspacePath, ...seen)
    }

    return this.listSessions(workspacePath)
  }

  getSessionWorkspace(sessionPath: string): string | null {
    const row = this.db
      .prepare('select workspace_path from sessions where path = ?')
      .get(sessionPath) as { workspace_path: string } | undefined
    return row?.workspace_path ?? null
  }

  isWorkspaceTrusted(cwd: string): boolean {
    const workspacePath = canonicalizePath(cwd)
    const row = this.db
      .prepare('select trusted_at from workspaces where path = ?')
      .get(workspacePath) as { trusted_at: string | null } | undefined
    return Boolean(row?.trusted_at)
  }

  getLastWorkspace(): string | null {
    const row = this.db
      .prepare(`
        select path from workspaces
        where last_opened_at is not null
        order by last_opened_at desc
        limit 1
      `)
      .get() as { path: string } | undefined
    return row?.path ?? null
  }

  listSessions(workspacePath?: string): SessionListItem[] {
    const where: string[] = []
    const params: Record<string, unknown> = {}

    if (workspacePath) {
      where.push('workspace_path = @workspacePath')
      params.workspacePath = workspacePath
    }

    const rows = this.db
      .prepare(`
        select
          path, session_id, workspace_path, title,
          created_at, updated_at, message_count, pinned
        from sessions
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by pinned desc, updated_at desc
      `)
      .all(params) as Array<{
        path: string
        session_id: string
        workspace_path: string
        title: string
        created_at: string
        updated_at: string
        message_count: number
        pinned: number
      }>

    return rows.map((row) => ({
      path: row.path,
      id: row.session_id,
      workspacePath: row.workspace_path,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count,
      active: false,
      pinned: Boolean(row.pinned),
    }))
  }

  renameSession(sessionPath: string, newTitle: string): void {
    // Update the session file's session_info entry
    try {
      const content = fs.readFileSync(sessionPath, 'utf8')
      const lines = content.trim().split('\n')
      let updated = false
      const newLines = lines.map((line) => {
        if (updated) return line
        if (!line.trim()) return line
        try {
          const entry = JSON.parse(line) as Record<string, unknown>
          if (entry.type === 'session_info') {
            updated = true
            return JSON.stringify({ ...entry, name: newTitle })
          }
        } catch {
          // keep line as-is
        }
        return line
      })
      // If no session_info entry found, append one
      if (!updated) {
        newLines.push(JSON.stringify({ type: 'session_info', name: newTitle }))
      }
      fs.writeFileSync(sessionPath, newLines.join('\n') + '\n', 'utf8')
    } catch {
      // If file can't be read, just update DB
    }

    // Update DB
    this.db
      .prepare('update sessions set title = @title where path = @path')
      .run({ path: sessionPath, title: newTitle })
  }

  deleteSession(sessionPath: string): void {
    try {
      fs.unlinkSync(sessionPath)
    } catch {
      // file may not exist
    }
    this.db.prepare('delete from sessions where path = @path').run({ path: sessionPath })
  }

  pinSession(sessionPath: string, pinned: boolean): void {
    this.db
      .prepare('update sessions set pinned = @pinned where path = @path')
      .run({ path: sessionPath, pinned: pinned ? 1 : 0 })
  }

  private upsertSession(info: SessionInfo): void {
    const newMtime = info.modified.getTime()
    const existing = this.db
      .prepare('select file_mtime from sessions where path = ?')
      .get(info.path) as { file_mtime: number } | undefined
    if (existing && existing.file_mtime >= newMtime) return

    const workspacePath = info.cwd ? canonicalizePath(info.cwd) : ''
    if (workspacePath) {
      this.db
        .prepare(`
          insert into workspaces(path, display_name, last_opened_at)
          values (@path, @displayName, coalesce((select last_opened_at from workspaces where path = @path), null))
          on conflict(path) do update set display_name = excluded.display_name
        `)
        .run({ path: workspacePath, displayName: path.basename(workspacePath) })
    }

    const title = info.name || info.firstMessage || 'Untitled session'

    this.db
      .prepare(`
        insert into sessions(
          path, session_id, workspace_path, title,
          created_at, updated_at, message_count, file_mtime
        ) values (
          @path, @sessionId, @workspacePath, @title,
          @createdAt, @updatedAt, @messageCount, @fileMtime
        )
        on conflict(path) do update set
          session_id = excluded.session_id,
          workspace_path = excluded.workspace_path,
          title = excluded.title,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          message_count = excluded.message_count,
          file_mtime = excluded.file_mtime
      `)
      .run({
        path: info.path,
        sessionId: info.id,
        workspacePath,
        title,
        createdAt: toIso(info.created),
        updatedAt: toIso(info.modified),
        messageCount: info.messageCount,
        fileMtime: newMtime,
      })
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists workspaces (
        path text primary key,
        display_name text not null,
        last_opened_at text,
        trusted_at text
      );

      create table if not exists sessions (
        path text primary key,
        session_id text not null,
        workspace_path text not null,
        title text not null,
        created_at text not null,
        updated_at text not null,
        message_count integer not null default 0,
        file_mtime integer not null default 0,
        pinned integer not null default 0
      );

      create index if not exists idx_sessions_workspace on sessions(workspace_path);
      create index if not exists idx_sessions_updated on sessions(updated_at);
    `)

    // Add pinned column if upgrading from old schema
    try {
      this.db.prepare('select pinned from sessions limit 1').get()
    } catch {
      this.db.exec('alter table sessions add column pinned integer not null default 0')
    }
  }
}

// ─── Session file scanning ───────────────────────────────────────────────────

async function listSessionInfos(workspacePath?: string): Promise<SessionInfo[]> {
  const sessionsRoot = path.join(os.homedir(), '.pi', 'agent', 'sessions')
  if (!fs.existsSync(sessionsRoot)) return []

  const dirs = workspacePath
    ? [getDefaultSessionDir(workspacePath)]
    : fs
        .readdirSync(sessionsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(sessionsRoot, entry.name))

  const infos: SessionInfo[] = []
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    let files: string[]
    try {
      files = fs.readdirSync(dir).filter((file) => file.endsWith('.jsonl'))
    } catch {
      continue
    }

    for (const file of files) {
      const info = await buildSessionInfo(path.join(dir, file), workspacePath)
      if (info) infos.push(info)
    }
  }

  return infos.sort((a, b) => b.modified.getTime() - a.modified.getTime())
}

function getDefaultSessionDir(cwd: string): string {
  const safePath = `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`
  return path.join(os.homedir(), '.pi', 'agent', 'sessions', safePath)
}

async function buildSessionInfo(filePath: string, expectedWorkspacePath?: string): Promise<SessionInfo | null> {
  try {
    const stats = fs.statSync(filePath)
    const firstLine = readFirstLine(filePath)
    if (!firstLine) return null

    const header = JSON.parse(firstLine) as unknown
    if (!isRecord(header) || header.type !== 'session' || typeof header.id !== 'string') {
      return null
    }

    const cwd = typeof header.cwd === 'string' ? canonicalizePath(header.cwd) : ''
    if (expectedWorkspacePath && cwd !== expectedWorkspacePath) return null

    const { messageCount, firstMessage, name } = await quickScanSession(filePath)
    const timestamp = typeof header.timestamp === 'string' ? header.timestamp : undefined

    return {
      path: filePath,
      id: header.id,
      cwd,
      name: name || null,
      created: timestamp ? new Date(timestamp) : stats.birthtime,
      modified: stats.mtime,
      messageCount,
      firstMessage,
    }
  } catch {
    return null
  }
}

function readFirstLine(filePath: string): string | null {
  const fd = fs.openSync(filePath, 'r')
  try {
    const buffer = Buffer.alloc(4096)
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0)
    return buffer.toString('utf8', 0, bytesRead).split('\n')[0] ?? null
  } finally {
    fs.closeSync(fd)
  }
}

async function quickScanSession(filePath: string, maxLines = 500): Promise<{
  messageCount: number
  firstMessage: string
  name: string | null
}> {
  let messageCount = 0
  let firstMessage = ''
  let name: string | null = null
  let lineCount = 0

  try {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })

    for await (const line of rl) {
      lineCount++
      if (lineCount > maxLines && firstMessage && name) break
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line) as unknown
        if (!isRecord(entry) || typeof entry.type !== 'string') continue

        if (entry.type === 'message') {
          messageCount++
          const msg = entry.message as Record<string, unknown>
          if (!firstMessage && msg?.role === 'user') {
            firstMessage = truncate(contentToText(msg.content), 70)
          }
        }

        if (entry.type === 'session_info' && !name) {
          const n = entry.name
          if (typeof n === 'string' && n.trim()) {
            name = n.trim()
          }
        }
      } catch {
        // skip malformed line
      }
      if (lineCount > maxLines) break
    }
  } catch {
    // file read error
  }

  return { messageCount, firstMessage, name }
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '')
        }
        return ''
      })
      .join('')
      .trim()
  }
  return ''
}

function truncate(value: string, length: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized
}

function canonicalizePath(value: string): string {
  try {
    return fs.realpathSync.native(value)
  } catch {
    return path.resolve(value)
  }
}

function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
