import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import os from 'os'

function defaultDir(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'slayzone')
    case 'win32':
      return path.join(process.env.APPDATA ?? os.homedir(), 'slayzone')
    default:
      return path.join(os.homedir(), '.config', 'slayzone')
  }
}

function getDbPath(dev: boolean): string {
  // Full path override — used by e2e tests to share the running app's DB
  if (process.env.SLAYZONE_DB_PATH) return process.env.SLAYZONE_DB_PATH
  const dir = process.env.SLAYZONE_DB_DIR ?? defaultDir()
  const name = dev ? 'slayzone.dev.sqlite' : 'slayzone.sqlite'
  return path.join(dir, name)
}

type SqlParams = Record<string, string | number | bigint | null | Uint8Array>

export interface SlayDb {
  query<T extends object>(sql: string, params?: SqlParams): T[]
  run(sql: string, params?: SqlParams): void
  close(): void
}

export function openDb(): SlayDb {
  const dev = process.env.SLAYZONE_DEV === '1'
  const dbPath = getDbPath(dev)

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`)
    console.error('Make sure SlayZone has been launched at least once.')
    process.exit(1)
  }

  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA foreign_keys = ON')

  return {
    query<T extends object>(sql: string, params: SqlParams = {}): T[] {
      return db.prepare(sql).all(params) as T[]
    },
    run(sql: string, params: SqlParams = {}) {
      db.prepare(sql).run(params)
    },
    close() {
      db.close()
    },
  }
}
