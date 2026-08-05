import type { Context } from 'koishi'

import type { BahaIndexResponse } from './types'
import type { RequestDiagnostics } from './request-diagnostics'

const INDEX_URL = 'https://api.gamer.com.tw/mobile_app/anime/v3/index.php'

const MOBILE_HEADERS = {
  'User-Agent': 'Animad/1.16.16 (tw.com.gamer.android.animad; build:328; Android 9) okHttp/4.4.0',
  'X-Bahamut-App-Android': 'tw.com.gamer.android.animad',
  'X-Bahamut-App-Version': '328',
  'Accept-Encoding': 'gzip',
  Connection: 'Keep-Alive',
}

export interface GamerApiOptions {
  useMobileApi: boolean
  webUserAgent: string
  requestTimeout: number
  diagnostics?: RequestDiagnostics
}

export class GamerApiClient {
  constructor(
    private readonly http: Context['http'],
    private readonly options: GamerApiOptions,
  ) {}

  fetchIndex(): Promise<BahaIndexResponse> {
    return this.getJson<BahaIndexResponse>(INDEX_URL)
  }

  private getJson<T extends object>(url: string): Promise<T> {
    const request = (): Promise<T> => this.http.get<T>(url, {
      headers: this.buildHeaders(),
      timeout: this.options.requestTimeout * 1000,
    })
    return this.options.diagnostics?.run('Baha', 'GET', url, request) ?? request()
  }

  private buildHeaders(): Record<string, string> {
    if (this.options.useMobileApi) return { ...MOBILE_HEADERS }

    const origin = 'https://ani.gamer.com.tw'
    return {
      'User-Agent': this.options.webUserAgent,
      Referer: `${origin}/`,
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.6',
      Accept: 'application/json,text/plain,*/*',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'max-age=0',
      Origin: origin,
    }
  }
}
