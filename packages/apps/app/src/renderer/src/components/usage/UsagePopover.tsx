import { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, RefreshCw } from 'lucide-react'
import {
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@slayzone/ui'
import type { ProviderUsage, UsageWindow } from '@slayzone/terminal/shared'

type UsageWindowKey = 'fiveHour' | 'sevenDay' | 'sevenDayOpus' | 'sevenDaySonnet'
type PinnedBars = Record<string, UsageWindowKey[]>

const WINDOW_LABELS: Record<UsageWindowKey, string> = {
  fiveHour: '5h',
  sevenDay: '7d',
  sevenDayOpus: 'Opus',
  sevenDaySonnet: 'Son.',
}

interface UsagePopoverProps {
  data: ProviderUsage[]
  onRefresh: () => void
}

function barColor(pct: number) {
  if (pct >= 85) return 'bg-red-500'
  if (pct >= 60) return 'bg-yellow-500'
  return 'bg-green-500'
}

function peakUtilization(p: ProviderUsage): number {
  return Math.max(p.fiveHour?.utilization ?? 0, p.sevenDay?.utilization ?? 0)
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h`
}

function formatReset(iso: string): string {
  return formatDuration(new Date(iso).getTime() - Date.now())
}

function formatAgo(epochMs: number): string {
  return formatDuration(Date.now() - epochMs)
}

function InlineBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor(pct))}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

function WindowRow({
  label,
  w,
  pinned,
  onTogglePin,
}: {
  label: string
  w: UsageWindow
  pinned?: boolean
  onTogglePin?: () => void
}) {
  const reset = formatReset(w.resetsAt)
  return (
    <div className="flex items-center gap-2">
      {onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin()
          }}
          className={cn(
            'shrink-0 transition-colors',
            pinned ? 'text-foreground' : 'text-muted-foreground/30 hover:text-muted-foreground/60',
          )}
        >
          <Circle className={cn('size-2.5', pinned && 'fill-current')} />
        </button>
      )}
      <span className="text-xs text-muted-foreground w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor(w.utilization))}
          style={{ width: `${Math.min(w.utilization, 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{Math.round(w.utilization)}%</span>
      <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">
        {reset}
      </span>
    </div>
  )
}

function ProviderSection({
  usage,
  pinned,
  onTogglePin,
}: {
  usage: ProviderUsage
  pinned: UsageWindowKey[]
  onTogglePin: (key: UsageWindowKey) => void
}) {
  if (usage.error) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium">{usage.label}</div>
        <div className="text-xs text-muted-foreground">{usage.error}</div>
      </div>
    )
  }

  const rows: { key: UsageWindowKey; label: string; w: UsageWindow }[] = []
  if (usage.fiveHour) rows.push({ key: 'fiveHour', label: '5h', w: usage.fiveHour })
  if (usage.sevenDay) rows.push({ key: 'sevenDay', label: '7d', w: usage.sevenDay })
  if (usage.sevenDayOpus) rows.push({ key: 'sevenDayOpus', label: 'Opus', w: usage.sevenDayOpus })
  if (usage.sevenDaySonnet) rows.push({ key: 'sevenDaySonnet', label: 'Son.', w: usage.sevenDaySonnet })

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium flex-1">{usage.label}</span>
        <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">Resets in</span>
      </div>
      {rows.map((r) => (
        <WindowRow
          key={r.key}
          label={r.label}
          w={r.w}
          pinned={pinned.includes(r.key)}
          onTogglePin={() => onTogglePin(r.key)}
        />
      ))}
    </div>
  )
}

export function UsagePopover({ data, onRefresh }: UsagePopoverProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [pinned, setPinned] = useState<PinnedBars | null>(null)

  useEffect(() => {
    window.api.settings.get('usage_pinned_bars').then((raw) => {
      if (raw) {
        try {
          setPinned(JSON.parse(raw))
        } catch {
          /* ignore corrupt */
        }
      }
    })
  }, [])

  const togglePin = useCallback((provider: string, windowKey: UsageWindowKey) => {
    setPinned((prev) => {
      const next = { ...prev }
      const arr = [...(next[provider] ?? [])]
      const idx = arr.indexOf(windowKey)
      if (idx >= 0) {
        arr.splice(idx, 1)
        if (arr.length === 0) delete next[provider]
        else next[provider] = arr
      } else {
        next[provider] = [...arr, windowKey]
      }
      const hasAny = Object.keys(next).length > 0
      window.api.settings.set('usage_pinned_bars', hasAny ? JSON.stringify(next) : '')
      return hasAny ? next : null
    })
  }, [])

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 200)
  }

  const withData = data.filter((p) => !p.error && (p.fiveHour || p.sevenDay))

  const inlineBars: { label: string; pct: number }[] =
    pinned && Object.keys(pinned).length > 0
      ? data.flatMap((p) => {
          const keys = pinned[p.provider]
          if (!keys) return []
          return keys
            .map((k) => {
              const w = p[k]
              return w ? { label: `${p.label} ${WINDOW_LABELS[k]}`, pct: w.utilization } : null
            })
            .filter(Boolean) as { label: string; pct: number }[]
        })
      : withData
          .map((p) => ({ label: p.label, pct: peakUtilization(p) }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 2)

  if (data.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 h-7 px-1 transition-colors text-muted-foreground hover:text-foreground"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {inlineBars.length > 0 ? (
            inlineBars.map((b) => <InlineBar key={b.label} pct={b.pct} label={b.label} />)
          ) : (
            <span className="text-[10px]">Usage</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-72 p-3 space-y-3"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {data.map((p) => (
          <ProviderSection
            key={p.provider}
            usage={p}
            pinned={pinned?.[p.provider] ?? []}
            onTogglePin={(key) => togglePin(p.provider, key)}
          />
        ))}
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-[10px] text-muted-foreground">
            {data[0]?.fetchedAt
              ? `Updated ${formatAgo(data[0].fetchedAt)} ago`
              : ''}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRefresh()
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
