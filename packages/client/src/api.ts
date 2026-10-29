// Wire types and HTTP calls for the browser inbox. Calls carry only the recipient token: the browser
// never sees an app key or a recipient key it was not given.
import { callApi, type FetchLike } from './http'

export { ApiError, type FetchLike } from './http'

export type InboxItem = {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  priority: number
  readAt: string | null
  archivedAt: string | null
  createdAt: string
}

export type InboxPage = {
  items: InboxItem[]
  next: string | null
  // Every inbox row (the header count); `unread` drives the badge.
  total: number
  unread: number
  latest: string | null
}

export const TOKEN_ERROR_CODE = 'INVALID_RECIPIENT_TOKEN'
export const LOAD_ERROR_MESSAGE = "Couldn't load notifications."

export type InboxListOptions = {
  limit: number
  // Older-page cursor: the next page, going back in time.
  before?: string
  view?: 'active' | 'archived'
}

export type InboxApi = {
  list(token: string, options: InboxListOptions): Promise<InboxPage>
  markRead(token: string, body: { ids: string[] } | { all: true }): Promise<void>
  archive(token: string, body: { ids: string[] } | { read: true }): Promise<void>
  restore(token: string, ids: string[]): Promise<void>
  streamUrl(cursor: string | null): string
}

export function createInboxApi(options: { baseUrl: string; appKey: string; fetchImpl?: FetchLike }): InboxApi {
  const root = `${options.baseUrl.replace(/\/$/, '')}/api/v1/apps/${encodeURIComponent(options.appKey)}`
  const fetcher: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))

  // A stalled network ends in an error after 10 seconds, so the bell never waits forever.
  const call = <T>(path: string, token: string, init: RequestInit = {}) =>
    callApi<T>(fetcher, `${root}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

  return {
    list: (token, options) => {
      const query = new URLSearchParams({ order: 'desc', limit: String(options.limit) })
      if (options.before) query.set('before', options.before)
      if (options.view && options.view !== 'active') query.set('view', options.view)
      return call<InboxPage>(`/inbox?${query}`, token)
    },
    // keepalive: the request still finishes if a link click leaves the page first.
    markRead: async (token, body) => {
      await call('/inbox/read', token, { method: 'POST', body: JSON.stringify(body), keepalive: true })
    },
    archive: async (token, body) => {
      await call('/inbox/archive', token, { method: 'POST', body: JSON.stringify(body) })
    },
    restore: async (token, ids) => {
      await call('/inbox/restore', token, { method: 'POST', body: JSON.stringify({ ids }) })
    },
    // The token goes in the Authorization header (see stream.ts), never the URL. The cursor is not a secret.
    streamUrl: (cursor) => `${root}/stream${cursor ? `?lastEventId=${encodeURIComponent(cursor)}` : ''}`,
  }
}
