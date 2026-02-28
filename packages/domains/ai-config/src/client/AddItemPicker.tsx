import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, cn } from '@slayzone/ui'
import type { AiConfigItem, AiConfigItemType, CliProvider } from '../shared'
import { PROVIDER_PATHS } from '../shared/provider-registry'

interface AddItemPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: AiConfigItemType
  projectId: string
  projectPath: string
  enabledProviders: CliProvider[]
  existingLinks: string[]
  onAdded: () => void
}

function providerSupportsType(provider: CliProvider): boolean {
  return !!PROVIDER_PATHS[provider]?.skillsDir
}

function nextAvailableSlug(base: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(base)) return base
  let index = 2
  while (existingSlugs.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

export function AddItemPicker({
  open, onOpenChange, type, projectId, projectPath,
  enabledProviders, existingLinks, onAdded
}: AddItemPickerProps) {
  const [globalItems, setGlobalItems] = useState<AiConfigItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    void (async () => {
      const items = await window.api.aiConfig.listItems({ scope: 'global', type })
      setGlobalItems(items)
    })()
  }, [open, type])

  const filtered = useMemo(() => {
    if (!search) return globalItems
    const q = search.toLowerCase()
    return globalItems.filter(i => i.slug.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
  }, [globalItems, search])

  const compatibleProviders = useMemo(
    () => enabledProviders.filter((provider) => providerSupportsType(provider)),
    [enabledProviders]
  )
  const canLinkFromLibrary = compatibleProviders.length > 0

  const handleSelectGlobal = async (item: AiConfigItem) => {
    if (!canLinkFromLibrary) return
    if (existingLinks.includes(item.id)) return
    setLoading(true)
    try {
      await window.api.aiConfig.loadGlobalItem({
        projectId,
        projectPath,
        itemId: item.id,
        providers: compatibleProviders
      })
      onAdded()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLocal = async () => {
    setLoading(true)
    try {
      const existingItems = await window.api.aiConfig.listItems({
        scope: 'project',
        projectId,
        type
      })
      const existingSlugs = new Set(existingItems.map((item) => item.slug))
      const slug = nextAvailableSlug('new-skill', existingSlugs)
      const defaultContent = '---\ndescription: \ntrigger: auto\n---\n\n'
      await window.api.aiConfig.createItem({
        type,
        scope: 'project',
        projectId,
        slug,
        content: defaultContent
      })
      onAdded()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const label = 'Skill'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!canLinkFromLibrary && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
              No enabled providers support skills yet.
              Enable a compatible provider first to link from the global library.
            </p>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="add-item-picker-search"
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search global library..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border p-1">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                {search ? 'No matches' : `No global ${type}s yet`}
              </p>
            ) : (
              <>
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  From Library
                </p>
                {filtered.map(item => {
                  const linked = existingLinks.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      disabled={linked || loading || !canLinkFromLibrary}
                      onClick={() => handleSelectGlobal(item)}
                      data-testid={`add-item-option-${item.slug}`}
                      className={cn(
                        'flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors',
                        linked
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.slug}</span>
                      {linked && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">Linked</span>
                      )}
                    </button>
                  )
                })}
              </>
            )}
          </div>

          <div className="border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleCreateLocal}
              disabled={loading}
            >
              <Plus className="mr-1 size-3" />
              Create project {type}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
