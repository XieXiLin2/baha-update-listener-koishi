import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

import type { Logger } from 'koishi'

import type { PersistedState } from './types'
import { asAnimeItems, asRecord, asString } from './types'

function emptyState(): PersistedState {
  return {
    version: 1,
    initialized: false,
    announce: '',
    newAnimeDigest: '',
    newAnimeList: [],
  }
}

export class StateStore {
  state: PersistedState = emptyState()

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
        version: 1,
        initialized: data.initialized === true || !!data.announce || !!data.newAnimeDigest,
        announce: asString(data.announce),
        newAnimeDigest: asString(data.newAnimeDigest),
        newAnimeList: asAnimeItems(data.newAnimeList),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('无法读取状态文件，将重新建立基线：%s', formatError(error))
      }
      this.state = emptyState()
    }
    return this.state
  }

  async save(): Promise<void> {
    await fs.mkdir(dirname(this.file), { recursive: true })
    const temporaryFile = `${this.file}.${process.pid}.${Date.now()}.tmp`
    await fs.writeFile(temporaryFile, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8')
    await fs.rename(temporaryFile, this.file)
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
