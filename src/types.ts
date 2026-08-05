export type UnknownRecord = Record<string, unknown>

export interface AnimeItem extends UnknownRecord {
  title?: unknown
  videoSn?: unknown
  video_sn?: unknown
  animeSn?: unknown
  anime_sn?: unknown
  acgSn?: unknown
  acg_sn?: unknown
  volume?: unknown
  volumeString?: unknown
  upTime?: unknown
  upTimeHours?: unknown
  scheduleTime?: unknown
}

export interface BahaIndexResponse extends UnknownRecord {
  data?: unknown
}

export interface PushTarget {
  platform: string
  channelId: string
  selfId?: string
  guildId?: string
}

export interface AbemaAnimeItem {
  key: string
  contentId: string
  episodeId: string
  seriesId: string
  title: string
  seriesTitle: string
  dateLabel: string
  releaseAt: number
  endAt: number
  contentType: 'program' | 'slot'
  availability: 'free' | 'premium' | 'unknown'
  badge: string
  image: string
}

export interface CrAnimeItem {
  key: string
  title: string
  seriesTitle: string
  episodeTitle: string
  episodeNumber: string
  dateKey: string
  releaseAt: number
  url: string
  seriesUrl: string
  availability: 'free' | 'premium' | 'unknown'
  premiere: boolean
  language: string
  image: string
}

export interface CrAnnouncementItem {
  key: string
  title: string
  summary: string
  publishedAt: number
  url: string
  author: string
  image: string
}

export interface PersistedState {
  version: 3
  initialized: boolean
  announce: string
  newAnimeDigest: string
  newAnimeList: AnimeItem[]
  abemaInitialized: boolean
  abemaScheduleDigest: string
  abemaSchedule: AbemaAnimeItem[]
  abemaReleased: Record<string, string>
  crInitialized: boolean
  crScheduleDigest: string
  crSchedule: CrAnimeItem[]
  crReleased: Record<string, string>
  crAnnouncementsInitialized: boolean
  crAnnouncementIds: string[]
}

export function asRecord(value: unknown): UnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  return value as UnknownRecord
}

export function asString(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

export function asAnimeItems(value: unknown): AnimeItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is AnimeItem => !!asRecord(item))
}

export function asAbemaAnimeItems(value: unknown): AbemaAnimeItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = asRecord(item)
    const key = asString(record?.key)
    const contentType = record?.contentType === 'slot' ? 'slot' : 'program'
    if (!record || !key) return []

    const availability = record.availability === 'free' || record.availability === 'premium'
      ? record.availability
      : 'unknown'
    return [{
      key,
      contentId: asString(record.contentId),
      episodeId: asString(record.episodeId),
      seriesId: asString(record.seriesId),
      title: asString(record.title),
      seriesTitle: asString(record.seriesTitle),
      dateLabel: asString(record.dateLabel),
      releaseAt: asFiniteNumber(record.releaseAt),
      endAt: asFiniteNumber(record.endAt),
      contentType,
      availability,
      badge: asString(record.badge),
      image: asString(record.image),
    }]
  })
}

export function asCrAnimeItems(value: unknown): CrAnimeItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const record = asRecord(item)
    const key = asString(record?.key)
    if (!record || !key) return []

    const availability = record.availability === 'free' || record.availability === 'premium'
      ? record.availability
      : 'unknown'
    return [{
      key,
      title: asString(record.title),
      seriesTitle: asString(record.seriesTitle),
      episodeTitle: asString(record.episodeTitle),
      episodeNumber: asString(record.episodeNumber),
      dateKey: asString(record.dateKey),
      releaseAt: asFiniteNumber(record.releaseAt),
      url: asString(record.url),
      seriesUrl: asString(record.seriesUrl),
      availability,
      premiere: record.premiere === true,
      language: asString(record.language),
      image: asString(record.image),
    }]
  })
}

export function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value)
  if (!record) return {}
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, item]) => [key, asString(item)] as const)
      .filter((entry) => entry[0] && entry[1]),
  )
}

export function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

function asFiniteNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
