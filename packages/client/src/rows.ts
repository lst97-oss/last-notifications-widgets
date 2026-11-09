import type { InboxItem } from './api'

// Keeps the first occurrence of each id: a page boundary or a reconnect can deliver a row twice.
export function uniqueById(items: InboxItem[]): InboxItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
