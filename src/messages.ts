import { h } from 'koishi'

import type { AnimeItem } from './types'
import type { DayKey } from './formatters'
import { formatOnAirItem, WEEKDAY_NAMES } from './formatters'

export function buildAnnouncementMessage(announcement: string): h.Fragment {
  return [
    h('b', {}, '巴哈姆特動畫瘋'),
    '\n',
    announcement,
    '\n\n#announcement #baha',
  ]
}

export function buildOnAirMessage(items: AnimeItem[]): h.Fragment {
  const content: h.Fragment = [h('b', {}, 'ON AIR >> [Baha]'), '\n']
  for (const item of items) {
    const info = formatOnAirItem(item)
    if (!info.videoSn) continue
    const videoUrl = `https://ani.gamer.com.tw/animeVideo.php?sn=${encodeURIComponent(info.videoSn)}`
    content.push(
      '\n- ',
      h('a', { href: videoUrl }, `[${info.timeText}] ${info.title}`),
      ' - ',
      h('a', { href: videoUrl }, info.volume),
    )
  }
  content.push('\n\n#baha')
  return content
}

export function buildScheduleMessage(
  day: DayKey,
  items: AnimeItem[],
  maxItems: number,
): h.Fragment {
  const content: h.Fragment = [h('b', {}, `【${WEEKDAY_NAMES[day]}】`)]
  for (const item of items.slice(0, maxItems)) {
    const title = String(item.title ?? '').trim() || '(無標題)'
    const rawTime = String(item.scheduleTime ?? '').trim()
    const timeText = /^\d{1,2}:\d{2}/.exec(rawTime)?.[0].padStart(5, '0') ?? '--:--'
    const videoSn = String(item.videoSn ?? item.video_sn ?? '').trim()
    const animeSn = String(item.animeSn ?? item.anime_sn ?? '').trim()
    const label = `[${timeText}] ${title}`

    content.push('\n- ')
    if (videoSn) {
      content.push(h('a', {
        href: `https://ani.gamer.com.tw/animeVideo.php?sn=${encodeURIComponent(videoSn)}`,
      }, label))
    } else {
      content.push(label)
    }
    if (animeSn) {
      content.push(' (', h('a', {
        href: `https://ani.gamer.com.tw/animeRef.php?sn=${encodeURIComponent(animeSn)}`,
      }, '詳情'), ')')
    }
  }

  if (!items.length) content.push('\n- 當天暫無排程')
  if (items.length > maxItems) content.push(`\n- 另有 ${items.length - maxItems} 項未顯示`)
  return content
}
