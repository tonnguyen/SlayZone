import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Check, AlertCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button, Switch, Textarea, cn, toast } from '@slayzone/ui'
import type {
  AiConfigItem, CliProvider, CliProviderInfo,
  ProjectSkillStatus, ProviderSyncStatus
} from '../shared'
import { PROVIDER_LABELS, PROVIDER_PATHS } from '../shared/provider-registry'
import { ItemSection } from './ItemSection'
import { McpFlatSection } from './McpFlatSection'
import { ProviderChips } from './ProviderChips'

interface ProjectContextFlatProps {
  projectId: string
  projectPath: string
  projectName?: string
}

interface ContextData {
  linkedSkills: ProjectSkillStatus[]
  linkedCommands: ProjectSkillStatus[]
  localItems: AiConfigItem[]
  enabledProviders: CliProvider[]
  allProviders: CliProviderInfo[]
  instructions: { content: string; providerStatus: Partial<Record<CliProvider, ProviderSyncStatus>> }
  pruneUnmanaged: boolean
}

function parseBooleanSetting(value: string | null): boolean {
  if (value === null) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

// ---------------------------------------------------------------------------
// Instructions section (inline)
// ---------------------------------------------------------------------------

function InstructionsSection({
  projectId,
  projectPath,
  instructions,
  onChanged
}: {
  projectId: string
  projectPath: string
  instructions: ContextData['instructions']
  onChanged: () => void
}) {
  const [content, setContent] = useState(instructions.content)
  const [providerStatus, setProviderStatus] = useState(instructions.providerStatus)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from parent when data reloads
  useEffect(() => {
    setContent(instructions.content)
    setProviderStatus(instructions.providerStatus)
  }, [instructions])

  const saveContent = useCallback(async (text: string) => {
    try {
      const result = await window.api.aiConfig.saveRootInstructions(projectId, projectPath, text)
      setProviderStatus(result.providerStatus)
      onChanged()
    } catch {
      toast.error('Failed to sync instructions')
    }
  }, [projectId, projectPath, onChanged])

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveContent(text), 800)
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const providers = Object.keys(providerStatus) as CliProvider[]
  const [open, setOpen] = useState(false)

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-muted/15"
        onClick={() => setOpen(o => !o)}
      >
        {open
          ? <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          : <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        }
        <span className="text-sm font-medium">Instructions</span>
        <span className="text-[11px] text-muted-foreground">
          Synced to each provider's config file
        </span>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <Textarea
            className="min-h-[200px] resize-y font-mono text-xs"
            placeholder="Project instructions synced to all enabled providers..."
            value={content}
            onChange={handleChange}
          />
          {providers.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {providers.map(provider => {
                const status = providerStatus[provider]!
                const rootPath = PROVIDER_PATHS[provider]?.rootInstructions
                return (
                  <div key={provider} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {status === 'synced' && <Check className="size-3 text-green-600 dark:text-green-400" />}
                    {status === 'out_of_sync' && <AlertCircle className="size-3 text-amber-600 dark:text-amber-400" />}
                    {status === 'not_synced' && <span className="size-3 rounded-full border border-dashed border-muted-foreground" />}
                    <span>{rootPath ?? PROVIDER_LABELS[provider]}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main flat layout
// ---------------------------------------------------------------------------

export function ProjectContextFlat({ projectId, projectPath }: ProjectContextFlatProps) {
  const [data, setData] = useState<ContextData | null>(null)
  const [version, setVersion] = useState(0)
  const [syncingMode, setSyncingMode] = useState<'sync' | 'reset' | null>(null)

  const bumpVersion = useCallback(() => setVersion(v => v + 1), [])

  useEffect(() => {
    let stale = false
    void (async () => {
      try {
        const [skillsStatus, localItems, enabledProviders, allProviders, instructions, pruneSetting] = await Promise.all([
          window.api.aiConfig.getProjectSkillsStatus(projectId, projectPath),
          window.api.aiConfig.listItems({ scope: 'project', projectId }),
          window.api.aiConfig.getProjectProviders(projectId),
          window.api.aiConfig.listProviders(),
          window.api.aiConfig.getRootInstructions(projectId, projectPath),
          window.api.settings.get(`ai_config:prune_unmanaged:${projectId}`)
        ])
        if (stale) return
        setData({
          linkedSkills: skillsStatus.filter(s => s.item.type === 'skill'),
          linkedCommands: skillsStatus.filter(s => s.item.type === 'command'),
          localItems: localItems.filter(i => i.type !== 'root_instructions'),
          enabledProviders,
          allProviders: allProviders.filter(p => p.status === 'active'),
          instructions,
          pruneUnmanaged: parseBooleanSetting(pruneSetting)
        })
      } catch {
        // silent
      }
    })()
    return () => { stale = true }
  }, [projectId, projectPath, version])

  const handleSyncAll = async () => {
    if (!data) return
    setSyncingMode('sync')
    try {
      const result = await window.api.aiConfig.syncAll({
        projectId,
        projectPath,
        pruneUnmanaged: data.pruneUnmanaged
      })
      const removed = result.deleted.length
      const added = result.written.length
      toast.success(`Sync complete: removed ${removed} file${removed === 1 ? '' : 's'}, added ${added} file${added === 1 ? '' : 's'}.`)
      bumpVersion()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncingMode(null)
    }
  }

  const handleResetAndSync = async () => {
    setSyncingMode('reset')
    try {
      const result = await window.api.aiConfig.syncAll({
        projectId,
        projectPath,
        pruneUnmanaged: true
      })
      const removed = result.deleted.length
      const added = result.written.length
      toast.success(`Reset complete: removed ${removed} file${removed === 1 ? '' : 's'}, added ${added} file${added === 1 ? '' : 's'}.`)
      bumpVersion()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset and sync failed')
    } finally {
      setSyncingMode(null)
    }
  }

  const handleSetPruneUnmanaged = async (enabled: boolean) => {
    if (!data) return
    setData((prev) => (prev ? { ...prev, pruneUnmanaged: enabled } : prev))
    await window.api.settings.set(`ai_config:prune_unmanaged:${projectId}`, enabled ? '1' : '0')
  }

  if (!data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/20" />
        ))}
      </div>
    )
  }

  const localSkills = data.localItems.filter(i => i.type === 'skill')
  const localCommands = data.localItems.filter(i => i.type === 'command')

  // Show commands section only if at least one enabled provider supports commands
  const hasCommandProviders = data.enabledProviders.some(p => !!PROVIDER_PATHS[p]?.commandsDir)

  return (
    <div className="space-y-6">
      {/* Provider chips */}
      <div>
        <span className="mb-2 block text-sm font-medium">Providers</span>
        <ProviderChips projectId={projectId} layout="inline" onChange={bumpVersion} />
      </div>

      {/* Instructions */}
      <InstructionsSection
        projectId={projectId}
        projectPath={projectPath}
        instructions={data.instructions}
        onChanged={bumpVersion}
      />

      {/* Skills */}
      <ItemSection
        type="skill"
        linkedItems={data.linkedSkills}
        localItems={localSkills}
        enabledProviders={data.enabledProviders}
        projectId={projectId}
        projectPath={projectPath}
        onChanged={bumpVersion}
      />

      {/* Commands — conditional */}
      {hasCommandProviders && (
        <ItemSection
          type="command"
          linkedItems={data.linkedCommands}
          localItems={localCommands}
          enabledProviders={data.enabledProviders}
          projectId={projectId}
          projectPath={projectPath}
          onChanged={bumpVersion}
        />
      )}

      {/* MCPs */}
      <McpFlatSection
        projectPath={projectPath}
        enabledProviders={data.enabledProviders}
        onChanged={bumpVersion}
      />

      {/* Sync controls */}
      <div className="flex items-center justify-between border-t pt-4">
        <label className="flex items-start gap-2">
          <Switch
            checked={data.pruneUnmanaged}
            onCheckedChange={handleSetPruneUnmanaged}
            data-testid="project-context-prune-unmanaged"
          />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Prune unmanaged on sync</p>
            <p className="text-xs text-muted-foreground">
              Remove files and MCP configs not managed by current project selections.
            </p>
          </div>
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleResetAndSync}
            disabled={syncingMode !== null}
            data-testid="project-context-reset-sync"
          >
            <RefreshCw className={cn('mr-1.5 size-3.5', syncingMode === 'reset' && 'animate-spin')} />
            Reset and sync
          </Button>
          <Button onClick={handleSyncAll} disabled={syncingMode !== null} data-testid="project-context-sync-all">
            <RefreshCw className={cn('mr-1.5 size-3.5', syncingMode === 'sync' && 'animate-spin')} />
            Sync All
          </Button>
        </div>
      </div>
    </div>
  )
}
