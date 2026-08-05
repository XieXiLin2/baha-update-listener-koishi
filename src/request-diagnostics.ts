import type { Logger } from 'koishi'

import { asRecord } from './types'

export type RequestMethod = 'GET' | 'POST'

export class RequestDiagnostics {
  private sequence = 0

  constructor(
    private readonly logger: Logger,
    private readonly proxyUrl: string,
    private readonly enabled: boolean,
  ) {}

  async run<T>(
    source: string,
    method: RequestMethod,
    url: string,
    request: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) return request()

    const id = ++this.sequence
    const target = safeRequestTarget(url)
    const proxy = describeProxy(this.proxyUrl)
    const startedAt = Date.now()
    this.logger.info(
      '[request:%d] start source=%s method=%s target=%s proxy=%s',
      id,
      source,
      method,
      target,
      proxy,
    )

    try {
      const result = await request()
      this.logger.info(
        '[request:%d] success source=%s duration=%dms payload=%s',
        id,
        source,
        Date.now() - startedAt,
        describePayload(result),
      )
      return result
    } catch (error) {
      const details = describeRequestError(error)
      this.logger.warn(
        '[request:%d] failed source=%s duration=%dms status=%s code=%s error=%s cause=%s',
        id,
        source,
        Date.now() - startedAt,
        details.status,
        details.code,
        details.message,
        details.cause,
      )
      throw error
    }
  }
}

export function describeProxy(proxyUrl: string): string {
  if (!proxyUrl.trim()) return 'direct'
  try {
    const url = new URL(proxyUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    return 'invalid'
  }
}

function safeRequestTarget(value: string): string {
  try {
    const url = new URL(value)
    return `${url.hostname}${url.pathname}`
  } catch {
    return '(invalid-url)'
  }
}

function describePayload(value: unknown): string {
  if (typeof value === 'string') return `text:${Buffer.byteLength(value, 'utf8')}B`
  if (value instanceof ArrayBuffer) return `arraybuffer:${value.byteLength}B`
  if (ArrayBuffer.isView(value)) return `binary:${value.byteLength}B`
  if (Array.isArray(value)) return `array:${value.length}`
  if (value && typeof value === 'object') return 'object'
  return typeof value
}

function describeRequestError(error: unknown): {
  status: string
  code: string
  message: string
  cause: string
} {
  const chain = errorChain(error)
  const records = chain.map(asRecord).filter((item) => item !== undefined)
  const responseStatus = records
    .map((record) => asRecord(record.response)?.status ?? record.status ?? record.statusCode)
    .find((value) => value !== undefined && value !== null && value !== '')
  const code = records
    .map((record) => record.code)
    .find((value) => value !== undefined && value !== null && value !== '')
  const message = records[0]?.message ?? error
  const causes = records.slice(1)
    .map((record) => {
      const causeMessage = record.message
      const causeCode = record.code
      if (!causeMessage) return causeCode
      return causeCode ? `${String(causeCode)}: ${String(causeMessage)}` : causeMessage
    })
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join(' -> ')
  return {
    status: safeLogValue(responseStatus),
    code: safeLogValue(code),
    message: safeLogValue(message),
    cause: safeLogValue(causes),
  }
}

export function formatSafeError(error: unknown): string {
  return safeLogValue(asRecord(error)?.message ?? error)
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = []
  const seen = new Set<object>()
  let current = error

  for (let depth = 0; depth < 6; depth++) {
    const record = asRecord(current)
    if (!record || seen.has(record)) break
    seen.add(record)
    chain.push(current)
    current = record.cause
  }
  return chain
}

function safeLogValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\b(?:https?|socks5h?):\/\/[^\s]+/gi, redactUrl)
    .replace(
      /\b(authorization|proxy-authorization|cookie|set-cookie|token|password)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1=[redacted]',
    )
    .slice(0, 300)
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return '(redacted-url)'
  }
}
