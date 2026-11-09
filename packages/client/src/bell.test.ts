import { describe, expect, test } from 'bun:test'

import type { InboxItem } from './api'
import { bellAnnouncement, bellLabel } from './bell'
import { INITIAL_STATE, type InboxState } from './store'

const item = (title: string): InboxItem => ({
  id: title,
  type: 'notice',
  title,
  body: '',
  data: {},
  priority: 0,
  readAt: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const state = (patch: Partial<InboxState> = {}): InboxState => ({ ...INITIAL_STATE, status: 'ready', ...patch })

describe('bellLabel', () => {
  test('names the unread count, or plain when nothing is unread', () => {
    expect(bellLabel(state({ unread: 3 }))).toBe('Notifications, 3 unread')
    expect(bellLabel(state())).toBe('Notifications')
  })

  test('a failed load wins over the count', () => {
    expect(bellLabel(state({ status: 'error', unread: 3 }))).toBe("Notifications, couldn't load")
  })
})

describe('bellAnnouncement', () => {
  test('a failure is announced, not an arrival', () => {
    const arrived = item('Hello')
    const out = bellAnnouncement(state({ status: 'error', announced: arrived }), { text: 'Archived X', after: null })
    expect(out).toBe("Notifications couldn't load.")
  })

  test('an action message shows while no arrival came after it', () => {
    const arrived = item('Hello')
    expect(bellAnnouncement(state({ announced: arrived }), { text: 'Archived X', after: arrived })).toBe('Archived X')
  })

  test('a later arrival replaces a stale action message', () => {
    const older = item('Old')
    const newer = item('New')
    expect(bellAnnouncement(state({ announced: newer }), { text: 'Archived X', after: older })).toBe(
      'New notification: New',
    )
  })

  test('with no note and no arrival, nothing is announced', () => {
    expect(bellAnnouncement(state(), { text: '', after: null })).toBe('')
  })
})
