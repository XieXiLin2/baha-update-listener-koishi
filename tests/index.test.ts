import { describe, expect, it, vi } from 'vitest'

import type { Context } from 'koishi'

import type { Config } from '../src/config'
import { apply } from '../src/index'

vi.mock('koishi', () => {
  const schema = () => {
    const value = {
      default: () => value,
      description: () => value,
      max: () => value,
      min: () => value,
      required: () => value,
      role: () => value,
      step: () => value,
    }
    return value
  }

  return {
    Context: class {},
    Logger: class {
      info() {}
      warn() {}
    },
    Schema: {
      array: schema,
      boolean: schema,
      number: schema,
      object: schema,
      string: schema,
    },
    h: (type: string, attrs: Record<string, unknown>, children: unknown) => ({
      type,
      attrs,
      children,
    }),
  }
})

type CommandAction = (...args: unknown[]) => unknown

describe('command surface', () => {
  it('maps both root commands to today schedules and registers no detail commands', async () => {
    const actions = new Map<string, CommandAction>()
    const commandNames: string[] = []
    const todayLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date())

    const http = {
      get: vi.fn(async (url: string) => {
        if (url.includes('gamer.com.tw')) return bahaIndexResponse()
        if (url.includes('/rss/anime')) return crReleaseFeedXml()
        if (url.includes('cr-news-api-service')) return crAnnouncementFeedXml()
        if (url.includes('/simulcastcalendar')) return '<div class="calendar"></div>'
        if (url.includes('/spotLists/')) {
          return { items: [{ id: 'anime-spot', genre: { id: 'animation' } }] }
        }
        if (url.includes('/v1/modules')) return abemaScheduleResponse(todayLabel)
        throw new Error(`Unexpected GET ${url}`)
      }),
      post: vi.fn(async () => ({
        access_token: jwtExpiringInOneHour(),
      })),
      extend: vi.fn(),
    }
    http.extend.mockReturnValue(http)
    const context = {
      baseDir: 'D:/tmp/koishi-command-test',
      http,
      bail: vi.fn(() => ({ close: vi.fn().mockResolvedValue(undefined) })),
      command: vi.fn((declaration: string) => {
        commandNames.push(declaration)
        const command = {
          alias: () => command,
          example: () => command,
          action: (handler: CommandAction) => {
            actions.set(declaration, handler)
            return command
          },
        }
        return command
      }),
      on: vi.fn(),
      setInterval: vi.fn(),
    }

    apply(context as unknown as Context, config)

    expect(http.extend).toHaveBeenCalledOnce()
    expect(http.extend).toHaveBeenCalledWith({
      proxyAgent: 'socks5://127.0.0.1:1080',
    })
    expect(context.bail).toHaveBeenCalledWith(
      'http/dispatcher',
      new URL('socks5://127.0.0.1:1080'),
      new URL('https://example.com/'),
    )

    expect(commandNames).toEqual([
      'baha',
      'baha.announcement',
      'baha.latest [limit:number]',
      'baha.schedule [day:string]',
      'abema',
      'abema.latest [limit:number]',
      'abema.schedule [date:string]',
      'cr',
      'cr.announcement',
      'cr.latest [limit:number]',
      'cr.schedule [date:string]',
    ])

    const plainArgv = { session: { platform: 'plain' } }
    const bahaResult = await actions.get('baha')?.(plainArgv)
    expect(bahaResult).toContain('Baha root schedule')
    expect(bahaResult).not.toContain('ani.gamer.com.tw')

    const bahaLatestResult = await actions.get('baha.latest [limit:number]')?.(plainArgv, 10)
    expect(bahaLatestResult).toContain('Baha latest update')
    expect(bahaLatestResult).toContain('[08/05 12:00]')
    expect(bahaLatestResult).toContain('https://ani.gamer.com.tw/animeVideo.php?sn=12345')

    const abemaResult = await actions.get('abema')?.(plainArgv)
    expect(abemaResult).toContain('ABEMA root schedule')
    expect(abemaResult).not.toContain('abema.tv')

    const latestResult = await actions.get('abema.latest [limit:number]')?.(plainArgv, 10)
    expect(latestResult).toContain('ABEMA root schedule')
    expect(latestResult).toContain('https://abema.tv/')

    const crResult = await actions.get('cr')?.(plainArgv)
    expect(crResult).toContain('CR root schedule')
    expect(crResult).not.toContain('crunchyroll.com')

    const crLatestResult = await actions.get('cr.latest [limit:number]')?.(plainArgv, 10)
    expect(crLatestResult).toContain('CR root schedule')
    expect(crLatestResult).toContain('https://www.crunchyroll.com/watch/GCRROOT01/start')
  })
})

const config: Config = {
  targets: [],
  plainTextPlatforms: ['plain'],
  proxyUrl: 'socks5://127.0.0.1:1080',
  enableRequestLogging: false,
  pollIntervalSeconds: 60,
  timezone: 'Asia/Taipei',
  useMobileApi: true,
  webUserAgent: 'test',
  requestTimeoutSeconds: 20,
  maxPushItems: 12,
  maxScheduleItems: 30,
  enableAbema: true,
  abemaPollIntervalSeconds: 300,
  abemaMaxPushItems: 12,
  enableCr: true,
  crPollIntervalSeconds: 300,
  crMaxPushItems: 12,
}

function bahaIndexResponse() {
  return {
    data: {
      newAnimeSchedule: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [
          String(index + 1),
          [{ title: 'Baha root schedule', scheduleTime: '12:00', videoSn: 99999 }],
        ]),
      ),
      newAnime: {
        date: [{
          title: 'Baha latest update',
          videoSn: 12345,
          volume: '第 1 集',
          upTime: '2026-08-05',
          upTimeHours: '12:00',
        }],
      },
    },
  }
}

function abemaScheduleResponse(todayLabel: string) {
  return {
    modules: [{
      id: 'CHDCPxRFZ8vxTh',
      items: [{
        tabView: {
          displayName: todayLabel,
          tabViewItems: [{
            displayName: 'ABEMA root schedule',
            description: 'ABEMA root schedule',
            contentType: 'CONTENT_TYPE_PROGRAM',
            contentId: '100-1_s1_p1',
          }],
        },
      }],
    }],
  }
}

function jwtExpiringInOneHour(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  return `header.${payload}.signature`
}

function crReleaseFeedXml(): string {
  const publishedAt = new Date(Date.now() - 60_000).toUTCString()
  return `<?xml version="1.0"?>
    <rss xmlns:crunchyroll="http://www.crunchyroll.com/rss" version="2.0"><channel><item>
      <title>CR root schedule - Episode 1</title>
      <link>https://www.crunchyroll.com/watch/GCRROOT01/start</link>
      <pubDate>${publishedAt}</pubDate>
      <crunchyroll:premiumPubDate>${publishedAt}</crunchyroll:premiumPubDate>
      <crunchyroll:seriesTitle>CR root schedule</crunchyroll:seriesTitle>
      <crunchyroll:episodeNumber>1</crunchyroll:episodeNumber>
    </item></channel></rss>`
}

function crAnnouncementFeedXml(): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><item>
    <title>CR announcement</title><category>Announcements</category>
    <link>https://www.crunchyroll.com/news/announcements/test</link>
    <pubDate>Wed, 05 Aug 2026 04:00:00 GMT</pubDate>
  </item></channel></rss>`
}
