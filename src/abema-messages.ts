import { h } from 'koishi'

import { formatAbemaTime } from './abema-formatters'
import type { AbemaAnimeItem } from './types'

export function buildAbemaUpdateMessage(
  items: AbemaAnimeItem[],
  maxItems: number,
  timezone: string,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, 'ON AIR >> [ABEMA]'), '\n']
  appendAnimeItems(content, items, maxItems, timezone)
  content.push('\n\n#abema')
  return content
}

export function buildAbemaScheduleMessage(
  dateKey: string,
  items: AbemaAnimeItem[],
  maxItems: number,
  timezone: string,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, `【ABEMA ${dateKey}】`)]
  appendAnimeItems(content, items, maxItems, timezone)
  if (!items.length) content.push('\n- 當天暫無新作動畫排程')
  return content
}

export function buildAbemaLatestMessage(
  items: AbemaAnimeItem[],
  maxItems: number,
  timezone: string,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, 'ABEMA 最近更新')]
  appendAnimeItems(content, items, maxItems, timezone)
  if (!items.length) content.push('\n- 目前沒有可顯示的更新')
  return content
}

function appendAnimeItems(
  content: Array<string | h>,
  items: AbemaAnimeItem[],
  maxItems: number,
  timezone: string,
): void {
  for (const item of items.slice(0, maxItems)) {
    const href = item.episodeId
      ? `https://abema.tv/video/episode/${encodeURIComponent(item.episodeId)}`
      : `https://abema.tv/video/title/${encodeURIComponent(item.seriesId)}`
    const availability = item.availability === 'free'
      ? ' [免費]'
      : item.availability === 'premium' ? ' [會員]' : ''
    const badge = item.badge ? ` [${item.badge}]` : ''
    content.push(
      '\n- ',
      h('a', { href }, `[${formatAbemaTime(item.releaseAt, timezone)}] ${item.title}`),
      availability,
      badge,
    )
  }
  if (items.length > maxItems) content.push(`\n- 另有 ${items.length - maxItems} 項未顯示`)
}
