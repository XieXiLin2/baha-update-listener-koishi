import { h } from 'koishi'

import { formatCrTime } from './cr-formatters'
import type { CrAnimeItem, CrAnnouncementItem } from './types'

export function buildCrUpdateMessage(
  items: CrAnimeItem[],
  maxItems: number,
  timezone: string,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, 'ON AIR >> [CR]'), '\n']
  appendCrAnimeItems(content, items, maxItems, timezone)
  content.push('\n\n#cr')
  return content
}

export function buildCrScheduleMessage(
  dateKey: string,
  items: CrAnimeItem[],
  maxItems: number,
  timezone: string,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, `【CR ${dateKey}】`)]
  appendCrAnimeItems(content, items, maxItems, timezone)
  if (!items.length) content.push('\n- 當天排程尚未公布或目前沒有更新')
  return content
}

export function buildCrLatestMessage(
  items: CrAnimeItem[],
  maxItems: number,
  timezone: string,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, 'CR 最近更新')]
  appendCrAnimeItems(content, items, maxItems, timezone)
  if (!items.length) content.push('\n- 目前沒有可顯示的更新')
  return content
}

export function buildCrAnnouncementMessage(
  items: CrAnnouncementItem[],
  maxItems: number,
  timezone: string,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, 'ANNOUNCEMENT >> [CR]')]
  for (const item of items.slice(0, maxItems)) {
    const label = `[${formatCrTime(item.publishedAt, timezone)}] ${item.title}`
    content.push('\n- ')
    if (item.url) content.push(h('a', { href: item.url }, label))
    else content.push(label)
    if (item.summary) content.push(`\n  ${item.summary}`)
  }
  if (!items.length) content.push('\n- 目前沒有公告')
  if (items.length > maxItems) content.push(`\n- 另有 ${items.length - maxItems} 項未顯示`)
  content.push('\n\n#announcement #cr')
  return content
}

function appendCrAnimeItems(
  content: Array<string | h>,
  items: CrAnimeItem[],
  maxItems: number,
  timezone: string,
): void {
  for (const item of items.slice(0, maxItems)) {
    const title = item.seriesTitle || item.title || '(無標題)'
    const episode = item.episodeNumber
      ? `第 ${item.episodeNumber} 集`
      : item.episodeTitle || ''
    const label = `[${formatCrTime(item.releaseAt, timezone)}] ${title}${episode ? ` - ${episode}` : ''}`
    const availability = item.availability === 'free'
      ? ' [免費]'
      : item.availability === 'premium' ? ' [會員]' : ''
    const premiere = item.premiere ? ' [首播]' : ''
    const href = item.url || item.seriesUrl

    content.push('\n- ')
    if (href) content.push(h('a', { href }, label))
    else content.push(label)
    content.push(availability, premiere)
    if (item.episodeTitle && item.episodeTitle !== episode) content.push(` ${item.episodeTitle}`)
  }
  if (items.length > maxItems) content.push(`\n- 另有 ${items.length - maxItems} 項未顯示`)
}
