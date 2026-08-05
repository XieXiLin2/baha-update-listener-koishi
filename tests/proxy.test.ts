import type { Context } from 'koishi'
import { describe, expect, it, vi } from 'vitest'

import { createHttpClient, normalizeProxyUrl } from '../src/proxy'

describe('proxy configuration', () => {
  it('accepts HTTP and SOCKS5 proxy URLs', () => {
    expect(normalizeProxyUrl(' http://127.0.0.1:7890 '))
      .toBe('http://127.0.0.1:7890/')
    expect(normalizeProxyUrl('socks5://user:pass@proxy.example:1080'))
      .toBe('socks5://user:pass@proxy.example:1080')
    expect(normalizeProxyUrl('socks5h://proxy.example'))
      .toBe('socks5h://proxy.example')
  })

  it('rejects unsupported or malformed proxy URLs', () => {
    expect(() => normalizeProxyUrl('ftp://proxy.example')).toThrow('代理僅支援')
    expect(() => normalizeProxyUrl('not-a-url')).toThrow('代理伺服器網址無效')
  })

  it('extends the Koishi HTTP client only when a proxy is configured', () => {
    const proxied = { get: vi.fn() } as unknown as Context['http']
    const http = {
      extend: vi.fn(() => proxied),
    } as unknown as Context['http']
    const dispatcher = { close: vi.fn().mockResolvedValue(undefined) }
    const ctx = {
      http,
      bail: vi.fn(() => dispatcher),
    } as unknown as Context

    expect(createHttpClient(ctx, '')).toBe(http)
    expect(createHttpClient(ctx, 'https://proxy.example:8443')).toBe(proxied)
    expect((http as unknown as { extend: ReturnType<typeof vi.fn> }).extend)
      .toHaveBeenCalledWith({ proxyAgent: 'https://proxy.example:8443/' })
    expect(dispatcher.close).toHaveBeenCalledOnce()
  })

  it('fails closed when Koishi proxy support is unavailable', () => {
    const ctx = {
      http: { extend: vi.fn() },
      bail: vi.fn(),
      plugin: vi.fn(),
    } as unknown as Context

    expect(() => createHttpClient(ctx, 'http://127.0.0.1:7890'))
      .toThrow('已停止外部請求以避免繞過代理')
    expect((ctx.http as unknown as { extend: ReturnType<typeof vi.fn> }).extend)
      .not.toHaveBeenCalled()
  })

  it('enables Koishi proxy support when it is not already active', () => {
    const dispatcher = { close: vi.fn().mockResolvedValue(undefined) }
    let enabled = false
    const proxied = { get: vi.fn() } as unknown as Context['http']
    const http = { extend: vi.fn(() => proxied) } as unknown as Context['http']
    const ctx = {
      http,
      bail: vi.fn(() => enabled ? dispatcher : undefined),
      plugin: vi.fn(() => {
        enabled = true
      }),
    } as unknown as Context

    expect(createHttpClient(ctx, 'socks5://127.0.0.1:1080')).toBe(proxied)
    expect((ctx as unknown as { plugin: ReturnType<typeof vi.fn> }).plugin)
      .toHaveBeenCalledOnce()
    expect(dispatcher.close).toHaveBeenCalledOnce()
  })
})
