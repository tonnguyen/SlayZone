import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { Database } from 'better-sqlite3'
import { updateTask } from '@slayzone/task/main'
import { PROVIDER_DEFAULTS, TASK_STATUSES } from '@slayzone/task/shared'

let httpServer: Server | null = null
let idleTimer: NodeJS.Timeout | null = null
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 min
const IDLE_CHECK_INTERVAL = 5 * 60 * 1000 // 5 min

function notifyRenderer(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      try { win.webContents.send('tasks:changed') } catch { /* destroyed */ }
    }
  })
}

function createMcpServer(db: Database): McpServer {
  const server = new McpServer({
    name: 'slayzone',
    version: '1.0.0'
  })

  function resolveCurrentTaskId(explicitTaskId?: string): string | null {
    return explicitTaskId ?? process.env.SLAYZONE_TASK_ID ?? null
  }

  function buildDefaultProviderConfig(): Record<string, { flags: string }> {
    const providerConfig: Record<string, { flags: string }> = {}
    for (const [mode, def] of Object.entries(PROVIDER_DEFAULTS)) {
      const dbDefault = (db.prepare('SELECT value FROM settings WHERE key = ?')
        .get(def.settingsKey) as { value: string } | undefined)?.value ?? def.fallback
      providerConfig[mode] = { flags: dbDefault }
    }
    return providerConfig
  }

  server.tool(
    'get_current_task_id',
    'Preferred first step before other task tools. Returns the current task ID. Pass task_id explicitly (recommended from local $SLAYZONE_TASK_ID env var in task terminals).',
    {
      task_id: z.string().optional().describe('Optional explicit task ID (recommended: pass $SLAYZONE_TASK_ID)'),
    },
    async ({ task_id }) => {
      const resolvedTaskId = resolveCurrentTaskId(task_id)
      if (!resolvedTaskId) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No current task ID available. Pass task_id (recommended from $SLAYZONE_TASK_ID).'
          }],
          isError: true
        }
      }

      const exists = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(resolvedTaskId) as { 1: number } | undefined
      if (!exists) {
        return {
          content: [{
            type: 'text' as const,
            text: `Task ${resolvedTaskId} not found`
          }],
          isError: true
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ task_id: resolvedTaskId }, null, 2)
        }]
      }
    }
  )

  server.tool(
    'update_task',
    'Update a task\'s details (title, description, status, priority, assignee, due date). Prefer calling get_current_task_id first, then pass that as task_id. In task terminals, you can source task_id from local $SLAYZONE_TASK_ID.',
    {
      task_id: z.string().describe('The task ID to update (read from $SLAYZONE_TASK_ID env var)'),
      title: z.string().optional().describe('New title'),
      description: z.string().nullable().optional().describe('New description (null to clear)'),
      status: z.enum(TASK_STATUSES).optional().describe('New status'),
      priority: z.number().min(1).max(5).optional().describe('Priority 1-5 (1=highest)'),
      assignee: z.string().nullable().optional().describe('Assignee name (null to clear)'),
      due_date: z.string().nullable().optional().describe('Due date ISO string (null to clear)'),
      close: z.boolean().optional().describe('Close the task tab in the UI')
    },
    async ({ task_id, due_date, close, ...fields }) => {
      const updated = updateTask(db, { id: task_id, ...fields, dueDate: due_date })
      if (!updated) {
        return { content: [{ type: 'text' as const, text: `Task ${task_id} not found` }], isError: true }
      }
      notifyRenderer()
      if (close) {
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            try { win.webContents.send('app:close-task', task_id) } catch { /* destroyed */ }
          }
        })
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(updated, null, 2)
        }]
      }
    }
  )

  server.tool(
    'create_subtask',
    'Create a subtask under a parent task. Prefer calling get_current_task_id first, then pass that as parent_task_id. In task terminals, you can source parent_task_id from local $SLAYZONE_TASK_ID.',
    {
      parent_task_id: z.string().optional().describe('Parent task ID (recommended: pass $SLAYZONE_TASK_ID)'),
      title: z.string().describe('Subtask title'),
      description: z.string().nullable().optional().describe('Subtask description (null to clear)'),
      status: z.enum(TASK_STATUSES).optional().describe('Initial status (default: inbox)'),
      priority: z.number().min(1).max(5).optional().describe('Priority 1-5 (1=highest, default: 3)'),
      assignee: z.string().nullable().optional().describe('Assignee name (null to clear)'),
      due_date: z.string().nullable().optional().describe('Due date ISO string (null to clear)')
    },
    async ({ parent_task_id, due_date, title, description, status, priority, assignee }) => {
      const resolvedParentId = resolveCurrentTaskId(parent_task_id)
      if (!resolvedParentId) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No parent task ID available. Pass parent_task_id (recommended from $SLAYZONE_TASK_ID).'
          }],
          isError: true
        }
      }

      const parent = db.prepare('SELECT id, project_id, terminal_mode FROM tasks WHERE id = ?').get(resolvedParentId) as
        | { id: string; project_id: string; terminal_mode: string | null }
        | undefined

      if (!parent) {
        return {
          content: [{
            type: 'text' as const,
            text: `Parent task ${resolvedParentId} not found`
          }],
          isError: true
        }
      }

      const id = randomUUID()
      const terminalMode = parent.terminal_mode
        ?? (db.prepare("SELECT value FROM settings WHERE key = 'default_terminal_mode'")
          .get() as { value: string } | undefined)?.value
        ?? 'claude-code'
      const providerConfig = buildDefaultProviderConfig()

      db.prepare(`
        INSERT INTO tasks (
          id, project_id, parent_id, title, description, assignee,
          status, priority, due_date, terminal_mode, provider_config,
          claude_flags, codex_flags, cursor_flags, gemini_flags, opencode_flags,
          is_temporary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        parent.project_id,
        parent.id,
        title,
        description ?? null,
        assignee ?? null,
        status ?? 'inbox',
        priority ?? 3,
        due_date ?? null,
        terminalMode,
        JSON.stringify(providerConfig),
        providerConfig['claude-code']?.flags ?? '',
        providerConfig.codex?.flags ?? '',
        providerConfig['cursor-agent']?.flags ?? '',
        providerConfig.gemini?.flags ?? '',
        providerConfig.opencode?.flags ?? '',
        0
      )

      const created = updateTask(db, { id })
      if (!created) {
        return {
          content: [{ type: 'text' as const, text: `Failed to create subtask under ${resolvedParentId}` }],
          isError: true
        }
      }

      notifyRenderer()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(created, null, 2)
        }]
      }
    }
  )

  return server
}

export function stopMcpServer(): void {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null }
  if (httpServer) { httpServer.close(); httpServer = null }
}

export function startMcpServer(db: Database, port: number): void {
  const app = express()
  app.use(express.json())

  const transports = new Map<string, StreamableHTTPServerTransport>()
  const sessionActivity = new Map<string, number>()

  function touchSession(sid: string): void {
    sessionActivity.set(sid, Date.now())
  }

  function removeSession(sid: string): void {
    transports.delete(sid)
    sessionActivity.delete(sid)
  }

  // Evict sessions idle > 30 min
  idleTimer = setInterval(() => {
    const now = Date.now()
    for (const [sid, lastActive] of sessionActivity) {
      if (now - lastActive > SESSION_IDLE_TIMEOUT) {
        try { transports.get(sid)?.close() } catch { /* already closed */ }
        removeSession(sid)
      }
    }
  }, IDLE_CHECK_INTERVAL)

  app.post('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (sessionId && transports.has(sessionId)) {
        touchSession(sessionId)
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res, req.body)
        return
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const mcpServer = createMcpServer(db)
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports.set(sid, transport)
            touchSession(sid)
          }
        })

        transport.onclose = () => {
          const sid = [...transports.entries()].find(([, t]) => t === transport)?.[0]
          if (sid) removeSession(sid)
        }

        await mcpServer.connect(transport)
        await transport.handleRequest(req, res, req.body)
        return
      }

      res.status(400).json({ error: 'Invalid request — missing session or not an initialize request' })
    } catch (err) {
      console.error('[MCP] POST error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
    }
  })

  app.get('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (sessionId && transports.has(sessionId)) {
        touchSession(sessionId)
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res)
        return
      }
      res.status(400).json({ error: 'Invalid session' })
    } catch (err) {
      console.error('[MCP] GET error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
    }
  })

  app.delete('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!
        await transport.handleRequest(req, res)
        removeSession(sessionId)
        return
      }
      res.status(400).json({ error: 'Invalid session' })
    } catch (err) {
      console.error('[MCP] DELETE error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
    }
  })

  httpServer = app.listen(port, '127.0.0.1', () => {
    const addr = httpServer!.address()
    const actualPort = typeof addr === 'object' && addr ? addr.port : port
    ;(globalThis as Record<string, unknown>).__mcpPort = actualPort
    console.log(`[MCP] Server listening on http://127.0.0.1:${actualPort}/mcp`)
  })
}
