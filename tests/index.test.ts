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
        if (url.includes('/spotLists/')) {
          return { items: [{ id: 'anime-spot', genre: { id: 'animation' } }] }
        }
        if (url.includes('/v1/modules')) return abemaScheduleResponse(todayLabel)
        throw new Error(`Unexpected GET ${url}`)
      }),
      post: vi.fn(async () => ({
        access_token: jwtExpiringInOneHour(),
      })),
    }
    const context = {
      baseDir: 'D:/tmp/koishi-command-test',
      http,
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

    expect(commandNames).toEqual([
      'baha',
      'baha.announcement',
      'baha.schedule [day:string]',
      'abema',
      'abema.latest [limit:number]',
      'abema.schedule [date:string]',
    ])

    const bahaResult = await actions.get('baha')?.()
    expect(JSON.stringify(bahaResult)).toContain('Baha root schedule')

    const abemaResult = await actions.get('abema')?.()
    expect(JSON.stringify(abemaResult)).toContain('ABEMA root schedule')

    const latestResult = await actions.get('abema.latest [limit:number]')?.({}, 10)
    expect(JSON.stringify(latestResult)).toContain('ABEMA root schedule')
  })
})

const config: Config = {
  targets: [],
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
}

function bahaIndexResponse() {
  return {
    data: {
      newAnimeSchedule: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => [
          String(index + 1),
          [{ title: 'Baha root schedule', scheduleTime: '12:00' }],
        ]),
      ),
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
