import { join } from 'node:path'

import { Context, Logger } from 'koishi'

import { GamerApiClient } from './api'
import { Config as ConfigSchema, type Config as PluginConfig } from './config'
import {
  assertValidTimezone,
  currentDayKey,
  extractAnnouncement,
  extractSchedule,
  formatVideoDetail,
  parseDayKey,
} from './formatters'
import {
  buildAnnouncementMessage,
  buildScheduleMessage,
  buildVideoDetailMessage,
} from './messages'
import { PollerService } from './poller'
import { StateStore } from './state'
import { asRecord } from './types'

export const name = 'baha-update-listener'
export const Config = ConfigSchema
export type Config = PluginConfig

export const usage = `
設定推送目標後，插件會定時監聽巴哈姆特動畫瘋公告和 ON AIR 更新。首次啟動只記錄目前狀態，不推送歷史內容。

可用指令：
- baha.announcement
- baha.schedule [1-7/星期]
- baha.anime <sn>
`

export function apply(ctx: Context, config: PluginConfig): void {
  assertValidTimezone(config.timezone)

  const logger = new Logger(name)
  const api = new GamerApiClient(ctx.http, {
    useMobileApi: config.useMobileApi,
    webUserAgent: config.webUserAgent,
    requestTimeout: config.requestTimeoutSeconds,
  })
  const stateFile = join(ctx.baseDir, 'data', name, 'state.json')
  const store = new StateStore(stateFile, logger)
  const poller = new PollerService(ctx, logger, api, store, {
    targets: config.targets,
    maxPushItems: config.maxPushItems,
  })

  ctx.command('baha', '巴哈姆特動畫瘋查詢')
    .action(() => [
      '可用指令：',
      '\nbaha.announcement - 檢視目前公告',
      '\nbaha.schedule [星期] - 檢視更新排程',
      '\nbaha.anime <sn> - 查詢番劇詳情',
    ].join(''))

  ctx.command('baha.announcement', '檢視動畫瘋目前公告')
    .alias('announcement')
    .action(async () => {
      try {
        const announcement = extractAnnouncement(await api.fetchIndex())
        return announcement ? buildAnnouncementMessage(announcement) : '目前沒有公告。'
      } catch (error) {
        logger.warn('查詢公告失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('baha.schedule [day:string]', '檢視動畫瘋每週更新排程')
    .alias('schedule')
    .example('baha.schedule')
    .example('baha.schedule 週五')
    .action(async (_, day) => {
      const dayKey = day ? parseDayKey(day) : currentDayKey(config.timezone)
      if (!dayKey) return '星期參數無效，請使用 1-7、mon-sun、週一至週日。'

      try {
        const schedule = extractSchedule(await api.fetchIndex())
        if (!Object.values(schedule).some((items) => items?.length)) return '未取得排程資訊。'
        return buildScheduleMessage(dayKey, schedule[dayKey] ?? [], config.maxScheduleItems)
      } catch (error) {
        logger.warn('查詢排程失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('baha.anime <sn:string>', '查詢動畫瘋影片詳情')
    .alias('anime')
    .example('baha.anime 47927')
    .action(async (_, rawSn) => {
      if (rawSn?.toLowerCase() === 'schedule') return '請改用 baha.schedule。'
      const sn = parsePositiveInteger(rawSn)
      if (!sn) return '用法：baha.anime <正整數 sn>'

      try {
        const detail = formatVideoDetail(await api.fetchVideo(sn), config.timezone)
        return buildVideoDetailMessage(detail)
      } catch (error) {
        logger.warn('查詢番劇詳情失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.on('ready', async () => {
    await store.load()
    if (!config.targets.length) {
      logger.info('未設定推送目標，僅啟用查詢指令。')
      return
    }

    ctx.setInterval(() => void poller.poll(), config.pollIntervalSeconds * 1000)
    await poller.poll()
  })
}

function parsePositiveInteger(raw?: string): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) return
  return value
}

function formatQueryError(error: unknown): string {
  const response = asRecord(asRecord(error)?.response)
  const status = response?.status
  return status ? `查詢失敗：HTTP ${String(status)}` : '查詢失敗，請稍後重試。'
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
