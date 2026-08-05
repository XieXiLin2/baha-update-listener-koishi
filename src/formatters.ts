import { createHash } from 'node:crypto'

import type { AnimeItem, BahaIndexResponse } from './types'
import { asAnimeItems, asRecord, asString } from './types'

export const WEEKDAY_NAMES = {
  '1': '週一',
  '2': '週二',
  '3': '週三',
  '4': '週四',
  '5': '週五',
  '6': '週六',
  '7': '週日',
} as const

export type DayKey = keyof typeof WEEKDAY_NAMES

export interface OnAirItem {
  title: string
  animeSn: string
  videoSn: string
  dateText: string
  timeText: string
  volume: string
}

export function extractAnnouncement(index: BahaIndexResponse): string {
  return asString(asRecord(index.data)?.announce)
}

export function extractNewAnimeList(index: BahaIndexResponse): AnimeItem[] {
  const newAnime = asRecord(index.data)?.newAnime
  if (Array.isArray(newAnime)) return asAnimeItems(newAnime)
  return asAnimeItems(asRecord(newAnime)?.date)
}

export function extractSchedule(index: BahaIndexResponse): Partial<Record<DayKey, AnimeItem[]>> {
  const rawSchedule = asRecord(asRecord(index.data)?.newAnimeSchedule)
  if (!rawSchedule) return {}

  const schedule: Partial<Record<DayKey, AnimeItem[]>> = {}
  for (const day of Object.keys(WEEKDAY_NAMES) as DayKey[]) {
    schedule[day] = asAnimeItems(rawSchedule[day])
  }
  return schedule
}

export function animeItemKey(item: AnimeItem): string {
  for (const key of ['videoSn', 'video_sn', 'animeSn', 'anime_sn', 'acgSn', 'acg_sn', 'title']) {
    const value = asString(item[key])
    if (value) return value
  }
  return stableStringify(item)
}

export function animeItemSignature(item: AnimeItem): [string, string, string, string] {
  return [
    animeItemKey(item),
    asString(item.volume ?? item.volumeString),
    asString(item.upTimeHours),
    asString(item.title),
  ]
}

export function newAnimeDigest(items: AnimeItem[]): string {
  const payload = items
    .map((item) => {
      const [key, volume, time, title] = animeItemSignature(item)
      return { key, volume, time, title }
    })
    .sort((left, right) => left.key.localeCompare(right.key))

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function extractNewAnimeUpdates(oldItems: AnimeItem[], newItems: AnimeItem[]): AnimeItem[] {
  const previous = new Map(oldItems.map((item) => [animeItemKey(item), animeItemSignature(item)]))
  return newItems.filter((item) => {
    const oldSignature = previous.get(animeItemKey(item))
    return !oldSignature || !signaturesEqual(oldSignature, animeItemSignature(item))
  })
}

export function sortOnAirItems(items: AnimeItem[]): AnimeItem[] {
  return [...items].sort((left, right) => {
    const leftKey = `${asString(left.upTime)}\u0000${asString(left.upTimeHours)}`
    const rightKey = `${asString(right.upTime)}\u0000${asString(right.upTimeHours)}`
    return rightKey.localeCompare(leftKey)
  })
}

export function latestBahaReleases(items: AnimeItem[], limit: number): AnimeItem[] {
  return sortOnAirItems(items)
    .filter((item) => asString(item.videoSn ?? item.video_sn))
    .slice(0, limit)
}

export function formatOnAirItem(item: AnimeItem): OnAirItem {
  return {
    title: asString(item.title) || '(無標題)',
    animeSn: asString(item.animeSn ?? item.anime_sn),
    videoSn: asString(item.videoSn ?? item.video_sn),
    dateText: formatBahaDate(asString(item.upTime)),
    timeText: asString(item.upTimeHours) || '--:--',
    volume: asString(item.volume ?? item.volumeString) || '?',
  }
}

function formatBahaDate(value: string): string {
  const match = /^(?:\d{4}[/-])?(\d{1,2})[/-](\d{1,2})/.exec(value)
  if (!match) return '--/--'
  return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}`
}

export function parseDayKey(raw?: string): DayKey | undefined {
  if (!raw) return
  const normalized = raw.trim().toLowerCase()
  const mapping: Record<string, DayKey> = {
    '1': '1', mon: '1', '周一': '1', '週一': '1', '星期一': '1',
    '2': '2', tue: '2', '周二': '2', '週二': '2', '星期二': '2',
    '3': '3', wed: '3', '周三': '3', '週三': '3', '星期三': '3',
    '4': '4', thu: '4', '周四': '4', '週四': '4', '星期四': '4',
    '5': '5', fri: '5', '周五': '5', '週五': '5', '星期五': '5',
    '6': '6', sat: '6', '周六': '6', '週六': '6', '星期六': '6',
    '7': '7', sun: '7', '周日': '7', '週日': '7', '星期日': '7',
  }
  return mapping[normalized]
}

export function currentDayKey(timezone: string, now = new Date()): DayKey {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
    .format(now)
    .toLowerCase()
  return parseDayKey(weekday) ?? '1'
}

export function assertValidTimezone(timezone: string): void {
  new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
}

function signaturesEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = asRecord(value)
  if (!record) return JSON.stringify(value) ?? String(value)
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}
