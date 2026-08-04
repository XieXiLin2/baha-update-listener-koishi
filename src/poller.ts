import type { Bot, Context, Logger } from 'koishi'
import type { h } from 'koishi'

import type { GamerApiClient } from './api'
import {
  extractAnnouncement,
  extractNewAnimeList,
  extractNewAnimeUpdates,
  newAnimeDigest,
  sortOnAirItems,
} from './formatters'
import { buildAnnouncementMessage, buildOnAirMessage } from './messages'
import type { StateStore } from './state'
import type { PushTarget } from './types'

export interface PollerOptions {
  targets: PushTarget[]
  maxPushItems: number
}

export class PollerService {
  private polling = false

  constructor(
    private readonly ctx: Context,
    private readonly logger: Logger,
    private readonly api: GamerApiClient,
    private readonly store: StateStore,
    private readonly options: PollerOptions,
  ) {}

  async poll(): Promise<void> {
    if (this.polling) {
      this.logger.debug('上一次轮询尚未完成，跳过本轮。')
      return
    }

    this.polling = true
    try {
      const index = await this.api.fetchIndex()
      const announcement = extractAnnouncement(index)
      const animeList = extractNewAnimeList(index)
      const digest = newAnimeDigest(animeList)
      const state = this.store.state

      if (!state.initialized) {
        Object.assign(state, {
          initialized: true,
          announce: announcement,
          newAnimeDigest: digest,
          newAnimeList: animeList,
        })
        await this.store.save()
        this.logger.info('已建立初始状态，本次不推送历史内容。')
        return
      }

      let changed = false
      if (announcement && announcement !== state.announce) {
        this.logger.info('检测到动画疯公告更新。')
        await this.broadcast(buildAnnouncementMessage(announcement))
        state.announce = announcement
        changed = true
      }

      if (digest !== state.newAnimeDigest) {
        const updates = state.newAnimeList.length
          ? extractNewAnimeUpdates(state.newAnimeList, animeList)
          : animeList.slice(0, this.options.maxPushItems)
        const validUpdates = sortOnAirItems(updates)
          .filter((item) => item.videoSn || item.video_sn)
          .slice(0, this.options.maxPushItems)

        if (validUpdates.length) {
          this.logger.info('检测到 %d 项 ON AIR 更新。', validUpdates.length)
          await this.broadcast(buildOnAirMessage(validUpdates))
        } else {
          this.logger.debug('ON AIR 指纹发生变化，但没有可推送的有效条目。')
        }

        state.newAnimeDigest = digest
        state.newAnimeList = animeList
        changed = true
      }

      if (changed) await this.store.save()
    } catch (error) {
      this.logger.error('轮询巴哈动画疯失败：%s', formatError(error))
    } finally {
      this.polling = false
    }
  }

  private async broadcast(content: h.Fragment): Promise<void> {
    const targets = uniqueTargets(this.options.targets)
    for (const target of targets) {
      const bot = this.findBot(target)
      if (!bot) {
        this.logger.warn(
          '找不到推送机器人：platform=%s selfId=%s channelId=%s',
          target.platform,
          target.selfId || '(任意)',
          target.channelId,
        )
        continue
      }

      try {
        await bot.sendMessage(target.channelId, content, target.guildId)
      } catch (error) {
        this.logger.error(
          '推送失败：platform=%s selfId=%s channelId=%s error=%s',
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
  return error instanceof Error ? error.message : String(error)
}

