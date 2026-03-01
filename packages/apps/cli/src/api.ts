import { openDb } from './db'

export function getPort(): number {
  if (process.env.SLAYZONE_MCP_PORT) return parseInt(process.env.SLAYZONE_MCP_PORT, 10) || 45678
  try {
    const db = openDb()
    const row = db.query<{ value: string }>(`SELECT value FROM settings WHERE key = 'mcp_server_port' LIMIT 1`)
    db.close()
    return parseInt(row[0]?.value ?? '45678', 10) || 45678
  } catch {
    return 45678
  }
}

function baseUrl(): string {
  return `http://127.0.0.1:${getPort()}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${baseUrl()}${path}`, init)
  } catch {
    console.error('SlayZone is not running (could not connect to app).')
    process.exit(1)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let msg = `HTTP ${res.status}`
    try { msg = (JSON.parse(body) as { error?: string }).error ?? msg } catch { if (body) msg = body }
    console.error(msg)
    process.exit(1)
  }
  return res.json() as Promise<T>
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

/** Raw fetch for SSE/streaming — returns the Response directly. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${baseUrl()}${path}`, init)
  } catch {
    console.error('SlayZone is not running (could not connect to app).')
    process.exit(1)
  }
}
