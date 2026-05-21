import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface WindowState {
  x?: number
  y?: number
  width?: number
  height?: number
  isMaximized?: boolean
  isFullScreen?: boolean
}

const STATE_FILE = 'window-state.json'

export function readWindowState(): WindowState {
  try {
    const filePath = path.join(app.getPath('userData'), STATE_FILE)
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as WindowState
  } catch {
    return {}
  }
}

export function writeWindowState(state: WindowState): void {
  try {
    const filePath = path.join(app.getPath('userData'), STATE_FILE)
    fs.writeFileSync(filePath, JSON.stringify(state), 'utf-8')
  } catch {
    // ignore
  }
}
