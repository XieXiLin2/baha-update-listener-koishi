import { describe, expect, it } from 'vitest'

import type { AbemaAnimeItem } from '../src/types'
import {
  abemaAnimeItemSignature,
  abemaScheduleDigest,
  extractAbemaAnimeSchedule,
  extractAbemaReleases,
  latestAbemaReleases,
  markAbemaReleases,
  selectAbemaScheduleDate,
} from '../src/abema-formatters'

const now = new Date('2026-08-05T04:00:00.000Z')

describe('ABEMA anime schedule formatting', () => {
  it('normalizes on-demand programs and broadcast slots', () => {
    const items = extractAbemaAnimeSchedule(scheduleResponse([
      {
        displayName: '#5 測試動畫',
        description: '測試動畫',
        label: '最速配信',
        contentType: 'CONTENT_TYPE_PROGRAM',
        contentId: '100-1_s1_p5',
        creativeUrl: 'https://image.example/program.png',
        viewingAuthority: { viewingType: 'VIEWING_TYPE_FREE' },
      },
      {
        displayName: '#3 直播動畫',
        description: '23:30 〜',
        contentType: 'CONTENT_TYPE_SLOT',
        contentId: 'slot-3',
        contentGroupTitle: '直播動畫',
        startAt: 1_785_900_600,
        creativeUrl: 'https://image.p-c2-x.abema-tv.com/image/programs/200-2_s1_p3/thumb001.png',
        viewingAuthority: { viewingType: 'VIEWING_TYPE_PREMIUM' },
      },
    ]), now)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      key: 'episode:100-1_s1_p5',
      seriesId: '100-1',
      contentType: 'program',
      availability: 'free',
      badge: '最速配信',
    })
    expect(items[1]).toMatchObject({
      key: 'episode:200-2_s1_p3',
      episodeId: '200-2_s1_p3',
      seriesTitle: '直播動畫',
      contentType: 'slot',
      availability: 'premium',
      releaseAt: 1_785_900_600_000,
    })
  })

  it('tracks only newly released or visibly changed entries', () => {
    const items = extractAbemaAnimeSchedule(scheduleResponse([{
      displayName: '#5 測試動畫',
      description: '測試動畫',
      contentType: 'CONTENT_TYPE_PROGRAM',
      contentId: '100-1_s1_p5',
      viewingAuthority: { viewingType: 'VIEWING_TYPE_FREE' },
    }]), now)
    const released: Record<string, string> = {}

    expect(extractAbemaReleases(items, released, now)).toEqual(items)
    markAbemaReleases(released, items)
    expect(released[items[0].key]).toBe(abemaAnimeItemSignature(items[0]))
    expect(extractAbemaReleases(items, released, now)).toEqual([])
    expect(extractAbemaReleases([{ ...items[0], title: '#5 修正標題' }], released, now))
      .toHaveLength(1)
  })

  it('keeps digests order-independent and selects Japanese calendar dates', () => {
    const items = extractAbemaAnimeSchedule(scheduleResponse([
      { displayName: '#1 A', contentType: 'CONTENT_TYPE_PROGRAM', contentId: '1-1_s1_p1' },
      { displayName: '#2 B', contentType: 'CONTENT_TYPE_PROGRAM', contentId: '2-2_s1_p2' },
    ]), now)
    expect(abemaScheduleDigest(items)).toBe(abemaScheduleDigest([...items].reverse()))
    expect(selectAbemaScheduleDate(items, '今天', now)).toMatchObject({
      dateKey: '2026-08-05',
      items: expect.arrayContaining(items),
    })
    expect(selectAbemaScheduleDate(items, 'invalid', now)).toBeUndefined()
  })

  it('returns recently released entries newest-first and respects the limit', () => {
    const items: AbemaAnimeItem[] = [
      abemaItem('old', now.getTime() - 2_000),
      abemaItem('new', now.getTime() - 1_000),
      abemaItem('future', now.getTime() + 1_000),
    ]
    expect(latestAbemaReleases(items, 1, now).map((item) => item.key))
      .toEqual(['new'])
  })
})

function abemaItem(key: string, releaseAt: number): AbemaAnimeItem {
  return {
    key,
    contentId: key,
    episodeId: key,
    seriesId: key,
    title: key,
    seriesTitle: key,
    dateLabel: '',
    releaseAt,
    endAt: 0,
    contentType: 'program',
    availability: 'unknown',
    badge: '',
    image: '',
  }
}

function scheduleResponse(tabViewItems: unknown[]) {
  return {
    modules: [{
      id: 'CHDCPxRFZ8vxTh',
      nameFormat: '新作アニメ配信スケジュール',
      itemUiType: 'ITEM_UI_TYPE_TAB_VIEW_V2',
      items: [{ tabView: { displayName: '8/5 水', tabViewItems } }],
    }],
  }
}
