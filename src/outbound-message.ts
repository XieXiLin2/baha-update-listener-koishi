import type { h } from 'koishi'

export interface PlainTextOptions {
  keepUrls?: boolean
}

export function formatOutboundMessage(
  content: h.Fragment,
  platform: string,
  plainTextPlatforms: string[],
  options: PlainTextOptions = {},
): h.Fragment {
  if (!usesPlainText(platform, plainTextPlatforms)) return content
  return renderPlainText(content, options)
}

export function usesPlainText(platform: string, plainTextPlatforms: string[]): boolean {
  const normalized = platform.trim().toLowerCase()
  return !!normalized && plainTextPlatforms.some((item) => item.trim().toLowerCase() === normalized)
}

export function renderPlainText(
  content: h.Fragment,
  options: PlainTextOptions = {},
): string {
  const keepUrls = options.keepUrls === true
  return renderNode(content, keepUrls)
    .replace(/\r\n?/g, '\n')
    .trim()
}

function renderNode(node: unknown, keepUrls: boolean): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((item) => renderNode(item, keepUrls)).join('')
  if (!node || typeof node !== 'object') return ''

  const element = node as {
    type?: unknown
    attrs?: Record<string, unknown>
    children?: unknown
  }
  const type = typeof element.type === 'string' ? element.type : ''
  const attrs = element.attrs ?? {}
  if (type === 'text') return String(attrs.content ?? '')
  if (type === 'br') return '\n'

  const text = renderNode(element.children, keepUrls)
  if (type !== 'a' || !keepUrls) return text

  const href = typeof attrs.href === 'string' ? attrs.href.trim() : ''
  if (!href || text.includes(href)) return text
  return text ? `${text} (${href})` : href
}
