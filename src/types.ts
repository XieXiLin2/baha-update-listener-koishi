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

export interface BahaVideoResponse extends UnknownRecord {
  data?: unknown
}

export interface PushTarget {
  platform: string
  channelId: string
  selfId?: string
  guildId?: string
}

export interface PersistedState {
  version: 1
  initialized: boolean
  announce: string
  newAnimeDigest: string
  newAnimeList: AnimeItem[]
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

