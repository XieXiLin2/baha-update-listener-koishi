import { createHmac, randomUUID } from 'node:crypto'

import type { Context } from 'koishi'

import type { UnknownRecord } from './types'
import { asRecord, asString } from './types'
import type { RequestDiagnostics } from './request-diagnostics'

const AUTH_URL = 'https://abema.tv/api/auth/login/guest'
const API_ORIGIN = 'https://api.p-c3-e.abema-tv.com'
const USER_CONTENT_ORIGIN = 'https://user-content-api.p-c3-e.abema-tv.com'
const VIDEO_SPOT_LIST_ID = '2b5f1ea4-fd0d-4aa8-bc11-93277f2da624'
const APPLICATION_KEY = 'v+Gjs=25Aw5erR!J8ZuvRrCx*rGswhB&qdHd_SYerEWdU&a?3DzN9BRbp5KwY4hEmcj5#fykMjJ=AuWz5GSMY-d@H7DMEh3M@9n2G552Us$$k9cD=3TxwWe86!x#Zyhe'

export interface AbemaApiOptions {
  requestTimeout: number
  diagnostics?: RequestDiagnostics
}

export interface AbemaModulesResponse extends UnknownRecord {
  modules?: unknown
}

interface GuestLoginResponse extends UnknownRecord {
  access_token?: unknown
}

interface SpotListResponse extends UnknownRecord {
  items?: unknown
}

export class AbemaApiClient {
  private readonly deviceId = randomUUID()
  private accessToken = ''
  private accessTokenExpiresAt = 0
  private animeSpotId = ''

  constructor(
    private readonly http: Context['http'],
    private readonly options: AbemaApiOptions,
  ) {}

  async fetchAnimeSchedule(): Promise<AbemaModulesResponse> {
    const spotId = await this.getAnimeSpotId()
    return this.getAuthorized<AbemaModulesResponse>(`${USER_CONTENT_ORIGIN}/v1/modules`, {
      spotId,
      spotVersion: '1',
      limit: 20,
      qos: 'PC',
      qpl: 'web',
      include: 'liveEvent',
    })
  }

  private async getAnimeSpotId(): Promise<string> {
    if (this.animeSpotId) return this.animeSpotId

    const response = await this.getAuthorized<SpotListResponse>(
      `${API_ORIGIN}/v1/spotLists/${VIDEO_SPOT_LIST_ID}`,
    )
    const items = Array.isArray(response.items) ? response.items : []
    for (const item of items) {
      const record = asRecord(item)
      if (asString(asRecord(record?.genre)?.id) !== 'animation') continue
      const spotId = asString(record?.id)
      if (spotId) {
        this.animeSpotId = spotId
        return spotId
      }
    }
    throw new Error('ABEMA 動畫資料源目前無法使用。')
  }

  private async getAuthorized<T extends object>(
    url: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const request = async (): Promise<T> => {
      const send = async (): Promise<T> => this.http.get<T>(url, {
        headers: this.authorizedHeaders(await this.getAccessToken()),
        params,
        timeout: this.options.requestTimeout * 1000,
      })
      return this.options.diagnostics?.run('ABEMA', 'GET', url, send) ?? send()
    }

    try {
      return await request()
    } catch (error) {
      if (httpStatus(error) !== 401) throw error
      this.accessToken = ''
      this.accessTokenExpiresAt = 0
      return request()
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() + 60_000 < this.accessTokenExpiresAt) {
      return this.accessToken
    }

    const target = applicationKeyDate()
    const send = (): Promise<GuestLoginResponse> => this.http.post<GuestLoginResponse>(
      AUTH_URL,
      {
        device_id: this.deviceId,
        application_key_secret: generateApplicationKeySecret(this.deviceId, target),
        device_type: 3,
        previous_user_id: '',
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: this.options.requestTimeout * 1000,
      },
    )
    const response = await (
      this.options.diagnostics?.run('ABEMA Auth', 'POST', AUTH_URL, send) ?? send()
    )

    const token = asString(response.access_token)
    if (!token) throw new Error('ABEMA 訪客授權未回傳存取權杖。')
    this.accessToken = token
    this.accessTokenExpiresAt = tokenExpiration(token) ?? Date.now() + 60 * 60 * 1000
    return token
  }

  private authorizedHeaders(token: string): Record<string, string> {
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }
}

export function applicationKeyDate(now = new Date()): Date {
  const target = new Date(now.getTime())
  target.setHours(target.getHours() + 1)
  target.setMinutes(0)
  target.setSeconds(0)
  return target
}

export function generateApplicationKeySecret(deviceId: string, target: Date): string {
  const key = Buffer.from(APPLICATION_KEY)
  let output = repeatHmac(key, key, target.getUTCMonth() + 1)
  output = repeatHmac(key, Buffer.from(`${base64Url(output)}${deviceId}`), target.getUTCDate() % 5)
  output = repeatHmac(
    key,
    Buffer.from(`${base64Url(output)}${Math.floor(target.getTime() / 1000)}`),
    target.getUTCHours() % 5,
  )
  return base64Url(output)
}

function repeatHmac(key: Buffer, data: Buffer, count: number): Buffer {
  let output = data
  for (let index = 0; index <= count; index++) {
    output = createHmac('sha256', key).update(output).digest()
  }
  return output
}

function base64Url(value: Buffer): string {
  return value.toString('base64url')
}

function tokenExpiration(token: string): number | undefined {
  try {
    const payload = asRecord(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')))
    const expiresAt = Number(payload?.exp) * 1000
    return Number.isFinite(expiresAt) ? expiresAt : undefined
  } catch {
    return undefined
  }
}

function httpStatus(error: unknown): number | undefined {
  const response = asRecord(asRecord(error)?.response)
  const status = Number(response?.status)
  return Number.isFinite(status) ? status : undefined
}
