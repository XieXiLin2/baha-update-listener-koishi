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

    expect(createHttpClient(http, '')).toBe(http)
    expect(createHttpClient(http, 'https://proxy.example:8443')).toBe(proxied)
    expect((http as unknown as { extend: ReturnType<typeof vi.fn> }).extend)
      .toHaveBeenCalledWith({ proxyAgent: 'https://proxy.example:8443/' })
  })
})
