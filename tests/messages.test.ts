import { describe, expect, it, vi } from 'vitest'

vi.mock('koishi', () => ({
  h: (type: string, attrs: Record<string, unknown>, children: unknown) => ({
    type,
    attrs,
    children,
  }),
}))

import { buildAbemaLatestMessage, buildAbemaUpdateMessage } from '../src/abema-messages'
import { buildCrLatestMessage, buildCrUpdateMessage } from '../src/cr-messages'
import { buildBahaLatestMessage, buildOnAirMessage } from '../src/messages'
import type { AbemaAnimeItem, CrAnimeItem } from '../src/types'

const releaseAt = Date.parse('2026-08-05T04:00:00.000Z')
const timezone = 'Asia/Taipei'

describe('ON AIR time labels', () => {
  it('keeps dates in Baha latest results but not Baha ON AIR notifications', () => {
    const item = {
      title: '測試動畫',
      videoSn: 12345,
      volume: '第 1 集',
      upTime: '2026-08-05 12:00:00',
      upTimeHours: '12:00',
    }

    expect(JSON.stringify(buildOnAirMessage([item]))).toContain('[12:00]')
    expect(JSON.stringify(buildOnAirMessage([item]))).not.toContain('[08/05 12:00]')
    expect(JSON.stringify(buildBahaLatestMessage([item]))).toContain('[08/05 12:00]')
  })

  it('keeps dates in ABEMA latest results but not ABEMA ON AIR notifications', () => {
    expect(JSON.stringify(buildAbemaUpdateMessage([abemaItem], 10, timezone))).toContain('[12:00]')
    expect(JSON.stringify(buildAbemaUpdateMessage([abemaItem], 10, timezone))).not.toContain('08/05')
    expect(JSON.stringify(buildAbemaLatestMessage([abemaItem], 10, timezone))).toContain('08/05')
  })

  it('keeps dates in CR latest results but not CR ON AIR notifications', () => {
    expect(JSON.stringify(buildCrUpdateMessage([crItem], 10, timezone))).toContain('[12:00]')
    expect(JSON.stringify(buildCrUpdateMessage([crItem], 10, timezone))).not.toContain('08/05')
    expect(JSON.stringify(buildCrLatestMessage([crItem], 10, timezone))).toContain('08/05')
  })
})

const abemaItem: AbemaAnimeItem = {
  key: 'abema-test',
  contentId: '100-1_s1_p1',
  episodeId: '100-1_s1_p1',
  seriesId: '100-1',
  title: '測試動畫',
  seriesTitle: '測試動畫',
  dateLabel: '8/5',
  releaseAt,
  endAt: 0,
  contentType: 'program',
  availability: 'free',
  badge: '',
  image: '',
}

const crItem: CrAnimeItem = {
  key: 'cr-test',
  title: '測試動畫',
  seriesTitle: '測試動畫',
  episodeTitle: '開始',
  episodeNumber: '1',
  dateKey: '2026-08-05',
  releaseAt,
  url: 'https://www.crunchyroll.com/watch/GTEST0001/start',
  seriesUrl: '',
  availability: 'premium',
  premiere: true,
  language: '',
  image: '',
}
