import type { Bot, Context, Logger } from 'koishi'
import type { h } from 'koishi'

import type { CrApiClient } from './cr-api'
import {
  crScheduleDigest,
  extractCrAnnouncements,
  extractCrReleaseFeed,
  extractCrReleases,
  markCrReleases,
} from './cr-formatters'
import { buildCrAnnouncementMessage, buildCrUpdateMessage } from './cr-messages'
import { formatOutboundMessage } from './outbound-message'
import { formatSafeError } from './request-diagnostics'
import type { StateStore } from './state'
import { isTargetSubscribed } from './subscriptions'
import type { PushTarget } from './types'

export interface CrPollerOptions {
  targets: PushTarget[]
  plainTextPlatforms: string[]
  maxPushItems: number
  timezone: string
  now?: () => Date
  isSubscribed?: (target: PushTarget) => boolean
}

export class CrPollerService {
  private polling = false

  constructor(
    private readonly ctx: Context,
    private readonly logger: Logger,
    private readonly api: CrApiClient,
    private readonly store: StateStore,
    private readonly options: CrPollerOptions,
  ) {}

  async poll(): Promise<void> {
    if (this.polling) {
      this.logger.debug('上一次 CR 輪詢尚未完成，跳過本輪。')
      return
    }

    this.polling = true
    try {
      const now = this.options.now?.() ?? new Date()
      const [releaseResult, announcementResult] = await Promise.allSettled([
        this.api.fetchReleaseFeed(),
        this.api.fetchAnnouncementFeed(),
      ])
      let changed = false

      if (releaseResult.status === 'fulfilled') {
        try {
          changed = await this.processReleases(releaseResult.value, now) || changed
        } catch (error) {
          this.logger.error('處理 CR 動畫更新失敗：%s', formatError(error))
        }
      } else {
        this.logger.error('輪詢 CR 動畫更新失敗：%s', formatError(releaseResult.reason))
      }

      if (announcementResult.status === 'fulfilled') {
        try {
          changed = await this.processAnnouncements(announcementResult.value) || changed
        } catch (error) {
          this.logger.error('處理 CR 公告失敗：%s', formatError(error))
        }
      } else {
        this.logger.error('輪詢 CR 公告失敗：%s', formatError(announcementResult.reason))
      }

      if (changed) await this.store.save()
    } catch (error) {
      this.logger.error('輪詢 CR 失敗：%s', formatError(error))
    } finally {
      this.polling = false
    }
  }

  private async processReleases(xml: string, now: Date): Promise<boolean> {
    const schedule = extractCrReleaseFeed(xml, this.options.timezone, now)
    if (!schedule.length) throw new Error('未取得 CR 動畫更新資料。')
    const digest = crScheduleDigest(schedule)
    const state = this.store.state

    if (!state.crInitialized) {
      markCrReleases(state.crReleased, extractCrReleases(schedule, state.crReleased, now))
      state.crInitialized = true
      state.crScheduleDigest = digest
      state.crSchedule = schedule
      this.logger.info('已建立 CR 動畫初始狀態，本次不推送歷史內容。')
      return true
    }

    const releases = extractCrReleases(schedule, state.crReleased, now)
    if (releases.length) {
      this.logger.info('偵測到 %d 項 CR 動畫更新。', releases.length)
      await this.broadcast(buildCrUpdateMessage(
        releases,
        this.options.maxPushItems,
        this.options.timezone,
      ), false)
      markCrReleases(state.crReleased, releases)
    }

    if (releases.length || digest !== state.crScheduleDigest) {
      state.crScheduleDigest = digest
      state.crSchedule = schedule
      return true
    }
    return false
  }

  private async processAnnouncements(xml: string): Promise<boolean> {
    const announcements = extractCrAnnouncements(xml)
    const state = this.store.state
    const currentIds = announcements.map((item) => item.key)

    if (!state.crAnnouncementsInitialized) {
      state.crAnnouncementsInitialized = true
      state.crAnnouncementIds = currentIds.slice(0, 500)
      this.logger.info('已建立 CR 公告初始狀態，本次不推送歷史內容。')
      return true
    }

    const previous = new Set(state.crAnnouncementIds)
    const updates = announcements.filter((item) => !previous.has(item.key))
    if (!updates.length) return false

    this.logger.info('偵測到 %d 項 CR 公告更新。', updates.length)
    await this.broadcast(buildCrAnnouncementMessage(
      updates,
      this.options.maxPushItems,
      this.options.timezone,
    ), true)
    state.crAnnouncementIds = [...new Set([...currentIds, ...state.crAnnouncementIds])].slice(0, 500)
    return true
  }

  private async broadcast(content: h.Fragment, keepUrls: boolean): Promise<void> {
    const targets = uniqueTargets(this.options.targets).filter((target) => (
      this.options.isSubscribed?.(target) ?? isTargetSubscribed(target, 'cr')
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
          formatOutboundMessage(content, target.platform, this.options.plainTextPlatforms, { keepUrls }),
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
