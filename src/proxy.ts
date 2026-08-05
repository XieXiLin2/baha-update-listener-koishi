import type { Context, Logger } from 'koishi'
import type { Dispatcher } from 'undici'

import { ProxyHttpClient } from './proxy-http'
import { describeProxy } from './request-diagnostics'

const SUPPORTED_PROXY_PROTOCOLS = new Set([
  'http:',
  'https:',
  'socks5:',
  'socks5h:',
])

interface ProxyDispatcher {
  dispatch: Dispatcher['dispatch']
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

  const { autoLoaded, dispatcher } = resolveProxySupport(ctx, normalized)
  ctx.on('dispose', () => dispatcher.close())
  logger?.info(
    '[proxy] mode=enabled endpoint=%s provider=%s transport=undici@%s node=%s node-undici=%s',
    describeProxy(normalized),
    autoLoaded ? 'auto-loaded' : 'existing',
    packageUndiciVersion(),
    process.version,
    nodeUndiciVersion(),
  )
  return new ProxyHttpClient(dispatcher as Dispatcher) as unknown as Context['http']
}

export function assertProxySupport(ctx: Context, proxyUrl: string): boolean {
  const { autoLoaded, dispatcher } = resolveProxySupport(ctx, proxyUrl)
  void dispatcher.close()
  return autoLoaded
}

function resolveProxySupport(
  ctx: Context,
  proxyUrl: string,
): { autoLoaded: boolean, dispatcher: ProxyDispatcher } {
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
  return { autoLoaded, dispatcher }
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

function packageUndiciVersion(): string {
  try {
    return String(require('undici/package.json').version)
  } catch {
    return 'unknown'
  }
}

function nodeUndiciVersion(): string {
  return (process.versions as Record<string, string | undefined>).undici ?? 'unknown'
}
