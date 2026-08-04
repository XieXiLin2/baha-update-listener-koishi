import { describe, expect, it } from 'vitest'

import {
  currentDayKey,
  extractNewAnimeList,
  extractNewAnimeUpdates,
  extractSchedule,
  formatVideoDetail,
  newAnimeDigest,
  parseDayKey,
} from '../src/formatters'

describe('index data extraction', () => {
  it('accepts both nested and legacy newAnime arrays', () => {
    expect(extractNewAnimeList({ data: { newAnime: { date: [{ videoSn: 1 }] } } }))
      .toEqual([{ videoSn: 1 }])
    expect(extractNewAnimeList({ data: { newAnime: [{ videoSn: 2 }] } }))
      .toEqual([{ videoSn: 2 }])
  })

  it('keeps only valid schedule arrays', () => {
    expect(extractSchedule({
      data: {
        newAnimeSchedule: {
          1: [{ title: 'A' }, null],
          2: 'invalid',
        },
      },
    })).toEqual({
      1: [{ title: 'A' }],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    })
  })
})

describe('ON AIR change detection', () => {
  const first = {
    videoSn: 100,
    title: '作品 A',
    volume: '第 1 集',
    upTimeHours: '12:00',
  }

  it('ignores source order and noisy fields in the digest', () => {
    const second = { videoSn: 200, title: '作品 B', volume: '第 3 集', upTimeHours: '18:00' }
    expect(newAnimeDigest([first, second])).toBe(newAnimeDigest([
      { ...second, advertisement: 'changed' },
      { ...first, irrelevant: 42 },
    ]))
  })

  it('returns added and user-visible changed entries only', () => {
    const updates = extractNewAnimeUpdates(
      [first, { videoSn: 200, title: '作品 B', volume: '第 2 集', upTimeHours: '18:00' }],
      [
        { ...first, advertisement: 'changed' },
        { videoSn: 200, title: '作品 B', volume: '第 3 集', upTimeHours: '18:00' },
        { videoSn: 300, title: '作品 C', volume: '第 1 集', upTimeHours: '20:00' },
      ],
    )
    expect(updates.map((item) => item.videoSn)).toEqual([200, 300])
  })
})

describe('weekday parsing', () => {
  it('accepts numeric, English, simplified and traditional aliases', () => {
    expect(parseDayKey('5')).toBe('5')
    expect(parseDayKey('Fri')).toBe('5')
    expect(parseDayKey('周五')).toBe('5')
    expect(parseDayKey('週五')).toBe('5')
    expect(parseDayKey('星期五')).toBe('5')
    expect(parseDayKey('noday')).toBeUndefined()
  })

  it('uses the configured timezone for the default day', () => {
    const nearMidnight = new Date('2026-08-02T23:30:00.000Z')
    expect(currentDayKey('UTC', nearMidnight)).toBe('7')
    expect(currentDayKey('Asia/Taipei', nearMidnight)).toBe('1')
  })
})

describe('video detail formatting', () => {
  it('normalizes titles, episode numbers and airing status', () => {
    const detail = formatVideoDetail({
      data: {
        video: {
          title: '测试番剧 [9]',
          video_sn: 99,
          duration: 24,
          quality: '1080p',
        },
        anime: {
          anime_sn: 10,
          volume_index: 8,
          total_volume: 12,
          season_end: '2026-09-01',
          tags: ['奇幻', '冒险'],
        },
      },
    }, 'Asia/Taipei', new Date('2026-08-05T00:00:00.000Z'))

    expect(detail.title).toBe('测试番剧')
    expect(detail.videoSn).toBe('99')
    expect(detail.animeSn).toBe('10')
    expect(detail.lines).toContain('集数：第 9 集 / 连载中')
    expect(detail.lines).toContain('标签：奇幻、冒险')
  })
})

