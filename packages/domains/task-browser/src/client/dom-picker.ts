export interface PickedDomPayload {
  url: string
  tagName: string
  textSample: string
  selectorCandidates: string[]
  note?: string
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input
  return `${input.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`
}

function quoteForSnippet(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function buildDomElementSnippet(payload: PickedDomPayload): string {
  const selector = (payload.selectorCandidates[0] ?? payload.tagName) || '<unknown>'
  const safeSelector = normalizeWhitespace(selector)
  const safeUrl = normalizeWhitespace(payload.url || 'about:blank')
  const safeText = truncate(normalizeWhitespace(payload.textSample || ''), 120)

  const textPart = safeText ? ` (text="${quoteForSnippet(safeText)}")` : ''
  const notePart = payload.note ? ` [${normalizeWhitespace(payload.note)}]` : ''
  return `Element target: ${safeSelector}${textPart} on ${safeUrl}${notePart}`
}
