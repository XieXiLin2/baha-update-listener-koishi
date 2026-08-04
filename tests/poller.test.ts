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

import type { GamerApiClient } from '../src/api'
import { PollerService } from '../src/poller'
import { StateStore } from '../src/state'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
})

describe('PollerService', () => {
  it('records the first snapshot and only broadcasts later changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baha-poller-'))
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

    const fetchIndex = vi.fn()
      .mockResolvedValueOnce(indexSnapshot('舊公告', '第 1 集'))
      .mockResolvedValueOnce(indexSnapshot('新公告', '第 2 集'))
    const api = { fetchIndex } as unknown as GamerApiClient
    const poller = new PollerService(ctx, logger, api, store, {
      targets: [
        { platform: 'telegram', selfId: '10001', channelId: '-10001' },
        { platform: 'telegram', selfId: '10001', channelId: '-10001' },
      ],
      maxPushItems: 12,
    })

    await poller.poll()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(store.state).toMatchObject({
      initialized: true,
      announce: '舊公告',
    })

    await poller.poll()
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sendMessage).toHaveBeenNthCalledWith(1, '-10001', expect.any(Array), undefined)
    expect(sendMessage).toHaveBeenNthCalledWith(2, '-10001', expect.any(Array), undefined)
    expect(store.state).toMatchObject({
      announce: '新公告',
      newAnimeList: [expect.objectContaining({ volume: '第 2 集' })],
    })
  })
})

function indexSnapshot(announce: string, volume: string) {
  return {
    data: {
      announce,
      newAnime: {
        date: [{
          videoSn: 123,
          animeSn: 456,
          title: '測試作品',
          volume,
          upTime: '2026-08-05 12:00:00',
          upTimeHours: '12:00',
        }],
      },
    },
  }
}
