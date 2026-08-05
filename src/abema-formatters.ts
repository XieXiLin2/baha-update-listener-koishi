import { createHash } from 'node:crypto'

import type { AbemaModulesResponse } from './abema-api'
import type { AbemaAnimeItem } from './types'
import { asRecord, asString } from './types'

const ANIME_SCHEDULE_MODULE_ID = 'CHDCPxRFZ8vxTh'
const ABEMA_TIMEZONE = 'Asia/Tokyo'

export function extractAbemaAnimeSchedule(
  response: AbemaModulesResponse,
  now = new Date(),
): AbemaAnimeItem[] {
  const modules = Array.isArray(response.modules) ? response.modules : []
  const scheduleModule = modules
    .map(asRecord)
    .find((module) => module?.id === ANIME_SCHEDULE_MODULE_ID)
    ?? modules
      .map(asRecord)
      .find((module) => (
        asString(module?.itemUiType) === 'ITEM_UI_TYPE_TAB_VIEW_V2'
        && asString(module?.nameFormat).includes('アニメ')
        && asString(module?.nameFormat).includes('スケジュール')
      ))
  const groups = Array.isArray(scheduleModule?.items) ? scheduleModule.items : []
  const items: AbemaAnimeItem[] = []

  for (const groupValue of groups) {
    const tabView = asRecord(asRecord(groupValue)?.tabView)
    const dateLabel = asString(tabView?.displayName)
    const dateReleaseAt = parseAbemaDateLabel(dateLabel, now)
    const tabItems = Array.isArray(tabView?.tabViewItems) ? tabView.tabViewItems : []

    for (const itemValue of tabItems) {
      const item = normalizeScheduleItem(itemValue, dateLabel, dateReleaseAt)
      if (item) items.push(item)
    }
  }

  return deduplicate(items).sort((left, right) => (
    left.releaseAt - right.releaseAt || left.title.localeCompare(right.title)
  ))
}

export function abemaAnimeItemSignature(item: AbemaAnimeItem): string {
  return createHash('sha256').update(JSON.stringify({
    key: item.key,
    title: item.title,
    seriesTitle: item.seriesTitle,
    releaseAt: item.releaseAt,
    availability: item.availability,
    badge: item.badge,
  })).digest('hex')
}

export function abemaScheduleDigest(items: AbemaAnimeItem[]): string {
  const signatures = items
    .map((item) => [item.key, abemaAnimeItemSignature(item)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
  return createHash('sha256').update(JSON.stringify(signatures)).digest('hex')
}

export function extractAbemaReleases(
  items: AbemaAnimeItem[],
  released: Record<string, string>,
  now = new Date(),
): AbemaAnimeItem[] {
  return items.filter((item) => (
    item.releaseAt > 0
    && item.releaseAt <= now.getTime()
    && released[item.key] !== abemaAnimeItemSignature(item)
  ))
}

export function markAbemaReleases(
  released: Record<string, string>,
  items: AbemaAnimeItem[],
): void {
  for (const item of items) released[item.key] = abemaAnimeItemSignature(item)
}

export function selectAbemaScheduleDate(
  items: AbemaAnimeItem[],
  rawDate: string | undefined,
  now = new Date(),
): { dateKey: string; items: AbemaAnimeItem[] } | undefined {
  const dateKey = parseDateArgument(rawDate, now)
  if (!dateKey) return
  return {
    dateKey,
    items: items.filter((item) => abemaDateKey(item.releaseAt) === dateKey),
  }
}

export function latestAbemaReleases(
  items: AbemaAnimeItem[],
  limit: number,
  now = new Date(),
): AbemaAnimeItem[] {
  return [...items]
    .filter((item) => item.releaseAt > 0 && item.releaseAt <= now.getTime())
    .sort((left, right) => right.releaseAt - left.releaseAt)
    .slice(0, limit)
}

export function formatAbemaTime(
  timestamp: number,
  timezone: string,
  includeDate = true,
): string {
  if (!timestamp) return '--:--'
  if (!includeDate) {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(timestamp))
  }
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp))
}

export function seriesIdFromEpisodeId(episodeId: string): string {
  return /^(.+)_s[^_]+_p[^_]+$/.exec(episodeId)?.[1] ?? ''
}

function normalizeScheduleItem(
  value: unknown,
  dateLabel: string,
  dateReleaseAt: number,
): AbemaAnimeItem | undefined {
  const item = asRecord(value)
  const rawContentType = asString(item?.contentType)
  const contentType = rawContentType === 'CONTENT_TYPE_PROGRAM'
    ? 'program'
    : rawContentType === 'CONTENT_TYPE_SLOT' ? 'slot' : undefined
  const contentId = asString(item?.contentId)
  if (!item || !contentType || !contentId) return

  const creativeUrl = asString(item.creativeUrl)
  const episodeId = contentType === 'program' ? contentId : episodeIdFromImage(creativeUrl)
  const seriesId = seriesIdFromEpisodeId(episodeId)
  const rawTitle = asString(item.displayName)
  const contentGroupTitle = asString(item.contentGroupTitle)
  const description = asString(item.description)
  const seriesTitle = contentGroupTitle
    || (!/^\d{1,2}:\d{2}\s*[〜~-]/.test(description) ? description : '')
    || stripEpisodePrefix(rawTitle)
  const viewingType = asString(asRecord(item.viewingAuthority)?.viewingType)
  const releaseAt = contentType === 'slot' ? toMilliseconds(item.startAt) : dateReleaseAt
  const key = episodeId ? `episode:${episodeId}` : `slot:${contentId}`

  return {
    key,
    contentId,
    episodeId,
    seriesId,
    title: rawTitle || seriesTitle || '(無標題)',
    seriesTitle,
    dateLabel,
    releaseAt,
    endAt: toMilliseconds(item.endAt),
    contentType,
    availability: viewingType.includes('FREE')
      ? 'free'
      : viewingType.includes('PREMIUM') ? 'premium' : 'unknown',
    badge: asString(item.label),
    image: creativeUrl,
  }
}

function deduplicate(items: AbemaAnimeItem[]): AbemaAnimeItem[] {
  const result = new Map<string, AbemaAnimeItem>()
  for (const item of items) {
    const previous = result.get(item.key)
    if (!previous || item.releaseAt < previous.releaseAt) result.set(item.key, item)
  }
  return [...result.values()]
}

function episodeIdFromImage(url: string): string {
  const encoded = /\/image\/programs\/([^/?]+)/.exec(url)?.[1]
  if (!encoded) return ''
  try {
    return decodeURIComponent(encoded)
  } catch {
    return encoded
  }
}

function stripEpisodePrefix(title: string): string {
  return title.replace(/^#?\d+(?:\.\d+)?(?:話)?\s+/, '').trim()
}

function parseAbemaDateLabel(label: string, now: Date): number {
  const match = /^(\d{1,2})\/(\d{1,2})/.exec(label)
  if (!match) return 0
  const month = Number(match[1])
  const day = Number(match[2])
  const currentYear = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: ABEMA_TIMEZONE,
    year: 'numeric',
  }).format(now))
  const candidates = [currentYear - 1, currentYear, currentYear + 1]
    .map((year) => Date.UTC(year, month - 1, day, -9))
  return candidates.reduce((closest, candidate) => (
    Math.abs(candidate - now.getTime()) < Math.abs(closest - now.getTime()) ? candidate : closest
  ))
}

function parseDateArgument(rawDate: string | undefined, now: Date): string | undefined {
  const raw = rawDate?.trim().toLowerCase()
  if (!raw || ['today', '今天', '今日'].includes(raw)) return abemaDateKey(now.getTime())
  if (['tomorrow', '明天', '明日'].includes(raw)) return abemaDateKey(now.getTime() + 86_400_000)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const match = /^(\d{1,2})[/-](\d{1,2})$/.exec(raw)
  if (!match) return
  const timestamp = parseAbemaDateLabel(`${match[1]}/${match[2]}`, now)
  return timestamp ? abemaDateKey(timestamp) : undefined
}

function abemaDateKey(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ABEMA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const value = (type: Intl.DateTimeFormatPartTypes): string => (
    parts.find((part) => part.type === type)?.value ?? ''
  )
  return `${value('year')}-${value('month')}-${value('day')}`
}

function toMilliseconds(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return number < 10_000_000_000 ? number * 1000 : number
}
