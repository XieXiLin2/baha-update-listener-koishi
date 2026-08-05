import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Logger, Session } from 'koishi'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StateStore } from '../src/state'
import {
  isTargetSubscribed,
  parseSubscriptionSwitch,
  SubscriptionService,
} from '../src/subscriptions'
import type { PushTarget } from '../src/types'

const temporaryDirectories: string[] = []
const logger = { warn: vi.fn() } as unknown as Logger

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
  vi.clearAllMocks()
})

describe('group subscriptions', () => {
  it('defaults old targets to all sources and respects configured selections', () => {
    const legacy: PushTarget = { platform: 'onebot', channelId: '100' }
    const selected: PushTarget = {
      platform: 'onebot',
      channelId: '200',
      subscriptions: ['baha', 'cr'],
    }

    expect(isTargetSubscribed(legacy, 'baha')).toBe(true)
    expect(isTargetSubscribed(legacy, 'abema')).toBe(true)
    expect(isTargetSubscribed(legacy, 'cr')).toBe(true)
    expect(isTargetSubscribed(selected, 'baha')).toBe(true)
    expect(isTargetSubscribed(selected, 'abema')).toBe(false)
    expect(isTargetSubscribed(selected, 'cr')).toBe(true)
  })

  it('persists command overrides for the matching group and source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baha-subscriptions-'))
    temporaryDirectories.push(directory)
    const file = join(directory, 'state.json')
    const target: PushTarget = {
      platform: 'onebot',
      selfId: 'bot-1',
      channelId: 'group-1',
      subscriptions: ['baha', 'abema', 'cr'],
    }
    const session = {
      platform: 'onebot',
      selfId: 'bot-1',
      channelId: 'group-1',
    } as Session
    const store = new StateStore(file, logger)
    await store.load()
    const service = new SubscriptionService([target], store)

    expect(service.status(session, 'abema')).toEqual({ found: true, enabled: true })
    await expect(service.set(session, 'abema', false))
      .resolves.toEqual({ found: true, enabled: false })
    expect(service.isSubscribed(target, 'baha')).toBe(true)
    expect(service.isSubscribed(target, 'abema')).toBe(false)

    const reloadedStore = new StateStore(file, logger)
    await reloadedStore.load()
    const reloaded = new SubscriptionService([target], reloadedStore)
    expect(reloaded.status(session, 'abema')).toEqual({ found: true, enabled: false })
  })

  it('does not modify subscriptions for an unconfigured group', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baha-subscriptions-'))
    temporaryDirectories.push(directory)
    const store = new StateStore(join(directory, 'state.json'), logger)
    await store.load()
    const service = new SubscriptionService([], store)
    const session = {
      platform: 'onebot',
      selfId: 'bot-1',
      channelId: 'group-1',
    } as Session

    await expect(service.set(session, 'cr', false))
      .resolves.toEqual({ found: false, enabled: false })
    expect(store.state.subscriptionOverrides).toEqual({})
  })

  it('parses common switch values', () => {
    expect(parseSubscriptionSwitch()).toBeUndefined()
    expect(parseSubscriptionSwitch('on')).toBe(true)
    expect(parseSubscriptionSwitch('開啟')).toBe(true)
    expect(parseSubscriptionSwitch('off')).toBe(false)
    expect(parseSubscriptionSwitch('關閉')).toBe(false)
    expect(parseSubscriptionSwitch('invalid')).toBeNull()
  })
})
