import { createHash } from 'node:crypto'

import type { AnimeItem, BahaIndexResponse, BahaVideoResponse } from './types'
import { asAnimeItems, asRecord, asString } from './types'

export const WEEKDAY_NAMES = {
  '1': '周一',
  '2': '周二',
  '3': '周三',
  '4': '周四',
  '5': '周五',
  '6': '周六',
  '7': '周日',
} as const

export type DayKey = keyof typeof WEEKDAY_NAMES

export interface OnAirItem {
  title: string
  animeSn: string
  videoSn: string
  timeText: string
  volume: string
}

export interface VideoDetail {
  title: string
  cover: string
  videoSn: string
  animeSn: string
  lines: string[]
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

export function formatOnAirItem(item: AnimeItem): OnAirItem {
  return {
    title: asString(item.title) || '(无标题)',
    animeSn: asString(item.animeSn ?? item.anime_sn),
    videoSn: asString(item.videoSn ?? item.video_sn),
    timeText: asString(item.upTimeHours) || '--:--',
    volume: asString(item.volume ?? item.volumeString) || '?',
  }
}

export function formatVideoDetail(
  response: BahaVideoResponse,
  timezone: string,
  now = new Date(),
): VideoDetail {
  const data = asRecord(response.data)
  const video = asRecord(data?.video) ?? {}
  const anime = asRecord(data?.anime) ?? {}
  const title = cleanTitle(asString(video.title ?? anime.title) || '(无标题)')
  const cover = asString(video.cover ?? anime.cover)
  const videoSn = asString(video.video_sn ?? video.videoSn)
  const animeSn = asString(anime.anime_sn ?? anime.animeSn)
  const lines: string[] = []

  if (video.duration !== undefined && video.duration !== null) {
    lines.push(`时长：${String(video.duration)} 分钟`)
  }
  if (asString(video.quality)) lines.push(`画质：${asString(video.quality)}`)
  if (asString(anime.upload_time)) lines.push(`更新时间：${asString(anime.upload_time)}`)

  const volumeIndex = toFiniteNumber(anime.volume_index)
  const totalVolume = toFiniteNumber(anime.total_volume)
  if (volumeIndex !== undefined && totalVolume !== undefined) {
    const seasonEnd = asString(anime.season_end)
    const status = isAiring(seasonEnd, timezone, now) ? '连载中' : `共 ${totalVolume} 集`
    lines.push(`集数：第 ${volumeIndex + 1} 集 / ${status}`)
  }

  if (asString(anime.publisher)) lines.push(`发行：${asString(anime.publisher)}`)
  if (asString(anime.maker)) lines.push(`制作：${asString(anime.maker)}`)
  if (anime.score !== undefined && anime.score !== null) lines.push(`评分：${String(anime.score)}`)

  const tags = Array.isArray(anime.tags) ? anime.tags.map(asString).filter(Boolean) : []
  if (tags.length) lines.push(`标签：${tags.join('、')}`)
  if (asString(video.rating_desc)) lines.push(`分级：${asString(video.rating_desc)}`)

  const content = asString(anime.content)
  if (content) {
    const summary = content.length > 450 ? `${content.slice(0, 450)}...` : content
    lines.push('', '简介', summary)
  }

  return { title, cover, videoSn, animeSn, lines }
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

function cleanTitle(title: string): string {
  return title.replace(/\s*\[\d+]\s*$/, '').trim()
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function isAiring(seasonEnd: string, timezone: string, now: Date): boolean {
  const match = /^(\d{4})[/-](\d{2})[/-](\d{2})$/.exec(seasonEnd)
  if (!match) return false
  const endKey = `${match[1]}-${match[2]}-${match[3]}`
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const todayKey = `${value('year')}-${value('month')}-${value('day')}`
  return endKey >= todayKey
}

