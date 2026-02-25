import { useRef, useEffect, useCallback, useState } from 'react'
import { RotateCw, X, Globe, Copy, Check } from 'lucide-react'
import { Button } from '@slayzone/ui'

interface WebviewElement extends HTMLElement {
  reload(): void
  stop(): void
  getURL(): string
  getWebContentsId(): number
}

interface WebPanelViewProps {
  panelId: string
  url: string
  name: string
  onUrlChange: (panelId: string, url: string) => void
  onFaviconChange?: (panelId: string, favicon: string) => void
  isResizing?: boolean
}

export function WebPanelView({
  panelId, url, name, onUrlChange, onFaviconChange, isResizing,
}: WebPanelViewProps) {
  const webviewRef = useRef<WebviewElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleNavigate = useCallback(() => {
    const wv = webviewRef.current
    if (!wv) return
    onUrlChange(panelId, wv.getURL())
  }, [panelId, onUrlChange])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onStartLoading = () => setIsLoading(true)
    const onStopLoading = () => setIsLoading(false)

    const onFavicon = (e: Event) => {
      const favicons = (e as CustomEvent).detail?.favicons as string[] | undefined
      if (favicons?.[0] && onFaviconChange) {
        onFaviconChange(panelId, favicons[0])
      }
    }

    const onNewWindow = (e: Event) => {
      const url = (e as CustomEvent).detail?.url ?? ''
      // Block external app protocol popups (figma://, slack://, etc.)
      // Allow http/https popups (e.g. OAuth windows) to open in system browser
      if (url.startsWith('http://') || url.startsWith('https://')) {
        window.api.shell.openExternal(url)
      }
    }

    const onFocus = () => wv.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

    wv.addEventListener('did-navigate', handleNavigate)
    wv.addEventListener('did-navigate-in-page', handleNavigate)
    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('did-stop-loading', onStopLoading)
    wv.addEventListener('page-favicon-updated', onFavicon)
    wv.addEventListener('new-window', onNewWindow)
    wv.addEventListener('focus', onFocus)

    return () => {
      wv.removeEventListener('did-navigate', handleNavigate)
      wv.removeEventListener('did-navigate-in-page', handleNavigate)
      wv.removeEventListener('did-start-loading', onStartLoading)
      wv.removeEventListener('did-stop-loading', onStopLoading)
      wv.removeEventListener('page-favicon-updated', onFavicon)
      wv.removeEventListener('new-window', onNewWindow)
      wv.removeEventListener('focus', onFocus)
    }
  }, [handleNavigate, panelId, onFaviconChange])

  return (
    <div className="flex flex-col h-full">
      {/* Header — h-10 matches Terminal/Browser/Editor tab bars */}
      <div className="shrink-0 flex items-center h-10 px-2 gap-1.5 border-b border-border">
        <Globe className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground flex-1">{name}</span>

        <Button
          variant="ghost"
          size="icon-sm"
          title="Copy URL"
          onClick={() => {
            const currentUrl = webviewRef.current?.getURL() ?? url
            navigator.clipboard.writeText(currentUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const wv = webviewRef.current
            if (!wv) return
            if (isLoading) wv.stop()
            else wv.reload()
          }}
        >
          {isLoading ? <X className="size-3.5" /> : <RotateCw className="size-3.5" />}
        </Button>
      </div>

      {/* Webview */}
      <div className="relative flex-1">
        <webview
          ref={webviewRef}
          src={url}
          partition="persist:web-panels"
          className="absolute inset-0"
          // @ts-expect-error - webview attributes not in React types
          allowpopups="true"
        />
        {isResizing && <div className="absolute inset-0 z-10" />}
      </div>
    </div>
  )
}
