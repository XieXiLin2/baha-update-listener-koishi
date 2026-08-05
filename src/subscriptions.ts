import type { Session } from 'koishi'

import type { StateStore } from './state'
import type { PushTarget, SubscriptionSource } from './types'

export interface SubscriptionStatus {
  found: boolean
  enabled: boolean
}

export class SubscriptionService {
  constructor(
    private readonly targets: PushTarget[],
    private readonly store: StateStore,
  ) {}

  isSubscribed(target: PushTarget, source: SubscriptionSource): boolean {
    return isTargetSubscribed(
      target,
      source,
      this.store.state.subscriptionOverrides[targetKey(target)]?.[source],
    )
  }

  status(session: Session, source: SubscriptionSource): SubscriptionStatus {
    const targets = this.findTargets(session)
    return {
      found: targets.length > 0,
      enabled: targets.some((target) => this.isSubscribed(target, source)),
    }
  }

  async set(
    session: Session,
    source: SubscriptionSource,
    enabled: boolean,
  ): Promise<SubscriptionStatus> {
    const targets = this.findTargets(session)
    if (!targets.length) return { found: false, enabled: false }

    for (const target of targets) {
      const key = targetKey(target)
      const selection = this.store.state.subscriptionOverrides[key] ??= {}
      selection[source] = enabled
    }
    await this.store.save()
    return { found: true, enabled }
  }

  private findTargets(session: Session): PushTarget[] {
    const seen = new Set<string>()
    return this.targets.filter((target) => {
      if (!matchesSession(target, session)) return false
      const key = targetKey(target)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

export function isTargetSubscribed(
  target: PushTarget,
  source: SubscriptionSource,
  override?: boolean,
): boolean {
  if (typeof override === 'boolean') return override
  return target.subscriptions === undefined || target.subscriptions.includes(source)
}

export function parseSubscriptionSwitch(value?: string): boolean | undefined | null {
  if (value === undefined || !value.trim()) return undefined
  switch (value.trim().toLowerCase()) {
    case 'on':
    case 'true':
    case '1':
    case 'enable':
    case 'enabled':
    case '開':
    case '开启':
    case '開啟':
      return true
    case 'off':
    case 'false':
    case '0':
    case 'disable':
    case 'disabled':
    case '關':
    case '关闭':
    case '關閉':
      return false
    default:
      return null
  }
}

function matchesSession(target: PushTarget, session: Session): boolean {
  return target.platform === session.platform
    && target.channelId === session.channelId
    && (!target.selfId || target.selfId === session.selfId)
    && (!target.guildId || target.guildId === session.guildId)
}

function targetKey(target: PushTarget): string {
  return JSON.stringify([
    target.platform,
    target.selfId ?? '',
    target.channelId,
    target.guildId ?? '',
  ])
}
