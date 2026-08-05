import type { Logger } from 'koishi'
import { describe, expect, it, vi } from 'vitest'

import { describeProxy, RequestDiagnostics } from '../src/request-diagnostics'

describe('request diagnostics', () => {
  it('logs a safe request target and payload summary', async () => {
    const logger = createLogger()
    const diagnostics = new RequestDiagnostics(
      logger as unknown as Logger,
      'http://proxy-user:proxy-password@proxy.example:8080/path',
      true,
    )

    await expect(diagnostics.run(
      'CR',
      'GET',
      'https://service.example/feed?token=secret',
      async () => '<rss>content</rss>',
    )).resolves.toBe('<rss>content</rss>')

    const output = loggedValues(logger).join(' ')
    expect(output).toContain('[request:%d] start')
    expect(output).toContain('service.example/feed')
    expect(output).toContain('http://proxy.example:8080')
    expect(output).toContain('text:18B')
    expect(output).not.toContain('proxy-user')
    expect(output).not.toContain('proxy-password')
    expect(output).not.toContain('token=secret')
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('redacts sensitive values from errors and rethrows the original error', async () => {
    const logger = createLogger()
    const diagnostics = new RequestDiagnostics(
      logger as unknown as Logger,
      'socks5://proxy.example:1080',
      true,
    )
    const error = Object.assign(
      new Error('fetch https://api.example/items?access_token=secret failed Cookie: session-secret'),
      {
        response: { status: 502 },
        cause: Object.assign(
          new Error('proxy https://user:pass@proxy.example:1080/?key=secret failed'),
          {
            cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1080'), {
              code: 'ECONNREFUSED',
            }),
          },
        ),
      },
    )

    await expect(diagnostics.run(
      'ABEMA',
      'GET',
      'https://api.example/items?access_token=secret',
      async () => { throw error },
    )).rejects.toBe(error)

    const output = loggedValues(logger).join(' ')
    expect(output).toContain('502')
    expect(output).toContain('ECONNREFUSED')
    expect(output).toContain('https://api.example/items')
    expect(output).toContain('https://proxy.example:1080/')
    expect(output).toContain('Cookie=[redacted]')
    expect(output).not.toContain('access_token=secret')
    expect(output).not.toContain('session-secret')
    expect(output).not.toContain('user:pass')
    expect(output).not.toContain('key=secret')
  })

  it('does not log when diagnostics are disabled', async () => {
    const logger = createLogger()
    const diagnostics = new RequestDiagnostics(
      logger as unknown as Logger,
      '',
      false,
    )

    await expect(diagnostics.run('Baha', 'GET', 'https://example.com', async () => 1))
      .resolves.toBe(1)
    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('removes credentials and paths from proxy descriptions', () => {
    expect(describeProxy('http://user:password@proxy.example:8080/path?secret=1'))
      .toBe('http://proxy.example:8080')
    expect(describeProxy('')).toBe('direct')
  })
})

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
  }
}

function loggedValues(logger: ReturnType<typeof createLogger>): string[] {
  return [...logger.info.mock.calls, ...logger.warn.mock.calls]
    .flat()
    .map(String)
}
