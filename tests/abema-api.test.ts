import { describe, expect, it } from 'vitest'

import { applicationKeyDate, generateApplicationKeySecret } from '../src/abema-api'

describe('ABEMA guest authorization', () => {
  it('matches the official application-key derivation vector', () => {
    expect(generateApplicationKeySecret(
      '00000000-0000-4000-8000-000000000000',
      new Date('2026-08-05T04:00:00.000Z'),
    )).toBe('8XTvqy7Fj44D5vnGH7FZM0TdpEEcRDkgza2OT8xQcok')
  })

  it('uses the beginning of the next hour', () => {
    const now = new Date('2026-08-05T03:17:42.123Z')
    const target = applicationKeyDate(now)
    expect(target.getTime()).toBeGreaterThan(now.getTime())
    expect(target.getTime() - now.getTime()).toBeLessThanOrEqual(60 * 60 * 1000)
    expect(target.getMinutes()).toBe(0)
    expect(target.getSeconds()).toBe(0)
    expect(target.getMilliseconds()).toBe(123)
  })
})
