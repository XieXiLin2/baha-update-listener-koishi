import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

import type { Logger } from 'koishi'

import type { PersistedState } from './types'
import {
  asAbemaAnimeItems,
  asAnimeItems,
  asRecord,
  asString,
  asStringRecord,
} from './types'

function emptyState(): PersistedState {
  return {
    version: 2,
    initialized: false,
    announce: '',
    newAnimeDigest: '',
    newAnimeList: [],
    abemaInitialized: false,
    abemaScheduleDigest: '',
    abemaSchedule: [],
    abemaReleased: {},
  }
}

export class StateStore {
  state: PersistedState = emptyState()
  private saveQueue: Promise<void> = Promise.resolve()
  private saveSequence = 0

  constructor(
    private readonly file: string,
    private readonly logger: Logger,
  ) {}

  async load(): Promise<PersistedState> {
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      const data = asRecord(JSON.parse(raw))
      if (!data) throw new TypeError('state root must be an object')
      this.state = {
        version: 2,
        initialized: data.initialized === true || !!data.announce || !!data.newAnimeDigest,
        announce: asString(data.announce),
        newAnimeDigest: asString(data.newAnimeDigest),
        newAnimeList: asAnimeItems(data.newAnimeList),
        abemaInitialized: data.abemaInitialized === true || !!data.abemaScheduleDigest,
        abemaScheduleDigest: asString(data.abemaScheduleDigest),
        abemaSchedule: asAbemaAnimeItems(data.abemaSchedule),
        abemaReleased: asStringRecord(data.abemaReleased),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('無法讀取狀態檔案，將重新建立基線：%s', formatError(error))
      }
      this.state = emptyState()
    }
    return this.state
  }

  async save(): Promise<void> {
    this.saveQueue = this.saveQueue.catch(() => undefined).then(async () => {
      await fs.mkdir(dirname(this.file), { recursive: true })
      const sequence = this.saveSequence++
      const temporaryFile = `${this.file}.${process.pid}.${Date.now()}.${sequence}.tmp`
      await fs.writeFile(temporaryFile, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8')
      await fs.rename(temporaryFile, this.file)
    })
    return this.saveQueue
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
