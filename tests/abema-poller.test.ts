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

import type { AbemaApiClient } from '../src/abema-api'
import { AbemaPollerService } from '../src/abema-poller'
import { StateStore } from '../src/state'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
})

describe('AbemaPollerService', () => {
  it('records the first snapshot and broadcasts a later release once', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'abema-poller-'))
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
    const fetchAnimeSchedule = vi.fn()
      .mockResolvedValueOnce(scheduleResponse(['100-1_s1_p1']))
      .mockResolvedValueOnce(scheduleResponse(['100-1_s1_p1', '100-1_s1_p2']))
      .mockResolvedValueOnce(scheduleResponse(['100-1_s1_p1', '100-1_s1_p2']))
    const api = { fetchAnimeSchedule } as unknown as AbemaApiClient
    const poller = new AbemaPollerService(ctx, logger, api, store, {
      targets: [{ platform: 'telegram', selfId: '10001', channelId: '-10001' }],
      plainTextPlatforms: ['telegram'],
      maxPushItems: 12,
      timezone: 'Asia/Taipei',
      now: () => new Date('2026-08-05T04:00:00.000Z'),
    })

    await poller.poll()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(store.state.abemaInitialized).toBe(true)

    await poller.poll()
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage).toHaveBeenCalledWith('-10001', expect.any(String), undefined)
    expect(sendMessage.mock.calls[0][1]).not.toContain('abema.tv')

    await poller.poll()
    expect(sendMessage).toHaveBeenCalledOnce()
  })
})

function scheduleResponse(ids: string[]) {
  return {
    modules: [{
      id: 'CHDCPxRFZ8vxTh',
      items: [{
        tabView: {
          displayName: '8/5 水',
          tabViewItems: ids.map((id) => ({
            displayName: `#${id.endsWith('p1') ? '1' : '2'} 測試動畫`,
            description: '測試動畫',
            contentType: 'CONTENT_TYPE_PROGRAM',
            contentId: id,
            viewingAuthority: { viewingType: 'VIEWING_TYPE_FREE' },
          })),
        },
      }],
    }],
  }
}
