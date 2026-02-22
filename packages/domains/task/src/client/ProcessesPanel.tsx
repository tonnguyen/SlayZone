import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, RotateCcw, Plus, ChevronDown, ChevronRight, X, ArrowLeft, Terminal, Package, LayoutGrid } from 'lucide-react'
import { cn } from '@slayzone/ui'

type ProcessStatus = 'running' | 'stopped' | 'error'

interface ProcessEntry {
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

interface AddFormState {
  label: string
  command: string
  autoRestart: boolean
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

const STATUS_DOT: Record<ProcessStatus, string> = {
  running: 'bg-green-500',
  stopped: 'bg-neutral-400',
  error: 'bg-red-500'
}

const EMPTY_FORM: AddFormState = { label: '', command: '', autoRestart: false }

type PanelView = 'list' | 'start' | 'custom' | 'pkgjson' | 'static'

function SuggestionCards({ groups, onSelect }: { groups: SuggestionGroup[]; onSelect: (item: SuggestionItem) => void }) {
  return (
    <div className="flex flex-col items-center gap-5 px-4 py-4">
      {groups.map(group => (
        <div key={group.category} className="flex flex-col items-center gap-2 w-160">
          <span className="text-xs font-medium text-muted-foreground/40 uppercase tracking-wider mb-0.5">
            {group.category}
          </span>
          <div className="grid grid-cols-2 gap-2 w-full">
            {group.items.map(item => (
              <button
                key={item.command}
                onClick={() => onSelect(item)}
                className="flex flex-col items-start w-full px-4 py-3 rounded-md border border-border bg-surface-2 hover:bg-muted/50 transition-colors overflow-hidden"
              >
                <span className="text-xs font-mono text-foreground truncate w-full">{item.command}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProcessesPanel({ taskId, cwd }: { taskId: string; cwd?: string | null }) {
  const [scope, setScope] = useState<'task' | 'global'>('task')
  const [processes, setProcesses] = useState<ProcessEntry[]>([])
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [view, setView] = useState<PanelView>('list')
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM)
  const [pkgScripts, setPkgScripts] = useState<SuggestionItem[]>([])
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const fetch = scope === 'global'
      ? window.api.processes.listAll()
      : window.api.processes.list(taskId)
    fetch.then((list) => setProcesses(list as ProcessEntry[]))
  }, [taskId, scope])

  useEffect(() => {
    if (!cwd) return
    window.api.fs.readFile(cwd, 'package.json').then((result) => {
      if (!result.content) return
      try {
        const pkg = JSON.parse(result.content) as { scripts?: Record<string, string> }
        const scripts = pkg.scripts ?? {}
        setPkgScripts(Object.entries(scripts).map(([name]) => ({ name, command: name })))
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

  const toggleLog = useCallback((id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const refreshList = useCallback(async () => {
    const list = scope === 'global'
      ? await window.api.processes.listAll()
      : await window.api.processes.list(taskId)
    setProcesses(list as ProcessEntry[])
  }, [taskId, scope])

  const handleCreate = useCallback(async () => {
    if (!form.label.trim() || !form.command.trim()) return
    await window.api.processes.create(taskId, form.label.trim(), form.command.trim(), cwd ?? '', form.autoRestart)
    await refreshList()
    setView('list')
    setForm(EMPTY_FORM)
  }, [taskId, cwd, form, refreshList])

  const handleSpawn = useCallback(async () => {
    if (!form.label.trim() || !form.command.trim()) return
    const id = await window.api.processes.spawn(taskId, form.label.trim(), form.command.trim(), cwd ?? '', form.autoRestart)
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
    setForm({ label: item.name, command: item.command, autoRestart: false })
    setView('custom')
  }, [])

  const isEmptyState = processes.length === 0 && view === 'list'

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-1">
      {/* Header */}
      <div className="shrink-0 h-10 px-2 border-b border-border flex items-center gap-1">
        {(['global', 'task'] as const).map(s => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={cn(
              'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
              scope === s
                ? 'bg-muted text-foreground border-border shadow-sm'
                : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70 hover:text-foreground'
            )}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Custom form */}
      {view === 'custom' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <div className="w-full max-w-xs flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">New process</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground">Label</label>
              <input
                autoFocus
                placeholder="e.g. frontend"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm outline-none focus:border-ring transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground">Command</label>
              <input
                placeholder="e.g. npm run dev"
                value={form.command}
                onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') void handleSpawn() }}
                className="w-full rounded-md border border-input bg-surface-2 px-3 py-2 text-sm font-mono outline-none focus:border-ring transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.autoRestart}
                onChange={e => setForm(f => ({ ...f, autoRestart: e.target.checked }))}
                className="size-3.5"
              />
              Auto-restart on crash
            </label>
            <div className="flex gap-2">
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
                className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 transition-opacity"
              >
                Run
              </button>
            </div>
          </div>
          <button
            onClick={() => { setView(processes.length === 0 ? 'start' : 'list'); setForm(EMPTY_FORM) }}
            className="w-full max-w-xs py-2 rounded-md border border-border bg-surface-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Empty start screen */}
      {(isEmptyState || view === 'start') && view !== 'custom' && view !== 'pkgjson' && view !== 'static' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setForm(EMPTY_FORM); setView('custom') }}
              className="flex flex-col items-center justify-center gap-4 w-36 h-36 rounded-lg border border-border bg-surface-2 hover:bg-muted/50 transition-colors"
            >
              <Terminal className="size-9 text-muted-foreground" />
              <span className="text-sm text-muted-foreground text-center leading-tight">Create custom</span>
            </button>
            <button
              onClick={() => setView('static')}
              className="flex flex-col items-center justify-center gap-4 w-36 h-36 rounded-lg border border-border bg-surface-2 hover:bg-muted/50 transition-colors"
            >
              <LayoutGrid className="size-9 text-muted-foreground" />
              <span className="text-sm text-muted-foreground text-center leading-tight">Browse common</span>
            </button>
            {pkgScripts.length > 0 && (
              <button
                onClick={() => setView('pkgjson')}
                className="flex flex-col items-center justify-center gap-4 w-36 h-36 rounded-lg border border-border bg-surface-2 hover:bg-muted/50 transition-colors"
              >
                <Package className="size-9 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center leading-tight">package.json</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suggestion views */}
      {view === 'pkgjson' && (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center p-4 gap-4">
          <div className="w-160 flex justify-start">
            <button onClick={() => setView('start')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
              <ArrowLeft className="size-3" /> Back
            </button>
          </div>
          <SuggestionCards groups={[{ category: 'package.json', items: pkgScripts }]} onSelect={applySuggestion} />
        </div>
      )}
      {view === 'static' && (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center p-4 gap-4">
          <div className="w-160 flex justify-start">
            <button onClick={() => setView('start')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
              <ArrowLeft className="size-3" /> Back
            </button>
          </div>
          <SuggestionCards groups={STATIC_SUGGESTIONS} onSelect={applySuggestion} />
        </div>
      )}

      {/* Process list */}
      {view === 'list' && processes.length > 0 && (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm flex flex-col gap-2">
            {processes.map(proc => (
              <div key={proc.id} className="rounded-lg border border-border bg-surface-2 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 group">
                  <span className={cn('size-2 rounded-full shrink-0', STATUS_DOT[proc.status])} />
                  <span className="text-xs font-medium truncate flex-1">{proc.label}</span>
                  {scope === 'global' && (
                    <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 truncate max-w-20">{proc.taskId.slice(0, 8)}</span>
                  )}
                  <span className={cn('text-[10px] shrink-0', proc.status === 'error' ? 'text-red-500' : 'text-muted-foreground')}>
                    {proc.status}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title={proc.status !== 'running' ? 'Start' : 'Restart'}
                      onClick={() => void handleRestart(proc.id)}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      {proc.status !== 'running' ? <Play className="size-3" /> : <RotateCcw className="size-3" />}
                    </button>
                    <button
                      title="Kill"
                      onClick={() => void handleKill(proc.id)}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => toggleLog(proc.id)}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    {expandedLogs.has(proc.id) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  </button>
                </div>
                {expandedLogs.has(proc.id) && (
                  <div className="bg-neutral-950 dark:bg-black max-h-64 overflow-y-auto">
                    <pre className="text-[10px] font-mono text-neutral-300 px-3 py-2 whitespace-pre-wrap break-all leading-relaxed">
                      {proc.logBuffer.length === 0
                        ? <span className="text-neutral-600">No output yet...</span>
                        : proc.logBuffer.join('\n')
                      }
                    </pre>
                    <div ref={el => { logEndRefs.current[proc.id] = el }} />
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => { setForm(EMPTY_FORM); setView('custom') }}
              className="flex items-center justify-center gap-1.5 w-full py-2 mt-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="size-3" />
              Add process
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
