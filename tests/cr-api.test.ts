import type { Context } from 'koishi'
import { describe, expect, it, vi } from 'vitest'

import { CrApiClient } from '../src/cr-api'

describe('CrApiClient', () => {
  it('keeps the release feed when the calendar page is blocked', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.endsWith('/rss/anime')) return '<rss>release feed</rss>'
      throw Object.assign(new Error('Forbidden'), { response: { status: 403 } })
    })
    const client = new CrApiClient({ get } as unknown as Context['http'], {
      requestTimeout: 20,
      userAgent: 'test',
    })

    await expect(client.fetchSchedule('2026-08-03')).resolves.toEqual({
      releaseFeedXml: '<rss>release feed</rss>',
      calendarHtml: '',
    })
  })
})
