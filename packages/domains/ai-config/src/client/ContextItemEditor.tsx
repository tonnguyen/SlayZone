import { useState, type ChangeEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, Input, Label, Textarea } from '@slayzone/ui'
import type { AiConfigItem, UpdateAiConfigItemInput } from '../shared'

interface ContextItemEditorProps {
  item: AiConfigItem
  onUpdate: (patch: Omit<UpdateAiConfigItemInput, 'id'>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

export function ContextItemEditor({ item, onUpdate, onDelete, onClose }: ContextItemEditorProps) {
  const [slug, setSlug] = useState(item.slug)
  const [content, setContent] = useState(item.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (patch: Omit<UpdateAiConfigItemInput, 'id'>) => {
    setSaving(true)
    setError(null)
    try {
      await onUpdate(patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-1">
        <Label className="text-xs">Filename</Label>
        <Input
          data-testid="context-item-editor-slug"
          className="font-mono text-sm"
          value={slug}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setSlug(e.target.value)
            setError(null)
          }}
          onBlur={() => save({ slug })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Content</Label>
        <Textarea
          data-testid="context-item-editor-content"
          className="min-h-48 font-mono text-sm"
          value={content}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value)
            setError(null)
          }}
          onBlur={() => save({ content })}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onClose} data-testid="context-item-editor-close">
          Close
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {saving ? 'Saving...' : 'Autosave on blur'}
          </span>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1 size-3" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
