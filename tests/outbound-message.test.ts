import type { h } from 'koishi'
import { describe, expect, it } from 'vitest'

import {
  formatOutboundMessage,
  renderPlainText,
  usesPlainText,
} from '../src/outbound-message'

describe('plain-text platform output', () => {
  const richMessage = [
    { type: 'b', attrs: {}, children: ['標題'] },
    '\n- ',
    { type: 'a', attrs: { href: 'https://example.com/item' }, children: ['項目'] },
  ] as unknown as h.Fragment

  it('matches configured platforms without case sensitivity', () => {
    expect(usesPlainText('OneBot', ['telegram', 'onebot'])).toBe(true)
    expect(usesPlainText('discord', ['telegram', 'onebot'])).toBe(false)
  })

  it('removes formatting and URLs for ON AIR and schedule output', () => {
    expect(renderPlainText(richMessage)).toBe('標題\n- 項目')
  })

  it('retains URLs as plain text when requested', () => {
    expect(renderPlainText(richMessage, { keepUrls: true }))
      .toBe('標題\n- 項目 (https://example.com/item)')
  })

  it('leaves rich messages unchanged on other platforms', () => {
    expect(formatOutboundMessage(richMessage, 'discord', ['onebot'])).toBe(richMessage)
  })
})
