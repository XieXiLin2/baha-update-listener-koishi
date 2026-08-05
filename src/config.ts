import { Schema } from 'koishi'

import type { PushTarget } from './types'

export interface Config {
  targets: PushTarget[]
  plainTextPlatforms: string[]
  proxyUrl: string
  pollIntervalSeconds: number
  timezone: string
  useMobileApi: boolean
  webUserAgent: string
  requestTimeoutSeconds: number
  maxPushItems: number
  maxScheduleItems: number
  enableAbema: boolean
  abemaPollIntervalSeconds: number
  abemaMaxPushItems: number
  enableCr: boolean
  crPollIntervalSeconds: number
  crMaxPushItems: number
}

const TargetSchema: Schema<PushTarget> = Schema.object({
  platform: Schema.string()
    .required()
    .description('Koishi 平台名稱，例如 telegram、discord 或 onebot。'),
  selfId: Schema.string()
    .description('用於傳送訊息的機器人帳號；留空時使用該平台的第一個機器人。'),
  channelId: Schema.string()
    .required()
    .description('接收更新通知的頻道、群組或私訊 ID。'),
  guildId: Schema.string()
    .description('部分平台傳送頻道訊息時需要的伺服器 ID。'),
})

export const Config: Schema<Config> = Schema.object({
  targets: Schema.array(TargetSchema)
    .role('table')
    .default([])
    .description('主動推送目標。留空時只註冊查詢指令，不啟動輪詢。'),
  plainTextPlatforms: Schema.array(Schema.string())
    .default([])
    .description('停用富文字訊息的平台名稱。ON AIR 與排程不附 URL，最近更新與公告保留純文字 URL。'),
  proxyUrl: Schema.string()
    .role('secret')
    .default('')
    .description('外部請求使用的 HTTP、HTTPS、SOCKS5 或 SOCKS5H 代理網址；留空時直接連線。'),
  pollIntervalSeconds: Schema.number()
    .min(15)
    .max(86400)
    .step(1)
    .default(60)
    .description('巴哈 API 輪詢間隔，單位為秒。'),
  timezone: Schema.string()
    .default('Asia/Taipei')
    .description('排程預設日期和連載狀態使用的 IANA 時區。'),
  useMobileApi: Schema.boolean()
    .default(true)
    .description('使用動畫瘋 Android 用戶端請求標頭。'),
  webUserAgent: Schema.string()
    .default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    .description('關閉行動端請求標頭後使用的 User-Agent。'),
  requestTimeoutSeconds: Schema.number()
    .min(1)
    .max(120)
    .step(1)
    .default(20)
    .description('單次 API 請求逾時，單位為秒。'),
  maxPushItems: Schema.number()
    .min(1)
    .max(30)
    .step(1)
    .default(12)
    .description('每次 ON AIR 通知最多包含的條目數。'),
  maxScheduleItems: Schema.number()
    .min(1)
    .max(100)
    .step(1)
    .default(30)
    .description('單日排程最多顯示的條目數。'),
  enableAbema: Schema.boolean()
    .default(true)
    .description('啟用 ABEMA 新作動畫排程查詢與更新推送。'),
  abemaPollIntervalSeconds: Schema.number()
    .min(60)
    .max(86400)
    .step(1)
    .default(300)
    .description('ABEMA 排程輪詢間隔，單位為秒。'),
  abemaMaxPushItems: Schema.number()
    .min(1)
    .max(30)
    .step(1)
    .default(12)
    .description('每次 ABEMA 更新通知最多包含的條目數。'),
  enableCr: Schema.boolean()
    .default(true)
    .description('啟用 CR 動畫更新與公告輪詢；查詢指令仍會註冊。'),
  crPollIntervalSeconds: Schema.number()
    .min(60)
    .max(86400)
    .step(1)
    .default(300)
    .description('CR 動畫與公告輪詢間隔，單位為秒。'),
  crMaxPushItems: Schema.number()
    .min(1)
    .max(30)
    .step(1)
    .default(12)
    .description('每次 CR 更新或公告通知最多包含的條目數。'),
})
