import type { InboxItem } from './api'
import type { InboxState } from './store'

// A message from an action ("Archived 3 notifications"). It is tied to the newest live arrival at the time it was
// set, so a later arrival is announced instead of the stale message.
export type BellNote = { text: string; after: InboxItem | null }

// The bell button's accessible name, so every port labels the trigger the same way.
export function bellLabel(state: InboxState): string {
  if (state.status === 'error') return "Notifications, couldn't load"
  return state.unread > 0 ? `Notifications, ${state.unread} unread` : 'Notifications'
}

// What the live region says. A failure takes priority, then the action message if no arrival came after it,
// then the newest live arrival.
export function bellAnnouncement(state: InboxState, note: BellNote): string {
  if (state.status === 'error') return "Notifications couldn't load."
  if (note.text && note.after === state.announced) return note.text
  return state.announced ? `New notification: ${state.announced.title}` : ''
}
