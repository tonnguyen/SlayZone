import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'

export type ProcessStatus = 'running' | 'stopped' | 'error'

export interface ProcessInfo {
  id: string
  taskId: string
  label: string
  command: string
  cwd: string
  autoRestart: boolean
  status: ProcessStatus
  pid: number | null
  exitCode: number | null
  logBuffer: string[]
  startedAt: string
}

interface ManagedProcess extends ProcessInfo {
  child: ChildProcess | null
}

const LOG_BUFFER_MAX = 500

let win: BrowserWindow | null = null
const processes = new Map<string, ManagedProcess>()

export function setProcessManagerWindow(window: BrowserWindow): void {
  win = window
}

function pushLog(proc: ManagedProcess, line: string): void {
  proc.logBuffer.push(line)
  if (proc.logBuffer.length > LOG_BUFFER_MAX) proc.logBuffer.shift()
  if (!win?.webContents.isDestroyed()) {
    win?.webContents.send('processes:log', proc.id, line)
  }
}

function setStatus(proc: ManagedProcess, status: ProcessStatus): void {
  proc.status = status
  if (!win?.webContents.isDestroyed()) {
    win?.webContents.send('processes:status', proc.id, status)
  }
}

function doSpawn(proc: ManagedProcess): void {
  const child = spawn(proc.command, [], {
    cwd: proc.cwd,
    shell: true,
    env: { ...process.env }
  })

  proc.child = child
  proc.pid = child.pid ?? null
  proc.exitCode = null

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) pushLog(proc, line)
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line.trim()) pushLog(proc, line)
    }
  })

  child.on('exit', (code) => {
    proc.pid = null
    proc.child = null
    proc.exitCode = code
    if (proc.autoRestart && processes.has(proc.id)) {
      pushLog(proc, `[exited with code ${code ?? '?'}, restarting in 1s...]`)
      setStatus(proc, 'running')
      setTimeout(() => {
        if (processes.has(proc.id)) doSpawn(proc)
      }, 1000)
    } else {
      setStatus(proc, code === 0 ? 'stopped' : 'error')
    }
  })
}

export function createProcess(
  taskId: string,
  label: string,
  command: string,
  cwd: string,
  autoRestart: boolean
): string {
  const id = randomUUID()
  const proc: ManagedProcess = {
    id,
    taskId,
    label,
    command,
    cwd,
    autoRestart,
    status: 'stopped',
    pid: null,
    exitCode: null,
    logBuffer: [],
    child: null,
    startedAt: new Date().toISOString()
  }
  processes.set(id, proc)
  return id
}

export function spawnProcess(
  taskId: string,
  label: string,
  command: string,
  cwd: string,
  autoRestart: boolean
): string {
  const id = randomUUID()
  const proc: ManagedProcess = {
    id,
    taskId,
    label,
    command,
    cwd,
    autoRestart,
    status: 'running',
    pid: null,
    exitCode: null,
    logBuffer: [],
    child: null,
    startedAt: new Date().toISOString()
  }
  processes.set(id, proc)
  doSpawn(proc)
  return id
}

export function killProcess(id: string): boolean {
  const proc = processes.get(id)
  if (!proc) return false
  proc.autoRestart = false
  proc.child?.kill()
  proc.child = null
  processes.delete(id)
  return true
}

export function restartProcess(id: string): boolean {
  const proc = processes.get(id)
  if (!proc) return false
  proc.child?.kill()
  proc.child = null
  proc.logBuffer.push('[restarting...]')
  setStatus(proc, 'running')
  setTimeout(() => doSpawn(proc), 500)
  return true
}

export function killTaskProcesses(taskId: string): void {
  for (const [id, proc] of processes.entries()) {
    if (proc.taskId === taskId) {
      proc.autoRestart = false
      proc.child?.kill()
      processes.delete(id)
    }
  }
}

export function listProcesses(taskId: string): ProcessInfo[] {
  return Array.from(processes.values())
    .filter(p => p.taskId === taskId)
    .map(({ child: _, ...info }) => info)
}

export function listAllProcesses(): ProcessInfo[] {
  return Array.from(processes.values()).map(({ child: _, ...info }) => info)
}

export function killAllProcesses(): void {
  for (const proc of processes.values()) {
    proc.autoRestart = false
    proc.child?.kill()
  }
  processes.clear()
}
