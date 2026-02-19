/**
 * Injected into every page loaded in webview sessions (persist:browser-tabs, persist:web-panels).
 * Blocks navigation to external protocol URLs (figma://, slack://, etc.) that would otherwise
 * launch desktop apps. Runs before any page JS so Figma's launch logic is pre-empted.
 */

const isExternal = (url: unknown): boolean => {
  if (typeof url !== 'string') return false
  return (
    !url.startsWith('http://') &&
    !url.startsWith('https://') &&
    !url.startsWith('//') &&
    !url.startsWith('about:') &&
    !url.startsWith('#') &&
    !url.startsWith('blob:') &&
    !url.startsWith('data:') &&
    url.includes('://')
  )
}

// Block window.open('figma://...')
const origOpen = window.open.bind(window)
window.open = (url?: string | URL, target?: string, features?: string) => {
  if (isExternal(url instanceof URL ? url.href : url)) return null
  return origOpen(url as string, target, features)
}

// Block window.location.href = 'figma://...' and window.location.assign/replace
const origHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
if (origHref?.set) {
  Object.defineProperty(Location.prototype, 'href', {
    ...origHref,
    set(url: string) {
      if (!isExternal(url)) origHref.set!.call(this, url)
    },
  })
}

const origAssign = Location.prototype.assign
Location.prototype.assign = function (url: string) {
  if (!isExternal(url)) origAssign.call(this, url)
}

const origReplace = Location.prototype.replace
Location.prototype.replace = function (url: string) {
  if (!isExternal(url)) origReplace.call(this, url)
}

// Block <iframe src="figma://..."> — the most common technique for custom protocol launches
const origIframeSrc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src')
if (origIframeSrc?.set) {
  Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
    ...origIframeSrc,
    set(url: string) {
      if (!isExternal(url)) origIframeSrc.set!.call(this, url)
    },
  })
}

// Also cover iframe.setAttribute('src', 'figma://...')
const origSetAttribute = Element.prototype.setAttribute
Element.prototype.setAttribute = function (name: string, value: string) {
  if (this instanceof HTMLIFrameElement && name === 'src' && isExternal(value)) return
  origSetAttribute.call(this, name, value)
}
