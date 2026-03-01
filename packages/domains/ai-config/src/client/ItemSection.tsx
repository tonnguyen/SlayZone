import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check, AlertCircle, ChevronDown, ChevronRight,
  Plus, Loader2, Sparkles, X
} from 'lucide-react'
import {
  Button, Checkbox, DiffView, Input, Label, Textarea,
  Tooltip, TooltipContent, TooltipTrigger, cn, toast
} from '@slayzone/ui'
import type {
  AiConfigItem, AiConfigItemType, CliProvider,
  ProjectSkillStatus, ProviderSyncStatus
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

function StatusBadge({ status }: { status: ProviderSyncStatus }) {
  if (status === 'synced') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
      <Check className="size-3" /> Synced
    </span>
  )
  if (status === 'out_of_sync') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
      <AlertCircle className="size-3" /> Stale
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      Not synced
    </span>
  )
}

// ---------------------------------------------------------------------------
// Expanded skill detail — mirrors ProjectInstructions layout
// ---------------------------------------------------------------------------

function SkillDetail({
  item,
  providers,
  enabledProviders,
  isLocal,
  projectId,
  projectPath,
  onChanged,
}: {
  item: AiConfigItem
  providers: ProjectSkillStatus['providers']
  enabledProviders: CliProvider[]
  isLocal: boolean
  projectId: string
  projectPath: string
  onChanged: () => void
}) {
  const [slug, setSlug] = useState(item.slug)
  const [content, setContent] = useState(item.content)
  const [slugDirty, setSlugDirty] = useState(false)
  const [savingSlug, setSavingSlug] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [expandedProviders, setExpandedProviders] = useState<Set<CliProvider>>(new Set())
  const [diskContents, setDiskContents] = useState<Partial<Record<CliProvider, string>>>({})
  const [expectedContents, setExpectedContents] = useState<Partial<Record<CliProvider, string>>>({})
  const [syncingProvider, setSyncingProvider] = useState<CliProvider | null>(null)
  const [pullingProvider, setPullingProvider] = useState<CliProvider | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  // Sync external item changes
  useEffect(() => {
    setContent(item.content)
    setSlug(item.slug)
    setSlugDirty(false)
  }, [item.content, item.slug])

  const providerRows = enabledProviders
    .filter(p => providerSupportsType(p))
    .map(p => {
      const info = providers[p]
      const path = info?.path ?? `${PROVIDER_PATHS[p]?.skillsDir}/${item.slug}/SKILL.md`
      const status = info?.status ?? 'not_synced'
      return { provider: p, path, status }
    })

  // Auto-save content to DB (debounced) — matches instructions pattern
  const saveContent = useCallback(async (text: string) => {
    try {
      await window.api.aiConfig.updateItem({ id: item.id, content: text })
      setExpectedContents({}) // clear cache — expected content depends on DB content
      onChanged()
    } catch {
      // silent
    }
  }, [item.id, onChanged])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveContent(text), 800)
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const handleSlugSave = async () => {
    setSavingSlug(true)
    try {
      await window.api.aiConfig.updateItem({ id: item.id, slug })
      setSlugDirty(false)
      setExpectedContents({})
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed')
    } finally {
      setSavingSlug(false)
    }
  }

  const handleRevert = async () => {
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id)
      toast.success(`Reverted ${item.slug} to global`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Revert failed')
    }
  }

  // --- Provider card helpers ---

  const loadDiskAndExpected = useCallback(async (provider: CliProvider) => {
    const [disk, expected] = await Promise.all([
      window.api.aiConfig.readProviderSkill(projectPath, provider, item.id),
      window.api.aiConfig.getExpectedSkillContent(projectPath, provider, item.id),
    ])
    setDiskContents(prev => ({ ...prev, [provider]: disk.exists ? disk.content : '' }))
    setExpectedContents(prev => ({ ...prev, [provider]: expected }))
  }, [projectPath, item.id])

  const toggleExpanded = (provider: CliProvider) => {
    setExpandedProviders(prev => {
      const next = new Set(prev)
      if (next.has(provider)) {
        next.delete(provider)
      } else {
        next.add(provider)
        void loadDiskAndExpected(provider)
      }
      return next
    })
  }

  const handlePush = async (provider: CliProvider) => {
    setSyncingProvider(provider)
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id, provider)
      const expected = expectedContents[provider]
      if (expected !== undefined) {
        setDiskContents(prev => ({ ...prev, [provider]: expected }))
      }
      onChanged()
    } finally {
      setSyncingProvider(null)
    }
  }

  const handlePull = async (provider: CliProvider) => {
    setPullingProvider(provider)
    try {
      await window.api.aiConfig.pullProviderSkill(projectId, projectPath, provider, item.id)
      onChanged()
    } finally {
      setPullingProvider(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      await window.api.aiConfig.syncLinkedFile(projectId, projectPath, item.id)
      const updated: Partial<Record<CliProvider, string>> = {}
      for (const { provider } of providerRows) {
        const expected = expectedContents[provider]
        if (expected !== undefined) updated[provider] = expected
      }
      setDiskContents(prev => ({ ...prev, ...updated }))
      onChanged()
    } finally {
      setSyncingAll(false)
    }
  }

  return (
    <div className="mt-1 space-y-4 rounded-lg border bg-muted/20 p-4">
      {/* Filename */}
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0">Filename</Label>
        <Input
          data-testid="skill-detail-filename"
          className="font-mono text-xs"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value)
            setSlugDirty(e.target.value !== item.slug)
          }}
        />
        {slugDirty && (
          <Button data-testid="skill-detail-rename" size="sm" onClick={handleSlugSave} disabled={savingSlug}>
            {savingSlug ? 'Renaming...' : 'Rename'}
          </Button>
        )}
      </div>

      {/* Content — auto-saves to DB like instructions */}
      <Textarea
        data-testid="skill-detail-content"
        className="min-h-[200px] resize-y font-mono text-sm"
        placeholder="Write your skill content here. Use the buttons below to write to provider files."
        value={content}
        onChange={handleContentChange}
      />

      {/* Source + revert */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Source: {isLocal ? 'Project only' : 'Global library'}
        </span>
        {!isLocal && (
          <Button data-testid="skill-detail-revert" size="sm" variant="outline" onClick={handleRevert}>
            Revert to global
          </Button>
        )}
      </div>

      {/* Provider file cards — identical layout to instructions */}
      {providerRows.length > 0 && (
        <>
          <div className="flex items-center justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button data-testid={`skill-push-all-${item.slug}`} size="sm" onClick={handleSyncAll} disabled={syncingAll || !!syncingProvider}>
                  {syncingAll && <Loader2 className="size-3.5 animate-spin" />}
                  Config → All Files
                </Button>
              </TooltipTrigger>
              <TooltipContent>Overwrite all provider skill files on disk with the current config content</TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-2">
            {providerRows.map(({ provider, path, status }) => {
              const isPushing = syncingProvider === provider
              const isPulling = pullingProvider === provider
              const isExpanded = expandedProviders.has(provider)
              const isStale = status === 'out_of_sync'
              const disk = diskContents[provider]
              const expected = expectedContents[provider]

              return (
                <div key={provider} data-testid={`skill-provider-card-${provider}-${item.slug}`} className="rounded-lg border">
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5',
                      isStale && 'cursor-pointer hover:bg-muted/30'
                    )}
                    onClick={isStale ? () => toggleExpanded(provider) : undefined}
                  >
                    {isStale && (
                      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !isExpanded && '-rotate-90')} />
                    )}
                    <span className="flex-1 font-mono text-sm">{path}</span>
                    <StatusBadge status={status} />
                    {isStale && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            data-testid={`skill-pull-${provider}-${item.slug}`}
                            size="sm"
                            variant="outline"
                            disabled={isPulling || syncingAll}
                            onClick={(e) => { e.stopPropagation(); void handlePull(provider) }}
                          >
                            {isPulling && <Loader2 className="size-3.5 animate-spin" />}
                            File → Config
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Replace config content with the current contents of {path} on disk</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          data-testid={`skill-push-${provider}-${item.slug}`}
                          size="sm"
                          variant={isStale ? 'default' : 'outline'}
                          disabled={isPushing || syncingAll}
                          onClick={(e) => { e.stopPropagation(); void handlePush(provider) }}
                        >
                          {isPushing && <Loader2 className="size-3.5 animate-spin" />}
                          Config → File
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Overwrite {path} on disk with the current config content</TooltipContent>
                    </Tooltip>
                  </div>

                  {isStale && isExpanded && (
                    disk === undefined || expected === undefined ? (
                      <div className="flex items-center justify-center border-t py-6">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <DiffView
                        left={disk}
                        right={expected}
                        leftLabel={`${path} (on disk)`}
                        rightLabel="Expected content"
                        className="border-t border-x-0 border-b-0 rounded-none"
                      />
                    )
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
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

  const label = 'Skills'
  const Icon = Sparkles
  const allItems = [
    ...localItems.map(item => ({ item, providers: {} as ProjectSkillStatus['providers'], isLocal: true })),
    ...linkedItems.map(s => ({ item: s.item, providers: s.providers, isLocal: false }))
  ]
  const existingLinks = linkedItems.map(s => s.item.id)

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
            <div className="w-[28px]" />
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
                      <StatusBadge status={status} />
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

                {isExpanded && (
                  <SkillDetail
                    key={item.id}
                    item={item}
                    providers={providers}
                    enabledProviders={enabledProviders}
                    isLocal={isLocal}
                    projectId={projectId}
                    projectPath={projectPath}
                    onChanged={onChanged}
                  />
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
