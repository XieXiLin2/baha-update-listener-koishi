import { Headers, Response, type Dispatcher } from 'undici'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProxyHttpClient, type ProxyFetch } from '../src/proxy-http'

describe('isolated proxy HTTP client', () => {
  afterEach(() => vi.useRealTimers())

  it('uses the supplied dispatcher and decodes JSON responses', async () => {
    const dispatcher = createDispatcher()
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true }),
      { headers: { 'content-type': 'application/json' } },
    ))
    const client = new ProxyHttpClient(
      dispatcher,
      fetchMock as unknown as ProxyFetch,
    )

    await expect(client.get<{ ok: boolean }>('https://api.example/items', {
      params: { page: 2, enabled: true },
      headers: { Accept: 'application/json' },
    })).resolves.toEqual({ ok: true })

    const [target, init] = fetchMock.mock.calls[0]
    expect(String(target)).toBe('https://api.example/items?page=2&enabled=true')
    expect(init?.dispatcher).toBe(dispatcher)
    expect((init?.headers as Headers).get('accept')).toBe('application/json')
  })

  it('encodes POST data as JSON', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ token: 'ok' }),
      { headers: { 'content-type': 'application/json' } },
    ))
    const client = new ProxyHttpClient(
      createDispatcher(),
      fetchMock as unknown as ProxyFetch,
    )

    await client.post('https://api.example/login', { device: 'test' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init?.body).toBe('{"device":"test"}')
    expect((init?.headers as Headers).get('content-type')).toBe('application/json')
  })

  it('preserves HTTP status for diagnostics', async () => {
    const fetchMock = vi.fn(async () => new Response('unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    }))
    const client = new ProxyHttpClient(
      createDispatcher(),
      fetchMock as unknown as ProxyFetch,
    )

    await expect(client.get('https://api.example/items')).rejects.toMatchObject({
      message: 'Service Unavailable',
      response: { status: 503 },
    })
  })

  it('aborts requests after the configured timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_target, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const client = new ProxyHttpClient(
      createDispatcher(),
      fetchMock as unknown as ProxyFetch,
    )

    const request = client.get('https://api.example/slow', { timeout: 100 })
    const assertion = expect(request).rejects.toMatchObject({
      cause: { code: 'ETIMEDOUT' },
    })
    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })
})

function createDispatcher(): Dispatcher {
  return {
    dispatch: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as Dispatcher
}
