import { describe, expect, it } from 'vitest'

import {
  crWeekStartDateKey,
  extractCrAnnouncements,
  extractCrCalendar,
  extractCrReleaseFeed,
  extractCrReleases,
  latestCrReleases,
  markCrReleases,
  parseCrDateArgument,
  selectCrScheduleDate,
} from '../src/cr-formatters'

const now = new Date('2026-08-05T04:30:00.000Z')

describe('CR release formatting', () => {
  it('parses the official anime RSS fields and release time', () => {
    const items = extractCrReleaseFeed(releaseFeedXml([
      releaseItem('GTEST0001', '2026-08-05T04:00:00.000Z'),
    ]), 'Asia/Taipei', now)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      key: 'watch:GTEST0001',
      seriesTitle: '測試動畫',
      episodeTitle: '新的開始',
      episodeNumber: '2',
      dateKey: '2026-08-05',
      releaseAt: Date.parse('2026-08-05T04:00:00.000Z'),
      availability: 'premium',
    })
  })

  it('tracks unseen releases and returns latest entries newest-first', () => {
    const items = extractCrReleaseFeed(releaseFeedXml([
      releaseItem('GTEST0001', '2026-08-05T03:00:00.000Z'),
      releaseItem('GTEST0002', '2026-08-05T04:00:00.000Z'),
      releaseItem('GTEST0003', '2026-08-05T05:00:00.000Z'),
    ]), 'Asia/Taipei', now)
    const released: Record<string, string> = {}

    expect(latestCrReleases(items, 1, now).map((item) => item.key))
      .toEqual(['watch:GTEST0002'])
    expect(extractCrReleases(items, released, now)).toHaveLength(2)
    markCrReleases(released, items.slice(0, 2))
    expect(extractCrReleases(items, released, now)).toEqual([])
  })

  it('parses calendar entries and groups them by configured timezone', () => {
    const items = extractCrCalendar(`
      <div class="day">
        <article class="release js-release" data-episode-num="1" data-group-id="GSERIES" data-popover-url="/simulcastcalendar/popover/GSEASONJAJP">
          <time datetime="2026-08-05T04:00:00.000Z">4:00am</time>
          <h1 class="season-name"><a class="js-season-name-link" href="/series/GSERIES/test"><cite>測試動畫</cite></a></h1>
          <a href="/watch/GCALENDAR1/start">Episode 1 Available</a>
          <span class="episode-title">新的開始</span>
          <strong>Premiere</strong>
        </article>
      </div>
    `, '2026-08-03', 'Asia/Taipei')

    expect(selectCrScheduleDate(items, '2026-08-05')).toHaveLength(1)
    expect(items[0]).toMatchObject({
      key: 'watch:GCALENDAR1',
      language: 'JAJP',
      premiere: true,
      seriesTitle: '測試動畫',
    })
  })

  it('parses date aliases and calculates a Monday week start', () => {
    expect(parseCrDateArgument('今天', 'Asia/Taipei', now)).toBe('2026-08-05')
    expect(parseCrDateArgument('明天', 'Asia/Taipei', now)).toBe('2026-08-06')
    expect(parseCrDateArgument('8/7', 'Asia/Taipei', now)).toBe('2026-08-07')
    expect(parseCrDateArgument('2026-02-30', 'Asia/Taipei', now)).toBeUndefined()
    expect(crWeekStartDateKey('2026-08-09')).toBe('2026-08-03')
  })
})

describe('CR announcement formatting', () => {
  it('keeps only official announcement-category articles', () => {
    const items = extractCrAnnouncements(announcementFeedXml())
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: '測試公告',
      summary: '公告摘要',
      author: 'Crunchyroll Official',
    })
  })
})

export function releaseFeedXml(items: string[]): string {
  return `<?xml version="1.0"?>
    <rss xmlns:crunchyroll="http://www.crunchyroll.com/rss" xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
      <channel>${items.join('')}</channel>
    </rss>`
}

export function releaseItem(watchId: string, publishedAt: string): string {
  return `<item>
    <title>測試動畫 - Episode 2 - 新的開始</title>
    <link>https://www.crunchyroll.com/watch/${watchId}/start</link>
    <pubDate>${new Date(publishedAt).toUTCString()}</pubDate>
    <crunchyroll:mediaId>12345</crunchyroll:mediaId>
    <crunchyroll:premiumPubDate>${new Date(publishedAt).toUTCString()}</crunchyroll:premiumPubDate>
    <crunchyroll:freePubDate>Tue, 19 Jan 2038 00:27:28 GMT</crunchyroll:freePubDate>
    <crunchyroll:seriesTitle>測試動畫</crunchyroll:seriesTitle>
    <crunchyroll:episodeTitle>新的開始</crunchyroll:episodeTitle>
    <crunchyroll:episodeNumber>2</crunchyroll:episodeNumber>
    <crunchyroll:subtitleLanguages>zh - tw</crunchyroll:subtitleLanguages>
    <media:thumbnail url="https://static.crunchyroll.com/image.jpg" />
  </item>`
}

export function announcementFeedXml(): string {
  return `<?xml version="1.0"?>
    <rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0"><channel>
      <item>
        <title>一般新聞</title><category>Latest News</category>
        <link>https://www.crunchyroll.com/news/latest/general</link>
        <pubDate>Wed, 05 Aug 2026 03:00:00 GMT</pubDate>
      </item>
      <item>
        <title>測試公告</title><author>Crunchyroll Official</author>
        <category>Announcements</category><description><![CDATA[<b>公告摘要</b>]]></description>
        <link>https://www.crunchyroll.com/news/announcements/test</link>
        <pubDate>Wed, 05 Aug 2026 04:00:00 GMT</pubDate>
      </item>
    </channel></rss>`
}
