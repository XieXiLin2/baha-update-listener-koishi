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
配置推送目标后，插件会定时监听巴哈姆特动画疯公告和 ON AIR 更新。首次启动只记录当前状态，不推送历史内容。

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

  ctx.command('baha', '巴哈姆特动画疯查询')
    .action(() => [
      '可用指令：',
      '\nbaha.announcement - 查看当前公告',
      '\nbaha.schedule [星期] - 查看更新排程',
      '\nbaha.anime <sn> - 查询番剧详情',
    ].join(''))

  ctx.command('baha.announcement', '查看动画疯当前公告')
    .alias('announcement')
    .action(async () => {
      try {
        const announcement = extractAnnouncement(await api.fetchIndex())
        return announcement ? buildAnnouncementMessage(announcement) : '目前没有公告。'
      } catch (error) {
        logger.warn('查询公告失败：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('baha.schedule [day:string]', '查看动画疯每周更新排程')
    .alias('schedule')
    .example('baha.schedule')
    .example('baha.schedule 周五')
    .action(async (_, day) => {
      const dayKey = day ? parseDayKey(day) : currentDayKey(config.timezone)
      if (!dayKey) return '星期参数无效，请使用 1-7、mon-sun、周一至周日。'

      try {
        const schedule = extractSchedule(await api.fetchIndex())
        if (!Object.values(schedule).some((items) => items?.length)) return '未取得排程信息。'
        return buildScheduleMessage(dayKey, schedule[dayKey] ?? [], config.maxScheduleItems)
      } catch (error) {
        logger.warn('查询排程失败：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.command('baha.anime <sn:string>', '查询动画疯影片详情')
    .alias('anime')
    .example('baha.anime 47927')
    .action(async (_, rawSn) => {
      if (rawSn?.toLowerCase() === 'schedule') return '请改用 baha.schedule。'
      const sn = parsePositiveInteger(rawSn)
      if (!sn) return '用法：baha.anime <正整数 sn>'

      try {
        const detail = formatVideoDetail(await api.fetchVideo(sn), config.timezone)
        return buildVideoDetailMessage(detail)
      } catch (error) {
        logger.warn('查询番剧详情失败：%s', formatError(error))
        return formatQueryError(error)
      }
    })

  ctx.on('ready', async () => {
    await store.load()
    if (!config.targets.length) {
      logger.info('未配置推送目标，仅启用查询指令。')
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
  return status ? `查询失败：HTTP ${String(status)}` : '查询失败，请稍后重试。'
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
