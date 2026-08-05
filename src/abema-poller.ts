import type { Bot, Context, Logger } from 'koishi'
import type { h } from 'koishi'

import type { AbemaApiClient } from './abema-api'
import {
  abemaScheduleDigest,
  extractAbemaAnimeSchedule,
  extractAbemaReleases,
  markAbemaReleases,
} from './abema-formatters'
import { buildAbemaUpdateMessage } from './abema-messages'
import { formatOutboundMessage } from './outbound-message'
import { formatSafeError } from './request-diagnostics'
import type { StateStore } from './state'
import { isTargetSubscribed } from './subscriptions'
import type { PushTarget } from './types'

export interface AbemaPollerOptions {
  targets: PushTarget[]
  plainTextPlatforms: string[]
  maxPushItems: number
  timezone: string
  now?: () => Date
  isSubscribed?: (target: PushTarget) => boolean
}

export class AbemaPollerService {
  private polling = false

  constructor(
    private readonly ctx: Context,
    private readonly logger: Logger,
    private readonly api: AbemaApiClient,
    private readonly store: StateStore,
    private readonly options: AbemaPollerOptions,
  ) {}

  async poll(): Promise<void> {
    if (this.polling) {
      this.logger.debug('上一次 ABEMA 輪詢尚未完成，跳過本輪。')
      return
    }

    this.polling = true
    try {
      const now = this.options.now?.() ?? new Date()
      const schedule = extractAbemaAnimeSchedule(await this.api.fetchAnimeSchedule(), now)
      if (!schedule.length) throw new Error('未取得 ABEMA 新作動畫排程。')
      const digest = abemaScheduleDigest(schedule)
      const state = this.store.state

      if (!state.abemaInitialized) {
        const released = extractAbemaReleases(schedule, state.abemaReleased, now)
        markAbemaReleases(state.abemaReleased, released)
        state.abemaInitialized = true
        state.abemaScheduleDigest = digest
        state.abemaSchedule = schedule
        await this.store.save()
        this.logger.info('已建立 ABEMA 初始狀態，本次不推送歷史內容。')
        return
      }

      const releases = extractAbemaReleases(schedule, state.abemaReleased, now)
      if (releases.length) {
        this.logger.info('偵測到 %d 項 ABEMA 動畫更新。', releases.length)
        await this.broadcast(buildAbemaUpdateMessage(
          releases,
          this.options.maxPushItems,
          this.options.timezone,
        ))
        markAbemaReleases(state.abemaReleased, releases)
      }

      if (releases.length || digest !== state.abemaScheduleDigest) {
        state.abemaScheduleDigest = digest
        state.abemaSchedule = schedule
        await this.store.save()
      }
    } catch (error) {
      this.logger.error('輪詢 ABEMA 新作動畫失敗：%s', formatError(error))
    } finally {
      this.polling = false
    }
  }

  private async broadcast(content: h.Fragment): Promise<void> {
    const targets = uniqueTargets(this.options.targets).filter((target) => (
      this.options.isSubscribed?.(target) ?? isTargetSubscribed(target, 'abema')
    ))
    for (const target of targets) {
      const bot = this.findBot(target)
      if (!bot) {
        this.logger.warn(
          '找不到推送機器人：platform=%s selfId=%s channelId=%s',
          target.platform,
          target.selfId || '(任意)',
          target.channelId,
        )
        continue
      }

      try {
        await bot.sendMessage(
          target.channelId,
          formatOutboundMessage(content, target.platform, this.options.plainTextPlatforms),
          target.guildId,
        )
      } catch (error) {
        this.logger.error(
          '推送失敗：platform=%s selfId=%s channelId=%s error=%s',
          target.platform,
          bot.selfId,
          target.channelId,
          formatError(error),
        )
      }
    }
  }

  private findBot(target: PushTarget): Bot | undefined {
    return this.ctx.bots.find((bot) => (
      bot.platform === target.platform && (!target.selfId || bot.selfId === target.selfId)
    ))
  }
}

function uniqueTargets(targets: PushTarget[]): PushTarget[] {
  const seen = new Set<string>()
  return targets.filter((target) => {
    const key = [target.platform, target.selfId ?? '', target.channelId, target.guildId ?? ''].join('\u0000')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatError(error: unknown): string {
  return formatSafeError(error)
}
