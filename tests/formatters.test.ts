import { describe, expect, it } from 'vitest'

import {
  currentDayKey,
  extractNewAnimeList,
  extractNewAnimeUpdates,
  extractSchedule,
  formatOnAirItem,
  latestBahaReleases,
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

  it('returns the newest playable entries up to the requested limit', () => {
    const latest = latestBahaReleases([
      { videoSn: 100, title: '作品 A', upTime: '2026-08-04', upTimeHours: '20:00' },
      { title: '沒有影片', upTime: '2026-08-05', upTimeHours: '23:00' },
      { videoSn: 300, title: '作品 C', upTime: '2026-08-05', upTimeHours: '21:00' },
      { videoSn: 200, title: '作品 B', upTime: '2026-08-05', upTimeHours: '18:00' },
    ], 2)

    expect(latest.map((item) => item.videoSn)).toEqual([300, 200])
  })

  it('formats the update date as month and day', () => {
    expect(formatOnAirItem({
      videoSn: 100,
      upTime: '2026-08-05 02:30:00',
      upTimeHours: '02:30',
    })).toMatchObject({
      dateText: '08/05',
      timeText: '02:30',
    })
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
