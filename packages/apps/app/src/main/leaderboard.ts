import { execFile } from 'child_process'
import { platform } from 'os'
import type { IpcMain } from 'electron'
import type { Database } from 'better-sqlite3'
import type { LocalLeaderboardStats } from '@slayzone/types'
import { resolveUserShell } from '@slayzone/terminal/main'
import { isCompletedStatus, parseColumnsConfig } from '@slayzone/projects/shared'

interface CcusageDailyEntry {
  date: string
  totalTokens: number
}

function runCcusage(): Promise<CcusageDailyEntry[]> {
  return new Promise((resolve) => {
    const shell = resolveUserShell()
    let shellArgs: string[]
    if (platform() === 'win32') {
      shellArgs = ['/c', 'npx ccusage --json']
    } else if (shell.includes('fish')) {
      shellArgs = ['-i', '-c', 'npx ccusage --json']
    } else {
      shellArgs = ['-lc', 'npx ccusage --json']
    }

    execFile(shell, shellArgs, { timeout: 20_000 }, (_err, stdout) => {
      if (!stdout?.trim()) return resolve([])
      try {
        const data = JSON.parse(stdout.trim()) as { daily?: unknown[] }
        const daily = data?.daily
        if (!Array.isArray(daily)) return resolve([])
        resolve(
          daily
            .filter((d): d is Record<string, unknown> => typeof d === 'object' && d !== null)
            .map((d) => ({
              date: String(d.date ?? ''),
              totalTokens: Number(d.totalTokens ?? 0)
            }))
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
        )
      } catch {
        resolve([])
      }
    })
  })
}

function getTodayCompletedTasks(db: Database): number {
  const today = new Date().toISOString().slice(0, 10)
  const rows = db
    .prepare(
      `SELECT t.status, p.columns_config
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.is_temporary = 0
       AND t.archived_at IS NULL
       AND date(t.updated_at) = ?`
    )
    .all(today) as Array<{ status: string; columns_config: string | null }>

  return rows.reduce((count, row) => (
    isCompletedStatus(row.status, parseColumnsConfig(row.columns_config)) ? count + 1 : count
  ), 0)
}

export function registerLeaderboardHandlers(ipcMain: IpcMain, db: Database): void {
  ipcMain.handle('leaderboard:get-local-stats', async (): Promise<LocalLeaderboardStats> => {
    const today = new Date().toISOString().slice(0, 10)
    const todayCompletedTasks = getTodayCompletedTasks(db)
    const ccusageDays = await runCcusage()

    const days = ccusageDays
      .map((d) => ({
        date: d.date,
        totalTokens: d.totalTokens,
        totalCompletedTasks: d.date === today ? todayCompletedTasks : 0
      }))
      .filter((d) => d.date === today || d.totalTokens > 0)

    if (!days.find((d) => d.date === today)) {
      days.push({ date: today, totalTokens: 0, totalCompletedTasks: todayCompletedTasks })
    }

    return { days }
  })
}
