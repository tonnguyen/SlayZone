import { useState, type ChangeEvent } from 'react'
import {
  Check, AlertCircle, ChevronDown, ChevronRight,
  Plus, RefreshCw, Sparkles, X
} from 'lucide-react'
import { Button, Checkbox, Input, Label, Textarea, cn, toast } from '@slayzone/ui'
import type {
  AiConfigItem, AiConfigItemType, CliProvider,
  ProjectSkillStatus, ProviderSyncStatus, UpdateAiConfigItemInput
} from '../shared'
import { PROVIDER_LABELS, PROVIDER_PATHS } from '../shared/provider-registry'
import { AddItemPicker } from './AddItemPicker'

interface ItemSectionProps {
  type: AiConfigItemType
  linkedItems: ProjectSkillStatus[]
  localItems: AiConfigItem[]
  enabledProviders: CliProvider[]
  projectId: string
  projectPath: string
  onChanged: () => void
}

function providerSupportsType(provider: CliProvider): boolean {
  return !!PROVIDER_PATHS[provider]?.skillsDir
}

function aggregateStatus(
  providers: Partial<Record<CliProvider, { status: ProviderSyncStatus }>>
): ProviderSyncStatus {
  const statuses = Object.values(providers).map(p => p?.status).filter(Boolean) as ProviderSyncStatus[]
  if (statuses.length === 0) return 'not_synced'
  if (statuses.every(s => s === 'synced')) return 'synced'
  if (statuses.some(s => s === 'out_of_sync')) return 'out_of_sync'
  return 'not_synced'
}

function SyncBadge({ status }: { status: ProviderSyncStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
      status === 'synced' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      status === 'out_of_sync' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      status === 'not_synced' && 'bg-muted text-muted-foreground'
    )}>
      {status === 'synced' && <><Check className="size-2.5" /> synced</>}
      {status === 'out_of_sync' && <><AlertCircle className="size-2.5" /> stale</>}
      {status === 'not_synced' && 'not synced'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Per-provider file paths in expanded view
// ---------------------------------------------------------------------------

function ProviderFilePaths({
  providers,
  enabledProviders,
  slug,
}: {
  providers: Partial<Record<CliProvider, { path: string; status: ProviderSyncStatus }>>
  enabledProviders: CliProvider[]
  slug: string
}) {
  const rows = enabledProviders
    .filter(p => providerSupportsType(p))
    .map(p => {
      const info = providers[p]
      const path = info?.path ?? `${PROVIDER_PATHS[p]?.skillsDir}/${slug}/SKILL.md`
      const status = info?.status ?? 'not_synced'
      return { provider: p, path, status }
    })

  if (rows.length === 0) return null

  return (
    <div className="space-y-0.5">
      <span className="text-[11px] font-medium text-muted-foreground">Provider files</span>
      {rows.map(({ provider, path, status }) => (
        <div key={provider} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {status === 'synced' && <Check className="size-2.5 text-green-600 dark:text-green-400" />}
          {status === 'out_of_sync' && <AlertCircle className="size-2.5 text-amber-600 dark:text-amber-400" />}
          {status === 'not_synced' && <span className="size-2.5 rounded-full border border-dashed border-muted-foreground" />}
          <span className="font-mono">{path}</span>
          <span className="text-muted-foreground/60">({PROVIDER_LABELS[provider]?.split(' ')[0]})</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline editor for expanded row
// ---------------------------------------------------------------------------

function InlineEditor({
  item,
  isLocal,
  onSave,
  onRevert
}: {
  item: AiConfigItem
  isLocal: boolean
  onSave: (patch: Omit<UpdateAiConfigItemInput, 'id'>) => Promise<void>
  onRevert?: () => Promise<void>
}) {
  const [slug, setSlug] = useState(item.slug)
  const [content, setContent] = useState(item.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave({ slug, content })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-1 space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-1">
        <Label className="text-xs">Filename</Label>
        <Input
          className="font-mono text-xs"
          value={slug}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setSlug(e.target.value)
            setError(null)
          }}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Content</Label>
        <Textarea
          className="min-h-36 font-mono text-xs"
          value={content}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value)
            setError(null)
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Source: {isLocal ? 'Project only' : 'Global library'}
        </span>
        <div className="flex items-center gap-2">
          {!isLocal && onRevert && (
            <Button size="sm" variant="outline" onClick={onRevert} disabled={saving}>
              Revert to global
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function ItemSection({
  type, linkedItems, localItems, enabledProviders,
  projectId, projectPath, onChanged
}: ItemSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const label = 'Skills'
  const Icon = Sparkles
  const allItems = [
    ...localItems.map(item => ({ item, providers: {} as ProjectSkillStatus['providers'], isLocal: true })),
    ...linkedItems.map(s => ({ item: s.item, providers: s.providers, isLocal: false }))
  ]
  const existingLinks = linkedItems.map(s => s.item.id)

  const handleSync = async (item: AiConfigItem) => {
    setSyncingId(item.id)
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id)
      toast.success(`Synced ${item.slug}`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleRemoveLinked = async (itemId: string) => {
    await window.api.aiConfig.removeProjectSelection(projectId, itemId)
    if (expandedId === itemId) setExpandedId(null)
    onChanged()
  }

  const handleRemoveLocal = async (itemId: string) => {
    await window.api.aiConfig.deleteItem(itemId)
    if (expandedId === itemId) setExpandedId(null)
    onChanged()
  }

  const handleUpdateItem = async (itemId: string, patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    await window.api.aiConfig.updateItem({ id: itemId, ...patch })
    onChanged()
  }

  const handleRevert = async (item: AiConfigItem) => {
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id)
      toast.success(`Reverted ${item.slug} to global`)
      onChanged()
      setExpandedId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revert failed')
    }
  }

  const handleToggleProvider = async (itemId: string, provider: CliProvider, currentlyActive: boolean) => {
    if (currentlyActive) {
      await window.api.aiConfig.removeProjectSelection(projectId, itemId, provider)
    } else {
      await window.api.aiConfig.loadGlobalItem({
        projectId, projectPath, itemId, providers: [provider]
      })
    }
    onChanged()
  }

  return (
    <div>
      {/* Header — mirrors row layout for column alignment */}
      <div className="flex items-center gap-2 px-3 mb-2">
        <Icon className="size-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-sm font-medium">
          {label}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{allItems.length}</span>
        </span>
        {allItems.length > 0 && (
          <div className="flex items-center gap-0.5">
            <div className="w-[70px]" />
            {enabledProviders.map(p => (
              <span key={p} className="w-16 text-center text-[10px] text-muted-foreground">
                {PROVIDER_LABELS[p]?.split(' ')[0]}
              </span>
            ))}
            <div className="w-[52px]" />
          </div>
        )}
      </div>

      {/* Items */}
      {allItems.length > 0 && (
        <div className="space-y-1">
          {allItems.map(({ item, providers, isLocal }) => {
            const isExpanded = expandedId === item.id
            const status = isLocal ? 'not_synced' as ProviderSyncStatus : aggregateStatus(providers)
            return (
              <div key={item.id}>
                <div
                  data-testid={`project-context-item-${type}-${item.slug}`}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors cursor-pointer',
                    isExpanded ? 'bg-muted/50 border-primary/30' : 'hover:bg-muted/30'
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  {isExpanded
                    ? <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  }
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {item.slug}
                    {isLocal && (
                      <span className="ml-1.5 font-sans text-[10px] text-muted-foreground">(local)</span>
                    )}
                  </span>

                  <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    <div className="w-[70px] flex justify-end">
                      <SyncBadge status={status} />
                    </div>
                    {enabledProviders.map(p => {
                      if (!providerSupportsType(p)) {
                        return <span key={p} className="w-16" />
                      }
                      if (isLocal) {
                        return (
                          <span
                            key={p}
                            className="w-16 flex justify-center"
                            title="Project-local items are synced to all enabled providers."
                          >
                            <Checkbox checked disabled />
                          </span>
                        )
                      }
                      const active = !!providers[p]
                      return (
                        <span key={p} className="w-16 flex justify-center">
                          <Checkbox
                            checked={active}
                            onCheckedChange={() => handleToggleProvider(item.id, p, active)}
                          />
                        </span>
                      )
                    })}
                    <div className="flex items-center gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="size-6"
                        onClick={() => { void handleSync(item) }}
                        disabled={syncingId === item.id}
                        title="Sync"
                        data-testid={`project-context-sync-${type}-${item.slug}`}
                      >
                        <RefreshCw className={cn('size-3', syncingId === item.id && 'animate-spin')} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => isLocal ? handleRemoveLocal(item.id) : handleRemoveLinked(item.id)}
                        title="Remove"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <>
                    <InlineEditor
                      key={item.id}
                      item={item}
                      isLocal={isLocal}
                      onSave={patch => handleUpdateItem(item.id, patch)}
                      onRevert={!isLocal ? () => handleRevert(item) : undefined}
                    />
                    <div className="mt-1 rounded-lg border bg-muted/20 px-4 py-2">
                      <ProviderFilePaths
                        providers={providers}
                        enabledProviders={enabledProviders}
                        slug={item.slug}
                      />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Subtle add row */}
      <div
        data-testid={`project-context-add-${type}`}
        className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 cursor-pointer text-muted-foreground transition-colors hover:bg-muted/15 hover:text-foreground mt-1"
        onClick={() => setShowPicker(true)}
      >
        <Plus className="size-3 shrink-0" />
        <span className="text-xs">Add skill</span>
      </div>

      <AddItemPicker
        open={showPicker}
        onOpenChange={setShowPicker}
        type={type}
        projectId={projectId}
        projectPath={projectPath}
        enabledProviders={enabledProviders}
        existingLinks={existingLinks}
        onAdded={() => { setShowPicker(false); onChanged() }}
      />
    </div>
  )
}
