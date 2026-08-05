import type { Context } from 'koishi'

const SUPPORTED_PROXY_PROTOCOLS = new Set([
  'http:',
  'https:',
  'socks5:',
  'socks5h:',
])

interface ProxyCapableHttp {
  extend(config: { proxyAgent: string }): Context['http']
}

export function createHttpClient(
  http: Context['http'],
  proxyUrl: string,
): Context['http'] {
  const normalized = normalizeProxyUrl(proxyUrl)
  if (!normalized) return http
  return (http as unknown as ProxyCapableHttp).extend({ proxyAgent: normalized })
}

export function normalizeProxyUrl(value: string): string {
  const raw = value.trim()
  if (!raw) return ''

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new TypeError('代理伺服器網址無效。')
  }

  if (!SUPPORTED_PROXY_PROTOCOLS.has(url.protocol)) {
    throw new TypeError('代理僅支援 http、https、socks5 或 socks5h 協定。')
  }
  if (!url.hostname) throw new TypeError('代理伺服器網址缺少主機名稱。')
  return url.href
}
