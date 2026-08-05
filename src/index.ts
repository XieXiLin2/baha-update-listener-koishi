import { join } from 'node:path'

import { Context, Logger } from 'koishi'
import type { h } from 'koishi'

import { AbemaApiClient } from './abema-api'
import {
  extractAbemaAnimeSchedule,
  latestAbemaReleases,
  selectAbemaScheduleDate,
} from './abema-formatters'
import { buildAbemaLatestMessage, buildAbemaScheduleMessage } from './abema-messages'
import { AbemaPollerService } from './abema-poller'
import { GamerApiClient } from './api'
import { Config as ConfigSchema, type Config as PluginConfig } from './config'
import { CrApiClient } from './cr-api'
import {
  crWeekStartDateKey,
  extractCrAnnouncements,
  extractCrCalendar,
  extractCrReleaseFeed,
  latestCrReleases,
  mergeCrSchedule,
  parseCrDateArgument,
  selectCrScheduleDate,
} from './cr-formatters'
import {
  buildCrAnnouncementMessage,
  buildCrLatestMessage,
  buildCrScheduleMessage,
} from './cr-messages'
import { CrPollerService } from './cr-poller'
import {
  assertValidTimezone,
  currentDayKey,
  extractAnnouncement,
  extractNewAnimeList,
  extractSchedule,
  latestBahaReleases,
  parseDayKey,
} from './formatters'
import { buildAnnouncementMessage, buildBahaLatestMessage, buildScheduleMessage } from './messages'
import { formatOutboundMessage } from './outbound-message'
import { PollerService } from './poller'
import { createHttpClient } from './proxy'
import { StateStore } from './state'
import { asRecord } from './types'

export const name = 'baha-update-listener'
export const Config = ConfigSchema
export type Config = PluginConfig

export const usage = `
設定推送目標後，插件會定時監聽巴哈姆特動畫瘋、ABEMA 與 CR 動畫更新。首次啟動只記錄目前狀態，不推送歷史內容。

可用指令：
- baha
- baha.announcement
- baha.latest [數量]
- baha.schedule [1-7/星期]
- abema
- abema.latest [數量]
- abema.schedule [日期]
- cr
- cr.announcement
- cr.latest [數量]
- cr.schedule [日期]
`

export function apply(ctx: Context, config: PluginConfig): void {
  assertValidTimezone(config.timezone)

  const logger = new Logger(name)
  const http = createHttpClient(ctx, config.proxyUrl)
  const api = new GamerApiClient(http, {
    useMobileApi: config.useMobileApi,
    webUserAgent: config.webUserAgent,
    requestTimeout: config.requestTimeoutSeconds,
  })
  const abemaApi = new AbemaApiClient(http, {
    requestTimeout: config.requestTimeoutSeconds,
  })
  const crApi = new CrApiClient(http, {
    requestTimeout: config.requestTimeoutSeconds,
    userAgent: config.webUserAgent,
  })
  const stateFile = join(ctx.baseDir, 'data', name, 'state.json')
  const store = new StateStore(stateFile, logger)
  const poller = new PollerService(ctx, logger, api, store, {
    targets: config.targets,
    plainTextPlatforms: config.plainTextPlatforms,
    maxPushItems: config.maxPushItems,
  })
  const abemaPoller = new AbemaPollerService(ctx, logger, abemaApi, store, {
    targets: config.targets,
    plainTextPlatforms: config.plainTextPlatforms,
    maxPushItems: config.abemaMaxPushItems,
    timezone: config.timezone,
  })
  const crPoller = new CrPollerService(ctx, logger, crApi, store, {
    targets: config.targets,
    plainTextPlatforms: config.plainTextPlatforms,
    maxPushItems: config.crMaxPushItems,
    timezone: config.timezone,
  })

  const queryBahaSchedule = async (day?: string) => {
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
  }

  const queryAbemaSchedule = async (date?: string) => {
    try {
      const schedule = extractAbemaAnimeSchedule(await abemaApi.fetchAnimeSchedule())
      const selected = selectAbemaScheduleDate(schedule, date)
      if (!selected) return '日期參數無效，請使用今天、明天、M/D 或 YYYY-MM-DD。'
      return buildAbemaScheduleMessage(
        selected.dateKey,
        selected.items,
        config.maxScheduleItems,
        config.timezone,
      )
    } catch (error) {
      logger.warn('查詢 ABEMA 排程失敗：%s', formatError(error))
      return formatQueryError(error)
    }
  }

  const queryCrSchedule = async (date?: string) => {
    const dateKey = parseCrDateArgument(date, config.timezone)
    if (!dateKey) return '日期參數無效，請使用今天、明天、M/D 或 YYYY-MM-DD。'

    try {
      const weekStart = crWeekStartDateKey(dateKey)
      const response = await crApi.fetchSchedule(weekStart)
      const schedule = mergeCrSchedule(
        extractCrCalendar(response.calendarHtml, weekStart, config.timezone),
        extractCrReleaseFeed(response.releaseFeedXml, config.timezone),
      )
      return buildCrScheduleMessage(
        dateKey,
        selectCrScheduleDate(schedule, dateKey),
        config.maxScheduleItems,
        config.timezone,
      )
    } catch (error) {
      logger.warn('查詢 CR 排程失敗：%s', formatError(error))
      return formatQueryError(error)
    }
  }

  const formatReply = (
    content: h.Fragment,
    platform: string,
    keepUrls: boolean,
  ): h.Fragment => formatOutboundMessage(
    content,
    platform,
    config.plainTextPlatforms,
    { keepUrls },
  )

  ctx.command('baha', '檢視動畫瘋當日更新排程')
    .action(async ({ session }) => formatReply(await queryBahaSchedule(), session?.platform ?? '', false))

  ctx.command('baha.announcement', '檢視動畫瘋目前公告')
    .alias('announcement')
    .action(async ({ session }) => {
      try {
        const announcement = extractAnnouncement(await api.fetchIndex())
        const message = announcement ? buildAnnouncementMessage(announcement) : '目前沒有公告。'
        return formatReply(message, session?.platform ?? '', true)
      } catch (error) {
        logger.warn('查詢公告失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('baha.latest [limit:number]', '檢視動畫瘋最近更新')
    .example('baha.latest')
    .example('baha.latest 10')
    .action(async ({ session }, rawLimit) => {
      const limit = normalizeLimit(rawLimit, 10, config.maxScheduleItems)
      try {
        const updates = latestBahaReleases(
          extractNewAnimeList(await api.fetchIndex()),
          limit,
        )
        return formatReply(buildBahaLatestMessage(updates), session?.platform ?? '', true)
      } catch (error) {
        logger.warn('查詢動畫瘋最近更新失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('baha.schedule [day:string]', '檢視動畫瘋每週更新排程')
    .alias('schedule')
    .example('baha.schedule')
    .example('baha.schedule 週五')
    .action(async ({ session }, day) => formatReply(
      await queryBahaSchedule(day),
      session?.platform ?? '',
      false,
    ))

  ctx.command('abema', '檢視 ABEMA 當日新作動畫排程')
    .action(async ({ session }) => formatReply(await queryAbemaSchedule(), session?.platform ?? '', false))

  ctx.command('abema.latest [limit:number]', '檢視 ABEMA 最近動畫更新')
    .example('abema.latest')
    .example('abema.latest 10')
    .action(async ({ session }, rawLimit) => {
      const limit = normalizeLimit(rawLimit, 10, config.maxScheduleItems)
      try {
        const schedule = extractAbemaAnimeSchedule(await abemaApi.fetchAnimeSchedule())
        return formatReply(buildAbemaLatestMessage(
          latestAbemaReleases(schedule, limit),
          limit,
          config.timezone,
        ), session?.platform ?? '', true)
      } catch (error) {
        logger.warn('查詢 ABEMA 最近更新失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('abema.schedule [date:string]', '檢視 ABEMA 新作動畫排程')
    .example('abema.schedule')
    .example('abema.schedule 明天')
    .example('abema.schedule 8/5')
    .action(async ({ session }, date) => formatReply(
      await queryAbemaSchedule(date),
      session?.platform ?? '',
      false,
    ))

  ctx.command('cr', '檢視 CR 當日動畫排程')
    .action(async ({ session }) => formatReply(await queryCrSchedule(), session?.platform ?? '', false))

  ctx.command('cr.announcement', '檢視 CR 最新公告')
    .action(async ({ session }) => {
      try {
        const announcements = extractCrAnnouncements(await crApi.fetchAnnouncementFeed())
        return formatReply(
          buildCrAnnouncementMessage(announcements.slice(0, 1), 1, config.timezone),
          session?.platform ?? '',
          true,
        )
      } catch (error) {
        logger.warn('查詢 CR 公告失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('cr.latest [limit:number]', '檢視 CR 最近動畫更新')
    .example('cr.latest')
    .example('cr.latest 10')
    .action(async ({ session }, rawLimit) => {
      const limit = normalizeLimit(rawLimit, 10, config.maxScheduleItems)
      try {
        const schedule = extractCrReleaseFeed(
          await crApi.fetchReleaseFeed(),
          config.timezone,
        )
        return formatReply(buildCrLatestMessage(
          latestCrReleases(schedule, limit),
          limit,
          config.timezone,
        ), session?.platform ?? '', true)
      } catch (error) {
        logger.warn('查詢 CR 最近更新失敗：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('cr.schedule [date:string]', '檢視 CR 動畫排程')
    .example('cr.schedule')
    .example('cr.schedule 明天')
    .example('cr.schedule 8/5')
    .action(async ({ session }, date) => formatReply(
      await queryCrSchedule(date),
      session?.platform ?? '',
      false,
    ))

  ctx.on('ready', async () => {
    await store.load()
    if (!config.targets.length) {
      logger.info('未設定推送目標，僅啟用查詢指令。')
      return
    }

    ctx.setInterval(() => void poller.poll(), config.pollIntervalSeconds * 1000)
    const initialPolls = [poller.poll()]
    if (config.enableAbema) {
      ctx.setInterval(() => void abemaPoller.poll(), config.abemaPollIntervalSeconds * 1000)
      initialPolls.push(abemaPoller.poll())
    }
    if (config.enableCr) {
      ctx.setInterval(() => void crPoller.poll(), config.crPollIntervalSeconds * 1000)
      initialPolls.push(crPoller.poll())
    }
    await Promise.all(initialPolls)
  })
}

function normalizeLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || !value || value < 1) return Math.min(fallback, maximum)
  return Math.min(value, maximum)
}

function formatQueryError(error: unknown): string {
  const response = asRecord(asRecord(error)?.response)
  const status = response?.status
  return status ? `查詢失敗：HTTP ${String(status)}` : '查詢失敗，請稍後重試。'
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
