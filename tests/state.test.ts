import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Logger } from 'koishi'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StateStore } from '../src/state'

const temporaryDirectories: string[] = []
const logger = {
  warn: vi.fn(),
} as unknown as Logger

async function makeStateFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'baha-koishi-'))
  temporaryDirectories.push(directory)
  return join(directory, 'nested', 'state.json')
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )))
  vi.clearAllMocks()
})

describe('StateStore', () => {
  it('creates and overwrites its state atomically', async () => {
    const file = await makeStateFile()
    const store = new StateStore(file, logger)
    await store.load()
    store.state.initialized = true
    store.state.announce = 'first'
    await store.save()
    store.state.announce = 'second'
    await store.save()

    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({
      version: 3,
      initialized: true,
      announce: 'second',
    })
  })

  it('migrates version 1 state without losing Baha data', async () => {
    const file = await makeStateFile()
    await writeFile(file, JSON.stringify({
      version: 1,
      initialized: true,
      announce: '舊公告',
      newAnimeDigest: 'digest',
      newAnimeList: [{ videoSn: 123 }],
    }), 'utf8').catch(async () => {
      const store = new StateStore(file, logger)
      await store.save()
      await writeFile(file, JSON.stringify({
        version: 1,
        initialized: true,
        announce: '舊公告',
        newAnimeDigest: 'digest',
        newAnimeList: [{ videoSn: 123 }],
      }), 'utf8')
    })

    const store = new StateStore(file, logger)
    await expect(store.load()).resolves.toMatchObject({
      version: 3,
      announce: '舊公告',
      newAnimeList: [{ videoSn: 123 }],
      abemaInitialized: false,
      abemaSchedule: [],
      crInitialized: false,
      crSchedule: [],
      crAnnouncementsInitialized: false,
    })
  })

  it('recovers from malformed state files', async () => {
    const file = await makeStateFile()
    await writeFile(file, '{broken', 'utf8').catch(async () => {
      const store = new StateStore(file, logger)
      await store.save()
      await writeFile(file, '{broken', 'utf8')
    })

    const store = new StateStore(file, logger)
    await expect(store.load()).resolves.toMatchObject({ initialized: false })
    expect(logger.warn).toHaveBeenCalledOnce()
  })
})
