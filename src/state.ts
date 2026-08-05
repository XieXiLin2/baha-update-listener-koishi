import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

import type { Logger } from 'koishi'

import type { PersistedState } from './types'
import {
  asAbemaAnimeItems,
  asAnimeItems,
  asCrAnimeItems,
  asRecord,
  asString,
  asStringRecord,
  asStrings,
  asSubscriptionOverrides,
} from './types'

function emptyState(): PersistedState {
  return {
    version: 4,
    initialized: false,
    announce: '',
    newAnimeDigest: '',
    newAnimeList: [],
    abemaInitialized: false,
    abemaScheduleDigest: '',
    abemaSchedule: [],
    abemaReleased: {},
    crInitialized: false,
    crScheduleDigest: '',
    crSchedule: [],
    crReleased: {},
    crAnnouncementsInitialized: false,
    crAnnouncementIds: [],
    subscriptionOverrides: {},
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
        version: 4,
        initialized: data.initialized === true || !!data.announce || !!data.newAnimeDigest,
        announce: asString(data.announce),
        newAnimeDigest: asString(data.newAnimeDigest),
        newAnimeList: asAnimeItems(data.newAnimeList),
        abemaInitialized: data.abemaInitialized === true || !!data.abemaScheduleDigest,
        abemaScheduleDigest: asString(data.abemaScheduleDigest),
        abemaSchedule: asAbemaAnimeItems(data.abemaSchedule),
        abemaReleased: asStringRecord(data.abemaReleased),
        crInitialized: data.crInitialized === true || !!data.crScheduleDigest,
        crScheduleDigest: asString(data.crScheduleDigest),
        crSchedule: asCrAnimeItems(data.crSchedule),
        crReleased: asStringRecord(data.crReleased),
        crAnnouncementsInitialized: data.crAnnouncementsInitialized === true
          || asStrings(data.crAnnouncementIds).length > 0,
        crAnnouncementIds: asStrings(data.crAnnouncementIds),
        subscriptionOverrides: asSubscriptionOverrides(data.subscriptionOverrides),
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
