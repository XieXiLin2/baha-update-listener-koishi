import { createHash } from 'node:crypto'

import { load } from 'cheerio'

import type { CrAnimeItem, CrAnnouncementItem } from './types'

const CR_ORIGIN = 'https://www.crunchyroll.com'

export function extractCrReleaseFeed(
  xml: string,
  timezone: string,
  now = new Date(),
): CrAnimeItem[] {
  const $ = load(xml, { xmlMode: true })
  const items: CrAnimeItem[] = []

  $('item').each((_, element) => {
    const item = $(element)
    const url = safeCrUrl(item.find('link').first().text())
    const mediaId = item.find('crunchyroll\\:mediaId').first().text().trim()
    const watchId = /\/watch\/([^/?#]+)/.exec(url)?.[1] ?? ''
    const key = watchId ? `watch:${watchId}` : mediaId ? `media:${mediaId}` : url
    if (!key) return

    const releaseAt = parseTimestamp(
      item.find('crunchyroll\\:premiumPubDate').first().text()
      || item.find('pubDate').first().text(),
    )
    const freeAt = parseTimestamp(item.find('crunchyroll\\:freePubDate').first().text())
    const seriesTitle = item.find('crunchyroll\\:seriesTitle').first().text().trim()
    const episodeTitle = item.find('crunchyroll\\:episodeTitle').first().text().trim()
    const rawTitle = item.find('title').first().text().trim()
    const image = safeCrUrl(
      item.find('media\\:thumbnail').first().attr('url')
      || item.find('enclosure').first().attr('url')
      || '',
    )

    items.push({
      key,
      title: seriesTitle || rawTitle || '(無標題)',
      seriesTitle,
      episodeTitle,
      episodeNumber: item.find('crunchyroll\\:episodeNumber').first().text().trim(),
      dateKey: releaseAt ? crDateKey(releaseAt, timezone) : '',
      releaseAt,
      url,
      seriesUrl: '',
      availability: freeAt > 0 && freeAt <= now.getTime() ? 'free' : 'premium',
      premiere: /\b(?:episode\s+1|premiere)\b/i.test(rawTitle),
      language: item.find('crunchyroll\\:subtitleLanguages').first().text().trim(),
      image,
    })
  })

  return deduplicateCrItems(items)
}

export function extractCrCalendar(
  html: string,
  weekStartDateKey: string,
  timezone: string,
): CrAnimeItem[] {
  if (!html.trim()) return []
  const $ = load(html)
  const items: CrAnimeItem[] = []

  $('.day').each((dayIndex, dayElement) => {
    const fallbackDateKey = addDateKey(weekStartDateKey, dayIndex)
    $(dayElement).find('article.release, .release.js-release').each((_, releaseElement) => {
      const release = $(releaseElement)
      const seriesLink = release
        .find('a.js-season-name-link, .season-name a, a[href*="/series/"]')
        .first()
      const episodeLink = release.find('a[href*="/watch/"]').first()
      const url = safeCrUrl(episodeLink.attr('href') || '')
      const seriesUrl = safeCrUrl(seriesLink.attr('href') || '')
      const watchId = /\/watch\/([^/?#]+)/.exec(url)?.[1] ?? ''
      const groupId = release.attr('data-group-id')?.trim() ?? ''
      const episodeNumber = release.attr('data-episode-num')?.trim() ?? ''
      const popoverUrl = release.attr('data-popover-url')?.trim() ?? ''
      const language = /([A-Z]{4})$/.exec(popoverUrl)?.[1] ?? ''
      const key = watchId
        ? `watch:${watchId}`
        : [groupId, episodeNumber, language, fallbackDateKey].filter(Boolean).join(':')
      if (!key) return

      const datetime = release.find('time[datetime]').first().attr('datetime') ?? ''
      const releaseAt = parseTimestamp(datetime)
      const dateKey = releaseAt ? crDateKey(releaseAt, timezone) : fallbackDateKey
      const slug = release.attr('data-slug')?.trim() ?? ''
      const seriesTitle = release.find('cite').first().text().trim()
        || seriesLink.text().trim()
        || titleFromSlug(slug)
      const episodeTitle = release
        .find('.episode-title, .episode-name, [itemprop="episode"] [itemprop="name"]')
        .first()
        .text()
        .trim()
      const image = safeCrUrl(
        release.find('img').first().attr('data-src')
        || release.find('img').first().attr('src')
        || '',
      )

      items.push({
        key,
        title: seriesTitle || '(無標題)',
        seriesTitle,
        episodeTitle,
        episodeNumber,
        dateKey,
        releaseAt,
        url,
        seriesUrl,
        availability: 'premium',
        premiere: /\bpremiere\b/i.test(release.text()),
        language,
        image,
      })
    })
  })

  return deduplicateCrItems(items)
}

export function mergeCrSchedule(...groups: CrAnimeItem[][]): CrAnimeItem[] {
  const merged = new Map<string, CrAnimeItem>()
  for (const item of groups.flat()) {
    const previous = merged.get(item.key)
    if (!previous) {
      merged.set(item.key, item)
      continue
    }
    merged.set(item.key, {
      ...previous,
      ...item,
      title: item.title || previous.title,
      seriesTitle: item.seriesTitle || previous.seriesTitle,
      episodeTitle: item.episodeTitle || previous.episodeTitle,
      episodeNumber: item.episodeNumber || previous.episodeNumber,
      dateKey: item.dateKey || previous.dateKey,
      releaseAt: item.releaseAt || previous.releaseAt,
      url: item.url || previous.url,
      seriesUrl: item.seriesUrl || previous.seriesUrl,
      language: item.language || previous.language,
      image: item.image || previous.image,
    })
  }
  return [...merged.values()].sort(compareCrItems)
}

export function crAnimeItemSignature(item: CrAnimeItem): string {
  return createHash('sha256').update(JSON.stringify({
    key: item.key,
    title: item.title,
    episodeTitle: item.episodeTitle,
    episodeNumber: item.episodeNumber,
    releaseAt: item.releaseAt,
    availability: item.availability,
    premiere: item.premiere,
  })).digest('hex')
}

export function crScheduleDigest(items: CrAnimeItem[]): string {
  const signatures = items
    .map((item) => [item.key, crAnimeItemSignature(item)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
  return createHash('sha256').update(JSON.stringify(signatures)).digest('hex')
}

export function extractCrReleases(
  items: CrAnimeItem[],
  released: Record<string, string>,
  now = new Date(),
): CrAnimeItem[] {
  return items.filter((item) => (
    item.releaseAt > 0
    && item.releaseAt <= now.getTime()
    && released[item.key] !== crAnimeItemSignature(item)
  ))
}

export function markCrReleases(
  released: Record<string, string>,
  items: CrAnimeItem[],
): void {
  for (const item of items) released[item.key] = crAnimeItemSignature(item)
}

export function latestCrReleases(
  items: CrAnimeItem[],
  limit: number,
  now = new Date(),
): CrAnimeItem[] {
  return [...items]
    .filter((item) => item.releaseAt > 0 && item.releaseAt <= now.getTime())
    .sort((left, right) => right.releaseAt - left.releaseAt)
    .slice(0, limit)
}

export function selectCrScheduleDate(
  items: CrAnimeItem[],
  dateKey: string,
): CrAnimeItem[] {
  return items.filter((item) => item.dateKey === dateKey).sort(compareCrItems)
}

export function parseCrDateArgument(
  rawDate: string | undefined,
  timezone: string,
  now = new Date(),
): string | undefined {
  const raw = rawDate?.trim().toLowerCase()
  const today = crDateKey(now.getTime(), timezone)
  if (!raw || ['today', '今天', '今日'].includes(raw)) return today
  if (['tomorrow', '明天', '明日'].includes(raw)) return addDateKey(today, 1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return isValidDateKey(raw) ? raw : undefined

  const match = /^(\d{1,2})[/-](\d{1,2})$/.exec(raw)
  if (!match) return
  const month = Number(match[1])
  const day = Number(match[2])
  const currentYear = Number(today.slice(0, 4))
  const candidates = [currentYear - 1, currentYear, currentYear + 1]
    .map((year) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    .filter(isValidDateKey)
  return candidates.sort((left, right) => (
    Math.abs(Date.parse(left) - now.getTime()) - Math.abs(Date.parse(right) - now.getTime())
  ))[0]
}

export function crWeekStartDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  const weekday = date.getUTCDay()
  return addDateKey(dateKey, weekday === 0 ? -6 : 1 - weekday)
}

export function extractCrAnnouncements(xml: string): CrAnnouncementItem[] {
  const $ = load(xml, { xmlMode: true })
  const items: CrAnnouncementItem[] = []

  $('item').each((_, element) => {
    const item = $(element)
    const categories = item.find('category').map((__, category) => $(category).text().trim()).get()
    if (!categories.some((category) => category.toLowerCase() === 'announcements')) return

    const url = safeCrUrl(item.find('link').first().text())
    const title = item.find('title').first().text().trim()
    const key = url || `${title}:${item.find('pubDate').first().text().trim()}`
    if (!key || !title) return

    items.push({
      key,
      title,
      summary: plainText(item.find('description').first().text()),
      publishedAt: parseTimestamp(item.find('pubDate').first().text()),
      url,
      author: item.find('author').first().text().trim(),
      image: safeCrUrl(item.find('media\\:thumbnail').first().attr('url') || ''),
    })
  })

  return items.sort((left, right) => right.publishedAt - left.publishedAt)
}

export function formatCrTime(timestamp: number, timezone: string): string {
  if (!timestamp) return '--:--'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp))
}

function deduplicateCrItems(items: CrAnimeItem[]): CrAnimeItem[] {
  const result = new Map<string, CrAnimeItem>()
  for (const item of items) if (!result.has(item.key)) result.set(item.key, item)
  return [...result.values()].sort(compareCrItems)
}

function compareCrItems(left: CrAnimeItem, right: CrAnimeItem): number {
  if (!left.releaseAt && right.releaseAt) return 1
  if (left.releaseAt && !right.releaseAt) return -1
  return left.releaseAt - right.releaseAt || left.title.localeCompare(right.title)
}

function crDateKey(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const value = (type: Intl.DateTimeFormatPartTypes): string => (
    parts.find((part) => part.type === type)?.value ?? ''
  )
  return `${value('year')}-${value('month')}-${value('day')}`
}

function addDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function isValidDateKey(dateKey: string): boolean {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateKey
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function titleFromSlug(slug: string): string {
  return slug.split('-').filter(Boolean).map((word) => (
    word.charAt(0).toUpperCase() + word.slice(1)
  )).join(' ')
}

function plainText(value: string): string {
  return load(value).text().replace(/\s+/g, ' ').trim()
}

function safeCrUrl(value: string): string {
  if (!value.trim()) return ''
  try {
    const url = new URL(value.trim(), CR_ORIGIN)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    if (url.hostname !== 'crunchyroll.com' && !url.hostname.endsWith('.crunchyroll.com')) return ''
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return ''
  }
}
