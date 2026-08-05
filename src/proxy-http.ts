import {
  fetch as undiciFetch,
  Headers,
  type Dispatcher,
  type Response,
} from 'undici'

export type ProxyFetch = typeof undiciFetch

export interface ProxyRequestConfig {
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean>
  timeout?: number
  responseType?: 'text' | 'arraybuffer'
}

interface ProxyHttpError extends Error {
  response?: {
    status: number
    statusText: string
  }
}

export class ProxyHttpClient {
  constructor(
    private readonly dispatcher: Dispatcher,
    private readonly fetchImpl: ProxyFetch = undiciFetch,
  ) {}

  get<T>(url: string, config?: ProxyRequestConfig): Promise<T> {
    return this.request<T>('GET', url, undefined, config)
  }

  post<T>(url: string, data?: unknown, config?: ProxyRequestConfig): Promise<T> {
    return this.request<T>('POST', url, data, config)
  }

  private async request<T>(
    method: 'GET' | 'POST',
    url: string,
    data?: unknown,
    config: ProxyRequestConfig = {},
  ): Promise<T> {
    const target = new URL(url)
    for (const [key, value] of Object.entries(config.params ?? {})) {
      if (value === undefined || value === null) continue
      target.searchParams.append(key, String(value))
    }

    const controller = new AbortController()
    const timer = config.timeout
      ? setTimeout(() => controller.abort(timeoutError()), config.timeout)
      : undefined
    const headers = new Headers(config.headers)
    const body = encodeBody(data, headers)

    let response: Response
    try {
      response = await this.fetchImpl(target, {
        method,
        headers,
        body,
        dispatcher: this.dispatcher,
        redirect: 'follow',
        signal: controller.signal,
      })
    } catch (cause) {
      const error = new Error(`fetch ${target.href} failed`, { cause })
      throw error
    } finally {
      if (timer) clearTimeout(timer)
    }

    if (response.status >= 400) {
      await response.body?.cancel().catch(() => undefined)
      const error: ProxyHttpError = new Error(response.statusText || `HTTP ${response.status}`)
      error.response = {
        status: response.status,
        statusText: response.statusText,
      }
      throw error
    }

    if (config.responseType === 'text') return await response.text() as T
    if (config.responseType === 'arraybuffer') return await response.arrayBuffer() as T
    if (response.headers.get('content-type')?.startsWith('application/json')) {
      return await response.json() as T
    }
    if (response.headers.get('content-type')?.startsWith('text/')) {
      return await response.text() as T
    }
    return await response.arrayBuffer() as T
  }
}

function encodeBody(data: unknown, headers: Headers): string | undefined {
  if (data === undefined) return
  if (typeof data === 'string') return data
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  return JSON.stringify(data)
}

function timeoutError(): Error {
  return Object.assign(new Error('request timeout'), { code: 'ETIMEDOUT' })
}
