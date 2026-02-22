import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Play, RotateCcw, Plus, ChevronDown, ChevronRight, X, ArrowLeft, Cpu } from 'lucide-react'
import { cn } from '@slayzone/ui'

type ProcessStatus = 'running' | 'stopped' | 'error'

interface ProcessEntry {
  id: string
  taskId: string | null
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

interface AddFormState {
  label: string
  command: string
  autoRestart: boolean
  scope: 'task' | 'global'
}

interface SuggestionItem {
  name: string
  command: string
}

interface SuggestionGroup {
  category: string
  items: SuggestionItem[]
}

const STATIC_SUGGESTIONS: SuggestionGroup[] = [
  {
    category: 'Dev servers',
    items: [
      { name: 'Vite', command: 'vite' },
      { name: 'Next.js', command: 'next dev' },
      { name: 'Rails', command: 'rails server' },
      { name: 'Django', command: 'python manage.py runserver' },
      { name: 'Laravel', command: 'php artisan serve' },
      { name: 'Express', command: 'node server.js' },
    ]
  },
  {
    category: 'Watchers',
    items: [
      { name: 'TypeScript', command: 'tsc --watch' },
      { name: 'Vitest', command: 'vitest --watch' },
      { name: 'Jest', command: 'jest --watch' },
    ]
  },
  {
    category: 'Services',
    items: [
      { name: 'Redis', command: 'redis-server' },
      { name: 'Docker Compose', command: 'docker compose up' },
      { name: 'PostgreSQL', command: 'pg_ctl start' },
    ]
  },
  {
    category: 'Tunnels & tools',
    items: [
      { name: 'ngrok', command: 'ngrok http 3000' },
      { name: 'Stripe CLI', command: 'stripe listen --forward-to localhost:3000' },
      { name: 'Cloudflare Tunnel', command: 'cloudflared tunnel run' },
    ]
  },
]

const STATUS_BADGE: Record<ProcessStatus, string> = {
  running: 'bg-green-500/10 text-green-500 border-green-500/25',
  stopped: 'bg-muted/60 text-muted-foreground border-border',
  error: 'bg-red-500/10 text-red-500 border-red-500/25',
}

const EMPTY_FORM: AddFormState = { label: '', command: '', autoRestart: false, scope: 'task' }

function ProcessRow({
  proc,
  expanded,
  onToggleLog,
  onRestart,
  onKill,
  logEndRef,
}: {
  proc: ProcessEntry
  expanded: boolean
  onToggleLog: () => void
  onRestart: () => void
  onKill: () => void
  logEndRef: (el: HTMLDivElement | null) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 overflow-hidden group">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <span className="text-sm font-medium leading-none">{proc.label}</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/40 font-mono select-none">$</span>
            <span className="text-[11px] font-mono text-muted-foreground/70 truncate">{proc.command}</span>
          </div>
        </div>
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0', STATUS_BADGE[proc.status])}>
          {proc.status}
        </span>
        <div className="flex items-center gap-0.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
          <button
            title={proc.status !== 'running' ? 'Start' : 'Restart'}
            onClick={onRestart}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {proc.status !== 'running' ? <Play className="size-3.5" /> : <RotateCcw className="size-3.5" />}
          </button>
          <button
            title="Remove"
            onClick={onKill}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <button
          onClick={onToggleLog}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 opacity-40 group-hover:opacity-100"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      </div>
      {expanded && (
        <div className="bg-neutral-950 dark:bg-black border-t border-neutral-900 max-h-56 overflow-y-auto">
          <pre className="text-[10px] font-mono text-neutral-300 px-4 py-3 whitespace-pre-wrap break-all leading-relaxed">
            {proc.logBuffer.length === 0
              ? <span className="text-neutral-600 italic">No output yet</span>
              : proc.logBuffer.join('\n')}
          </pre>
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40 px-1 pt-1 pb-0.5">
      {label}
    </p>
  )
}

export function ProcessesPanel({ taskId, cwd }: { taskId: string; cwd?: string | null }) {
  const [processes, setProcesses] = useState<ProcessEntry[]>([])
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'list' | 'new'>('list')
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM)
  const [pkgScripts, setPkgScripts] = useState<SuggestionItem[]>([])
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.processes.listForTask(taskId).then((list) => setProcesses(list as ProcessEntry[]))
  }, [taskId])

  useEffect(() => {
    if (!cwd) return
    window.api.fs.readFile(cwd, 'package.json').then((result) => {
      if (!result.content) return
      try {
        const pkg = JSON.parse(result.content) as { scripts?: Record<string, string> }
        setPkgScripts(Object.entries(pkg.scripts ?? {}).map(([name]) => ({ name, command: name })))
      } catch { /* no-op */ }
    }).catch(() => { /* no package.json */ })
  }, [cwd])

  useEffect(() => {
    const unsub = window.api.processes.onLog((processId, line) => {
      setProcesses(prev =>
        prev.map(p => p.id === processId ? { ...p, logBuffer: [...p.logBuffer.slice(-499), line] } : p)
      )
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.api.processes.onStatus((processId, status) => {
      setProcesses(prev => prev.map(p => p.id === processId ? { ...p, status } : p))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.api.app.onCloseTask((closedTaskId) => {
      if (closedTaskId === taskId) window.api.processes.killTask(taskId)
    })
    return unsub
  }, [taskId])

  useEffect(() => {
    for (const id of expandedLogs) {
      logEndRefs.current[id]?.scrollIntoView({ block: 'nearest' })
    }
  }, [processes, expandedLogs])

  useEffect(() => {
    if (view === 'new') setTimeout(() => labelRef.current?.focus(), 50)
  }, [view])

  const refreshList = useCallback(async () => {
    const list = await window.api.processes.listForTask(taskId)
    setProcesses(list as ProcessEntry[])
  }, [taskId])

  const toggleLog = useCallback((id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleCreate = useCallback(async () => {
    if (!form.label.trim() || !form.command.trim()) return
    const tid = form.scope === 'global' ? null : taskId
    await window.api.processes.create(tid, form.label.trim(), form.command.trim(), cwd ?? '', form.autoRestart)
    await refreshList()
    setView('list')
    setForm(EMPTY_FORM)
  }, [taskId, cwd, form, refreshList])

  const handleSpawn = useCallback(async () => {
    if (!form.label.trim() || !form.command.trim()) return
    const tid = form.scope === 'global' ? null : taskId
    const id = await window.api.processes.spawn(tid, form.label.trim(), form.command.trim(), cwd ?? '', form.autoRestart)
    await refreshList()
    setExpandedLogs(prev => new Set(prev).add(id))
    setView('list')
    setForm(EMPTY_FORM)
  }, [taskId, cwd, form, refreshList])

  const handleKill = useCallback(async (id: string) => {
    await window.api.processes.kill(id)
    setProcesses(prev => prev.filter(p => p.id !== id))
    setExpandedLogs(prev => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const handleRestart = useCallback(async (id: string) => {
    await window.api.processes.restart(id)
  }, [])

  const applySuggestion = useCallback((item: SuggestionItem) => {
    setForm(f => ({ ...f, label: f.label || item.name, command: item.command }))
    labelRef.current?.focus()
  }, [])

  const goToNew = useCallback(() => { setForm(EMPTY_FORM); setView('new') }, [])
  const goToList = useCallback(() => { setView('list'); setForm(EMPTY_FORM) }, [])

  const globalProcesses = useMemo(() => processes.filter(p => p.taskId === null), [processes])
  const taskProcesses = useMemo(() => processes.filter(p => p.taskId === taskId), [processes, taskId])

  const allSuggestions: SuggestionGroup[] = [
    ...(pkgScripts.length > 0 ? [{ category: 'package.json', items: pkgScripts }] : []),
    ...STATIC_SUGGESTIONS,
  ]

  const isEmpty = processes.length === 0

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-1">

      {/* Header */}
      <div className="shrink-0 h-10 px-2 border-b border-border flex items-center gap-1">
        {view === 'list' ? (
          <>
            <span className="text-xs font-medium text-muted-foreground px-1">Processes</span>
            <div className="flex-1" />
            <button
              onClick={goToNew}
              className="flex items-center gap-1 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="size-3.5" />
              New process
            </button>
          </>
        ) : (
          <button
            onClick={goToList}
            className="flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            New process
          </button>
        )}
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center gap-5 p-8">
              <div className="flex flex-col items-center gap-3">
                <div className="size-12 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Cpu className="size-6 text-muted-foreground" />
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-sm font-semibold">No processes</p>
                  <p className="text-xs text-foreground/60 text-center leading-relaxed max-w-72" style={{ textWrap: 'balance' }}>
                    Run dev servers, watchers, or any background command alongside your task
                  </p>
                </div>
              </div>
              <button
                onClick={goToNew}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="size-3.5" />
                New process
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {globalProcesses.length > 0 && (
                <>
                  <SectionHeader label="Global" />
                  {globalProcesses.map(proc => (
                    <ProcessRow
                      key={proc.id}
                      proc={proc}
                      expanded={expandedLogs.has(proc.id)}
                      onToggleLog={() => toggleLog(proc.id)}
                      onRestart={() => void handleRestart(proc.id)}
                      onKill={() => void handleKill(proc.id)}
                      logEndRef={el => { logEndRefs.current[proc.id] = el }}
                    />
                  ))}
                </>
              )}
              {taskProcesses.length > 0 && (
                <>
                  <SectionHeader label="This task" />
                  {taskProcesses.map(proc => (
                    <ProcessRow
                      key={proc.id}
                      proc={proc}
                      expanded={expandedLogs.has(proc.id)}
                      onToggleLog={() => toggleLog(proc.id)}
                      onRestart={() => void handleRestart(proc.id)}
                      onKill={() => void handleKill(proc.id)}
                      logEndRef={el => { logEndRefs.current[proc.id] = el }}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* New process view */}
      {view === 'new' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 pt-5 pb-5 flex flex-col gap-4">

            {/* Scope toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Scope
              </label>
              <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50 border border-border w-fit">
                {(['task', 'global'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setForm(f => ({ ...f, scope: s }))}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                      form.scope === s
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {s === 'task' ? 'This task' : 'Global'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                {form.scope === 'task'
                  ? 'Stopped when this task is closed or deleted.'
                  : 'Persists across all tasks for the entire session.'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Label
              </label>
              <input
                ref={labelRef}
                placeholder="e.g. Frontend"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Command
              </label>
              <input
                placeholder="e.g. npm run dev"
                value={form.command}
                onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') void handleSpawn() }}
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm font-mono outline-none focus:border-ring transition-colors"
              />
            </div>
            <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.autoRestart}
                onChange={e => setForm(f => ({ ...f, autoRestart: e.target.checked }))}
                className="size-3.5 rounded"
              />
              Auto-restart on crash
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void handleCreate()}
                disabled={!form.label.trim() || !form.command.trim()}
                className="flex-1 py-2 rounded-md border border-border bg-surface-2 text-sm font-medium text-foreground disabled:opacity-40 hover:bg-muted/50 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => void handleSpawn()}
                disabled={!form.label.trim() || !form.command.trim()}
                className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Run
              </button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="border-t border-border px-4 pt-4 pb-6 flex flex-col gap-5">
            {allSuggestions.map(group => (
              <div key={group.category} className="flex flex-col gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  {group.category}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(item => (
                    <button
                      key={item.command}
                      onClick={() => applySuggestion(item)}
                      title={item.command}
                      className="px-2.5 py-1 rounded border border-border bg-surface-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
