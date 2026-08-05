import type { Context, Logger } from 'koishi'

import { describeProxy } from './request-diagnostics'

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
  logger?: Logger,
  verbose = false,
): Context['http'] {
  const normalized = normalizeProxyUrl(proxyUrl)
  if (!normalized) {
    if (verbose) logger?.info('[proxy] mode=direct')
    return ctx.http
  }

  const autoLoaded = assertProxySupport(ctx, normalized)
  logger?.info(
    '[proxy] mode=enabled endpoint=%s provider=%s',
    describeProxy(normalized),
    autoLoaded ? 'auto-loaded' : 'existing',
  )
  return (ctx.http as unknown as ProxyCapableHttp).extend({ proxyAgent: normalized })
}

export function assertProxySupport(ctx: Context, proxyUrl: string): boolean {
  let dispatcher = resolveProxyDispatcher(ctx, proxyUrl)
  let autoLoaded = false
  if (!dispatcher) {
    ctx.plugin(require('@koishijs/plugin-proxy-agent'), { proxyAgent: '' })
    autoLoaded = true
    dispatcher = resolveProxyDispatcher(ctx, proxyUrl)
  }
  if (!dispatcher) {
    throw new Error('無法啟用 Koishi 代理支援，已停止外部請求以避免繞過代理。')
  }
  void dispatcher.close()
  return autoLoaded
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
