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

interface ProxyDispatcher {
  close(): Promise<void>
}

interface ProxyAwareContext {
  bail(
    event: 'http/dispatcher',
    proxyUrl: URL,
    requestUrl: URL,
  ): ProxyDispatcher | undefined
}

export function createHttpClient(
  ctx: Context,
  proxyUrl: string,
): Context['http'] {
  const normalized = normalizeProxyUrl(proxyUrl)
  if (!normalized) return ctx.http

  assertProxySupport(ctx, normalized)
  return (ctx.http as unknown as ProxyCapableHttp).extend({ proxyAgent: normalized })
}

export function assertProxySupport(ctx: Context, proxyUrl: string): void {
  let dispatcher = resolveProxyDispatcher(ctx, proxyUrl)
  if (!dispatcher) {
    ctx.plugin(require('@koishijs/plugin-proxy-agent'), { proxyAgent: '' })
    dispatcher = resolveProxyDispatcher(ctx, proxyUrl)
  }
  if (!dispatcher) {
    throw new Error('無法啟用 Koishi 代理支援，已停止外部請求以避免繞過代理。')
  }
  void dispatcher.close()
}

function resolveProxyDispatcher(
  ctx: Context,
  proxyUrl: string,
): ProxyDispatcher | undefined {
  return (ctx as unknown as ProxyAwareContext).bail(
    'http/dispatcher',
    new URL(proxyUrl),
    new URL('https://example.com/'),
  )
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
