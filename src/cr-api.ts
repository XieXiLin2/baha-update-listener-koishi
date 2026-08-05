import type { Context } from 'koishi'

const RELEASE_FEED_URL = 'https://www.crunchyroll.com/rss/anime'
const CALENDAR_URL = 'https://www.crunchyroll.com/simulcastcalendar'
const ANNOUNCEMENT_FEED_URL = 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/zh-TW/rss'

export interface CrApiOptions {
  requestTimeout: number
  userAgent: string
}

export interface CrScheduleResponse {
  releaseFeedXml: string
  calendarHtml: string
}

export class CrApiClient {
  constructor(
    private readonly http: Context['http'],
    private readonly options: CrApiOptions,
  ) {}

  fetchReleaseFeed(): Promise<string> {
    return this.getText(RELEASE_FEED_URL)
  }

  fetchAnnouncementFeed(): Promise<string> {
    return this.getText(ANNOUNCEMENT_FEED_URL)
  }

  async fetchSchedule(dateKey: string): Promise<CrScheduleResponse> {
    const [releaseFeedXml, calendarHtml] = await Promise.all([
      this.fetchReleaseFeed(),
      this.fetchCalendar(dateKey).catch(() => ''),
    ])
    return { releaseFeedXml, calendarHtml }
  }

  fetchCalendar(dateKey: string): Promise<string> {
    return this.getText(CALENDAR_URL, {
      date: dateKey,
      filter: 'premium',
    })
  }

  private async getText(
    url: string,
    params?: Record<string, string>,
  ): Promise<string> {
    const response = await this.http.get<string>(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': this.options.userAgent,
      },
      params,
      responseType: 'text',
      timeout: this.options.requestTimeout * 1000,
    })
    if (typeof response !== 'string') throw new TypeError('CR 來源未回傳文字內容。')
    if (/\bJust a moment\.\.\.|challenge-platform/i.test(response)) {
      throw new Error('CR 來源目前要求瀏覽器驗證。')
    }
    return response
  }
}
