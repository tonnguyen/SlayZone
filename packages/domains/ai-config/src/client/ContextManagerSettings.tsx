import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Check, ChevronRight,
  Plus, Sparkles, Wrench, Server, FileText, FolderTree, Settings2
} from 'lucide-react'
import { Button, cn, Switch } from '@slayzone/ui'
import type {
  AiConfigItem, AiConfigItemType, AiConfigScope, CliProvider,
  CliProviderInfo, UpdateAiConfigItemInput
} from '../shared'
import { PROVIDER_LABELS } from '../shared/provider-registry'
import { ContextItemEditor } from './ContextItemEditor'
import { GlobalContextFiles } from './GlobalContextFiles'
import { McpServersPanel } from './McpServersPanel'
import { ProjectContextFlat } from './ProjectContextFlat'
import { ProjectContextFilesView } from './ProjectContextFilesView'
import { ProjectInstructions } from './ProjectInstructions'

type Section = 'providers' | 'instructions' | 'skill' | 'command' | 'mcp' | 'files'

interface ContextManagerSettingsProps {
  scope: AiConfigScope
  projectId: string | null
  projectPath?: string | null
  projectName?: string
  projectTab?: ProjectContextManagerTab
}

export type ProjectContextManagerTab = 'config' | 'files'

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function nextAvailableSlug(base: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(base)) return base
  let index = 2
  while (existingSlugs.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

// ---------------------------------------------------------------------------
// Overview panel — global scope only
// ---------------------------------------------------------------------------

interface OverviewData {
  instructions: { content: string } | null
  skills: AiConfigItem[]
  commands: AiConfigItem[]
  providers: CliProviderInfo[]
}

function OverviewPanel({
  onNavigate,
  version
}: {
  onNavigate: (section: Section) => void
  version: number
}) {
  const [data, setData] = useState<OverviewData | null>(null)

  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        const [instrContent, skills, commands, providers] = await Promise.all([
          window.api.aiConfig.getGlobalInstructions(),
          window.api.aiConfig.listItems({ scope: 'global', type: 'skill' }),
          window.api.aiConfig.listItems({ scope: 'global', type: 'command' }),
          window.api.aiConfig.listProviders()
        ])
        if (stale) return
        setData({
          instructions: { content: instrContent },
          skills,
          commands,
          providers,
        })
      } catch {
        // silently fail — cards will show loading state
      }
    })()
    return () => { stale = true }
  }, [version])

  if (!data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/20" />
        ))}
      </div>
    )
  }

  const skillCount = data.skills.length
  const commandCount = data.commands.length
  const enabledProviders = data.providers.filter(p => p.enabled)
  const hasContent = !!data.instructions?.content

  return (
    <div className="space-y-2.5">
      {/* Providers */}
      <button
        onClick={() => onNavigate('providers')}
        data-testid="context-overview-providers"
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Settings2 className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Providers</span>
            <div className="flex items-center gap-2">
              {enabledProviders.map(p => (
                <span key={p.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <div className="size-2 rounded-full bg-green-500" />
                  {PROVIDER_LABELS[p.kind as CliProvider] ?? p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Instructions */}
      <button
        onClick={() => onNavigate('instructions')}
        data-testid="context-overview-instructions"
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <FileText className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Instructions</span>
            {hasContent && (
              <span className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Check className="size-2.5" /> Saved
              </span>
            )}
          </div>
          {hasContent && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {data.instructions!.content.slice(0, 120)}
            </p>
          )}
          {!hasContent && (
            <p className="mt-0.5 text-xs text-muted-foreground">No instructions yet</p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Skills */}
      <button
        onClick={() => onNavigate('skill')}
        data-testid="context-overview-skills"
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Sparkles className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Skills</span>
            <span className="text-xs text-muted-foreground">{skillCount} defined</span>
          </div>
          {skillCount > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.skills.slice(0, 5).map((s, i) => (
                <span key={i} className="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]">{s.slug}</span>
              ))}
              {skillCount > 5 && <span className="text-[11px] text-muted-foreground">+{skillCount - 5} more</span>}
            </div>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Commands */}
      <button
        onClick={() => onNavigate('command')}
        data-testid="context-overview-commands"
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Wrench className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Commands</span>
            <span className="text-xs text-muted-foreground">{commandCount} defined</span>
          </div>
          {commandCount > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.commands.slice(0, 5).map((s, i) => (
                <span key={i} className="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px]">{s.slug}</span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* MCP Servers */}
      <button
        onClick={() => onNavigate('mcp')}
        data-testid="context-overview-mcp"
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <Server className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">MCP Servers</span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Files */}
      <button
        onClick={() => onNavigate('files')}
        data-testid="context-overview-files"
        className="flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <FolderTree className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">Files</span>
          <p className="mt-0.5 text-xs text-muted-foreground">Global config files across all providers</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Providers panel (global)
// ---------------------------------------------------------------------------

function ProvidersPanel() {
  const [providers, setProviders] = useState<CliProviderInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const list = await window.api.aiConfig.listProviders()
        setProviders(list)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleToggle = async (provider: CliProviderInfo) => {
    const newEnabled = !provider.enabled
    await window.api.aiConfig.toggleProvider(provider.id, newEnabled)
    setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, enabled: newEnabled } : p))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Enable the providers you use. Skills and instructions will sync to enabled providers.
      </p>
      {providers.map(provider => {
        const isPlaceholder = provider.status === 'placeholder'
        return (
          <div
            key={provider.id}
            className={cn(
              'flex items-center justify-between rounded-md border px-3 py-2.5',
              isPlaceholder && 'opacity-50'
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {PROVIDER_LABELS[provider.kind as CliProvider] ?? provider.name}
              </p>
              {isPlaceholder && (
                <p className="text-[11px] text-muted-foreground">Coming soon</p>
              )}
            </div>
            <Switch
              checked={provider.enabled}
              onCheckedChange={() => handleToggle(provider)}
              disabled={isPlaceholder}
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContextManagerSettings({ scope, projectId, projectPath, projectName, projectTab }: ContextManagerSettingsProps) {
  const isProject = scope === 'project' && !!projectId && !!projectPath
  const activeProjectTab = projectTab ?? 'config'

  if (isProject) {
    if (activeProjectTab === 'files') {
      return (
        <ProjectContextFilesView
          projectId={projectId!}
          projectPath={projectPath!}
        />
      )
    }

    return (
      <ProjectContextFlat
        projectId={projectId!}
        projectPath={projectPath!}
        projectName={projectName}
      />
    )
  }

  return <GlobalContextManager />
}

// ---------------------------------------------------------------------------
// Global context manager — own component so hooks are unconditional
// ---------------------------------------------------------------------------

function GlobalContextManager() {
  const [section, setSection] = useState<Section | null>(null)
  const [items, setItems] = useState<AiConfigItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [providerVersion] = useState(0)
  const [syncCheckVersion] = useState(0)

  const isItemSection = section === 'skill' || section === 'command'

  const loadItems = useCallback(async () => {
    if (!isItemSection) return
    setLoading(true)
    try {
      const rows = await window.api.aiConfig.listItems({
        scope: 'global',
        type: section as AiConfigItemType
      })
      setItems(rows)
    } finally {
      setLoading(false)
    }
  }, [section, isItemSection])

  useEffect(() => {
    void loadItems()
    setEditingId(null)
  }, [loadItems])

  const handleCreate = async () => {
    if (!isItemSection) return
    const type = section as AiConfigItemType
    const existingSlugs = new Set(items.map((item) => item.slug))
    const slug = nextAvailableSlug(type === 'skill' ? 'new-skill' : 'new-command', existingSlugs)
    const defaultContent = type === 'skill'
      ? '---\ndescription: \ntrigger: auto\n---\n\n'
      : '---\ndescription: \nshortcut: \n---\n\n'
    const created = await window.api.aiConfig.createItem({
      type,
      scope: 'global',
      slug,
      content: defaultContent
    })
    setItems((prev) => [created, ...prev])
    setEditingId(created.id)
  }

  const handleUpdate = async (itemId: string, patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    const updated = await window.api.aiConfig.updateItem({ id: itemId, ...patch })
    if (!updated) return
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  const handleDelete = async (itemId: string) => {
    await window.api.aiConfig.deleteItem(itemId)
    setItems((prev) => prev.filter((item) => item.id !== itemId))
    setEditingId(null)
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Header: back button + actions when drilled in */}
      {section !== null && (
        <div className="flex items-center justify-between gap-3 pb-4">
          <button
            onClick={() => setSection(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Overview
          </button>

          <div className="flex items-center gap-2">
            {isItemSection && (
              <Button
                size="sm"
                onClick={handleCreate}
                data-testid={`context-new-${section}`}
              >
                <Plus className="mr-1 size-3.5" />
                New
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Section description */}
      {section !== null && (
        <p className="pb-3 text-xs text-muted-foreground">
          {section === 'providers' && 'Choose which AI coding tools to sync content to.'}
          {section === 'instructions' && 'Global instructions stored in the database. Not synced to any file.'}
          {section === 'skill' && 'Global skills shared across all projects. Synced to enabled providers.'}
          {section === 'command' && 'Global commands shared across all projects. Invoked via /command-name.'}
          {section === 'mcp' && 'Browse and favorite MCP servers from the curated catalog.'}
          {section === 'files' && 'Global config files across all provider directories.'}
        </p>
      )}

      {/* Content area */}
      <div className="flex-1">
        {section === null ? (
          <OverviewPanel
            onNavigate={setSection}
            version={providerVersion + syncCheckVersion}
          />
        ) : section === 'providers' ? (
          <ProvidersPanel />
        ) : section === 'instructions' ? (
          <ProjectInstructions />
        ) : section === 'mcp' ? (
          <McpServersPanel mode="global" />
        ) : section === 'files' ? (
          <GlobalContextFiles />
        ) : isItemSection ? (
          <>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                {section === 'skill'
                  ? <Sparkles className="size-8 text-muted-foreground/40" />
                  : <Wrench className="size-8 text-muted-foreground/40" />
                }
                <p className="mt-3 text-sm font-medium text-foreground">
                  No {section === 'skill' ? 'skills' : 'commands'} yet
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {section === 'skill'
                    ? 'Skills give AI assistants reusable capabilities. Create one to get started.'
                    : 'Commands are shortcuts you can invoke from any provider. Create one to get started.'}
                </p>
                <Button size="sm" className="mt-4" onClick={handleCreate}>
                  <Plus className="mr-1 size-3.5" />
                  Create {section === 'skill' ? 'skill' : 'command'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id}>
                    {editingId === item.id ? (
                      <ContextItemEditor
                        item={item}
                        onUpdate={(patch) => handleUpdate(item.id, patch)}
                        onDelete={() => handleDelete(item.id)}
                        onClose={() => setEditingId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingId(item.id)}
                        data-testid={`context-global-item-${item.slug}`}
                        className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm">{item.slug}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatTimestamp(item.updated_at)}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
