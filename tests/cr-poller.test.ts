import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Bot, Context, Logger } from 'koishi'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('koishi', () => ({
  h: (type: string, attrs: Record<string, unknown>, ...children: unknown[]) => ({
    type,
    attrs,
    children,
  }),
}))

import type { CrApiClient } from '../src/cr-api'
import { CrPollerService } from '../src/cr-poller'
import { StateStore } from '../src/state'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
})

describe('CrPollerService', () => {
  it('baselines both feeds and broadcasts later releases and announcements once', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cr-poller-'))
    temporaryDirectories.push(directory)
    const sendMessage = vi.fn().mockResolvedValue([])
    const bot = {
      platform: 'telegram',
      selfId: '10001',
      sendMessage,
    } as unknown as Bot
    const ctx = { bots: [bot] } as unknown as Context
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger
    const store = new StateStore(join(directory, 'state.json'), logger)
    await store.load()
    const firstRelease = releaseFeedXml([
      releaseItem('GTEST0001', '2026-08-05T03:00:00.000Z'),
    ])
    const secondRelease = releaseFeedXml([
      releaseItem('GTEST0002', '2026-08-05T04:00:00.000Z'),
      releaseItem('GTEST0001', '2026-08-05T03:00:00.000Z'),
    ])
    const firstAnnouncement = announcementFeedXml()
    const secondAnnouncement = firstAnnouncement.replace('</channel>', `
      <item><title>第二則公告</title><category>Announcements</category>
      <link>https://www.crunchyroll.com/news/announcements/second</link>
      <pubDate>Wed, 05 Aug 2026 04:10:00 GMT</pubDate></item></channel>`)
    const fetchReleaseFeed = vi.fn()
      .mockResolvedValueOnce(firstRelease)
      .mockResolvedValueOnce(secondRelease)
      .mockResolvedValueOnce(secondRelease)
    const fetchAnnouncementFeed = vi.fn()
      .mockResolvedValueOnce(firstAnnouncement)
      .mockResolvedValueOnce(secondAnnouncement)
      .mockResolvedValueOnce(secondAnnouncement)
    const api = { fetchReleaseFeed, fetchAnnouncementFeed } as unknown as CrApiClient
    const poller = new CrPollerService(ctx, logger, api, store, {
      targets: [{ platform: 'telegram', selfId: '10001', channelId: '-10001' }],
      plainTextPlatforms: ['telegram'],
      maxPushItems: 12,
      timezone: 'Asia/Taipei',
      now: () => new Date('2026-08-05T04:30:00.000Z'),
    })

    await poller.poll()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(store.state.crInitialized).toBe(true)
    expect(store.state.crAnnouncementsInitialized).toBe(true)

    await poller.poll()
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage.mock.calls[0][1]).not.toContain('crunchyroll.com')
    expect(sendMessage.mock.calls[1][1]).toContain('https://www.crunchyroll.com/news/announcements/second')

    await poller.poll()
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })
})

function releaseFeedXml(items: string[]): string {
  return `<?xml version="1.0"?>
    <rss xmlns:crunchyroll="http://www.crunchyroll.com/rss" version="2.0">
      <channel>${items.join('')}</channel>
    </rss>`
}

function releaseItem(watchId: string, publishedAt: string): string {
  return `<item>
    <title>測試動畫 - Episode 2 - 新的開始</title>
    <link>https://www.crunchyroll.com/watch/${watchId}/start</link>
    <pubDate>${new Date(publishedAt).toUTCString()}</pubDate>
    <crunchyroll:premiumPubDate>${new Date(publishedAt).toUTCString()}</crunchyroll:premiumPubDate>
    <crunchyroll:seriesTitle>測試動畫</crunchyroll:seriesTitle>
    <crunchyroll:episodeNumber>2</crunchyroll:episodeNumber>
  </item>`
}

function announcementFeedXml(): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><item>
    <title>測試公告</title><category>Announcements</category>
    <link>https://www.crunchyroll.com/news/announcements/test</link>
    <pubDate>Wed, 05 Aug 2026 04:00:00 GMT</pubDate>
  </item></channel></rss>`
}
