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

  it('uses an isolated proxy client and closes its dispatcher on disposal', async () => {
    const http = { get: vi.fn() } as unknown as Context['http']
    const dispatcher = {
      dispatch: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    }
    let dispose: (() => Promise<void>) | undefined
    const ctx = {
      http,
      bail: vi.fn(() => dispatcher),
      on: vi.fn((event: string, callback: () => Promise<void>) => {
        if (event === 'dispose') dispose = callback
      }),
    } as unknown as Context

    expect(createHttpClient(ctx, '')).toBe(http)
    const proxied = createHttpClient(ctx, 'https://proxy.example:8443')
    expect(proxied).not.toBe(http)
    expect(typeof proxied.get).toBe('function')
    expect(typeof proxied.post).toBe('function')
    expect(dispatcher.close).not.toHaveBeenCalled()

    await dispose?.()
    expect(dispatcher.close).toHaveBeenCalledOnce()
  })

  it('fails closed when Koishi proxy support is unavailable', () => {
    const ctx = {
      http: { get: vi.fn() },
      bail: vi.fn(),
      plugin: vi.fn(),
    } as unknown as Context

    expect(() => createHttpClient(ctx, 'http://127.0.0.1:7890'))
      .toThrow('已停止外部請求以避免繞過代理')
  })

  it('enables Koishi proxy support when it is not already active', () => {
    const dispatcher = { close: vi.fn().mockResolvedValue(undefined) }
    let enabled = false
    const http = { get: vi.fn() } as unknown as Context['http']
    const ctx = {
      http,
      bail: vi.fn(() => enabled ? dispatcher : undefined),
      plugin: vi.fn(() => {
        enabled = true
      }),
      on: vi.fn(),
    } as unknown as Context

    expect(createHttpClient(ctx, 'socks5://127.0.0.1:1080')).not.toBe(http)
    expect((ctx as unknown as { plugin: ReturnType<typeof vi.fn> }).plugin)
      .toHaveBeenCalledOnce()
    expect(dispatcher.close).not.toHaveBeenCalled()
  })
})
