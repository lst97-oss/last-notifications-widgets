import { afterEach, describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

import { type InboxItem, type InboxPage, LOAD_ERROR_MESSAGE } from './api'
import { createInboxStore, type InboxError, type InboxStore, type Stream, type StreamEvent } from './store'

const at = '2026-10-29T10:00:00.000Z'
const row = (id: string, title: string, readAt: string | null = null): InboxItem => ({
  id,
  type: 'notice',
  title,
  body: '',
  data: {},
  priority: 0,
  readAt,
  archivedAt: null,
  createdAt: at,
})

const page: InboxPage = {
  items: [row('b', 'Second'), row('a', 'First', at)],
  total: 2,
  unread: 1,
  next: null,
  latest: 'cur-b',
}

const ok = (data: unknown) => Response.json({ data }, { status: HttpStatus.OK.code })
const failure = (code: string, status: number) => Response.json({ error: { code, message: code } }, { status })
const settle = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms))

class FakeStream implements Stream {
  readonly handlers = new Map<string, (event: StreamEvent) => void>()
  closed = false

  constructor(
    readonly url: string,
    readonly token: string,
  ) {}

  addEventListener(type: 'open' | 'error' | 'notification', listener: (event: StreamEvent) => void) {
    this.handlers.set(type, listener)
  }

  close() {
    this.closed = true
  }

  emit(type: 'open' | 'error' | 'notification', event: Partial<StreamEvent> = {}) {
    this.handlers.get(type)?.({ data: '', lastEventId: '', ...event })
  }
}

type Sent = { method: string; url: string; auth?: string; body?: unknown; keepalive: boolean; timed: boolean }

const stores: InboxStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.stop()
})

function harness(
  options: {
    tokens?: string[]
    // A host that keeps returning this token, as a cache that never refreshes would.
    stale?: string
    fetch?: (url: string) => Response | Promise<Response>
    tokenRefreshMs?: number
    getToken?: () => Promise<string | null>
    onError?: (error: InboxError) => void
  } = {},
) {
  const tokens = [...(options.tokens ?? ['lrt_1'])]
  const streams: FakeStream[] = []
  const sent: Sent[] = []
  const store = createInboxStore({
    baseUrl: 'https://notify.test',
    appKey: 'app-1',
    getToken: options.getToken ?? (async () => options.stale ?? tokens.shift() ?? null),
    onError: options.onError,
    fetchImpl: async (input, init) => {
      const url = String(input)
      const headers = init?.headers as Record<string, string> | undefined
      sent.push({
        method: init?.method ?? 'GET',
        url,
        auth: headers?.authorization,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        keepalive: init?.keepalive === true,
        timed: init?.signal instanceof AbortSignal,
      })
      return options.fetch ? options.fetch(url) : defaultFetch(url)
    },
    openStream: (url, token) => {
      const stream = new FakeStream(url, token)
      streams.push(stream)
      return stream
    },
    tokenRefreshMs: options.tokenRefreshMs ?? 60_000,
    retryMinMs: 5,
    retryMaxMs: 20,
  })
  stores.push(store)
  return { store, streams, sent }
}

function defaultFetch(url: string): Response {
  if (url.includes('/inbox?')) return ok(page)
  return ok({ updated: 1 })
}

describe('inbox store', () => {
  test('an anonymous visitor makes no request and opens no stream', async () => {
    const { store, sent, streams } = harness({ tokens: [] })
    await store.start()
    expect(store.getState().status).toBe('anonymous')
    expect(sent).toHaveLength(0)
    expect(streams).toHaveLength(0)
  })

  test('loads newest first, counts unread, and streams from the latest cursor', async () => {
    const { store, streams } = harness()
    await store.start()
    const state = store.getState()
    expect(state.status).toBe('ready')
    expect(state.items.map((item) => item.id)).toEqual(['b', 'a'])
    expect(state.unread).toBe(1)
    expect(streams).toHaveLength(1)
    expect(streams[0].token).toBe('lrt_1')
    // The token rides in the Authorization header, so it must never appear in the URL.
    expect(streams[0].url).not.toContain('lrt_1')
    expect(streams[0].url).toContain('lastEventId=cur-b')
  })

  test('a live arrival is added once, counted as unread, and announced', async () => {
    const { store, streams } = harness()
    await store.start()
    const live = row('c', 'Third')
    streams[0].emit('notification', { data: JSON.stringify(live), lastEventId: 'cur-c' })
    streams[0].emit('notification', { data: JSON.stringify(live), lastEventId: 'cur-c' })
    const state = store.getState()
    expect(state.items.map((item) => item.id)).toEqual(['c', 'b', 'a'])
    expect(state.unread).toBe(2)
    expect(state.announced?.id).toBe('c')
  })

  test('the total counts every inbox row and follows archive, restore and live arrivals', async () => {
    const { store, streams } = harness()
    await store.start()
    expect(store.getState().total).toBe(2)
    await store.archive(['b'])
    expect(store.getState().total).toBe(1)
    streams[0].emit('notification', { data: JSON.stringify(row('c', 'Third')), lastEventId: 'cur-c' })
    expect(store.getState().total).toBe(2)
    expect(store.getState().unread).toBe(1)
    await store.restore(['b'])
    expect(store.getState().total).toBe(3)
  })

  test('archive all read takes the server total, which may count rows beyond the loaded pages', async () => {
    let lists = 0
    const { store } = harness({
      fetch: (url) => {
        if (url.includes('/inbox/archive')) return ok({ archived: 1 })
        lists += 1
        if (lists === 1) return ok(page)
        return ok({ items: [row('b', 'Second')], total: 5, unread: 1, next: null, latest: 'cur-b' })
      },
    })
    await store.start()
    await store.archiveRead()
    expect(store.getState().total).toBe(5)
  })

  test('a reconnect resumes from the last cursor with a fresh token', async () => {
    const { store, streams } = harness({ tokens: ['lrt_1', 'lrt_2'] })
    await store.start()
    streams[0].emit('notification', { data: JSON.stringify(row('c', 'Third')), lastEventId: 'cur-c' })
    streams[0].emit('error')
    await settle(30)
    expect(streams).toHaveLength(2)
    expect(streams[0].closed).toBe(true)
    expect(streams[1].token).toBe('lrt_2')
    expect(streams[1].url).toContain('lastEventId=cur-c')
  })

  test('marking a row read is optimistic and posts its id', async () => {
    const { store, sent } = harness()
    await store.start()
    store.markRead(['b'])
    expect(store.getState().unread).toBe(0)
    expect(store.getState().items.find((item) => item.id === 'b')?.readAt).not.toBeNull()
    await settle()
    const post = sent.find((call) => call.method === 'POST')
    expect(post?.url).toContain('/inbox/read')
    expect(post?.body).toEqual({ ids: ['b'] })
    // keepalive lets the mark-read finish when a link click leaves the page.
    expect(post?.keepalive).toBe(true)
  })

  test('every request carries a time limit, so a stalled network ends in an error', async () => {
    const { store, sent } = harness()
    await store.start()
    expect(sent.length).toBeGreaterThan(0)
    expect(sent.every((call) => call.timed)).toBe(true)
  })

  test('mark all read posts the all flag and zeroes the badge', async () => {
    const { store, sent } = harness()
    await store.start()
    store.markAllRead()
    expect(store.getState().unread).toBe(0)
    await settle()
    expect(sent.find((call) => call.method === 'POST')?.body).toEqual({ all: true })
  })

  test('an expired token is replaced once and the request retried', async () => {
    let listCalls = 0
    const { store, sent } = harness({
      tokens: ['lrt_old', 'lrt_new'],
      fetch: (url) => {
        if (!url.includes('/inbox?')) return ok({})
        listCalls += 1
        return listCalls === 1 ? failure('INVALID_RECIPIENT_TOKEN', HttpStatus.UNAUTHORIZED.code) : ok(page)
      },
    })
    await store.start()
    expect(store.getState().status).toBe('ready')
    expect(sent.filter((call) => call.url.includes('/inbox?')).map((call) => call.auth)).toEqual([
      'Bearer lrt_old',
      'Bearer lrt_new',
    ])
  })

  test('a host that keeps returning a stale token keeps retrying with it, and does not sign the visitor out', async () => {
    const { store, streams } = harness({ stale: 'lrt_old' })
    await store.start()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      streams[attempt]?.emit('error')
      // The retry delay is at most retryMaxMs (20 ms here), so a short wait is enough.
      await settle(40)
    }
    expect(streams).toHaveLength(4)
    expect(streams.every((stream) => stream.token === 'lrt_old')).toBe(true)
    expect(store.getState().status).toBe('ready')
  })

  test('a rotated token reopens the stream from the same cursor', async () => {
    const { store, streams } = harness({ tokens: ['lrt_1', 'lrt_2', 'lrt_3'], tokenRefreshMs: 10 })
    await store.start()
    await settle(25)
    expect(streams.length).toBeGreaterThan(1)
    expect(streams[0].closed).toBe(true)
    for (const stream of streams.slice(1)) expect(stream.url).toContain('lastEventId=cur-b')
  })

  test('a stopped session drops a list response that arrives later', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { store, streams } = harness({
      fetch: async (url) => {
        if (url.includes('/inbox?')) await gate
        return ok(page)
      },
    })
    const started = store.start()
    await settle()
    store.stop()
    release()
    await started
    expect(store.getState().status).toBe('loading')
    expect(streams).toHaveLength(0)
  })

  test('a rotation that finds no token signs the visitor out and closes the stream', async () => {
    const { store, streams } = harness({ tokens: ['lrt_1'], tokenRefreshMs: 10 })
    await store.start()
    await settle(30)
    expect(store.getState().status).toBe('anonymous')
    expect(store.getState().items).toHaveLength(0)
    expect(streams[0].closed).toBe(true)
  })

  test('a failed load shows the error, and retry recovers', async () => {
    let failing = true
    const { store } = harness({
      tokens: ['lrt_1', 'lrt_2'],
      fetch: (url) => {
        if (!url.includes('/inbox?')) return ok({})
        return failing ? failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code) : ok(page)
      },
    })
    await store.start()
    expect(store.getState().status).toBe('error')
    expect(store.getState().error).toBe(LOAD_ERROR_MESSAGE)
    failing = false
    await store.retry()
    expect(store.getState().status).toBe('ready')
  })

  test('a retry clears a load-more that was still running, so load-more works again', async () => {
    let failingLists = false
    let releaseFirst!: (response: Response) => void
    const firstOlder = new Promise<Response>((resolve) => {
      releaseFirst = resolve
    })
    let olderCalls = 0
    const { store } = harness({
      tokens: ['lrt_1', 'lrt_2'],
      fetch: (url) => {
        if (url.includes('/inbox/read')) return failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code)
        if (url.includes('before=')) {
          olderCalls += 1
          return olderCalls === 1 ? firstOlder : ok({ items: [row('c', 'Third')], unread: 1, next: null, latest: null })
        }
        if (!url.includes('/inbox?')) return ok({})
        if (failingLists) return failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code)
        return ok({ ...page, next: 'older-1' })
      },
    })
    await store.start()
    const stale = store.loadMore()
    await settle()
    failingLists = true
    await store.markRead(['b'])
    await settle()
    expect(store.getState().status).toBe('error')
    failingLists = false
    await store.retry()
    releaseFirst(ok({ items: [row('x', 'Stale')], unread: 1, next: null, latest: null }))
    await stale
    await store.loadMore()
    expect(store.getState().items.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  test('separate stores never share items', async () => {
    const first = harness().store
    await first.start()
    const second = harness({ tokens: [] }).store
    await second.start()
    expect(first.getState().items).toHaveLength(2)
    expect(second.getState().items).toHaveLength(0)
  })
})

const archivedRow = (id: string, title: string): InboxItem => ({ ...row(id, title, at), archivedAt: at })

describe('inbox store paging and archive', () => {
  test('loadMore appends the older page without repeating a row', async () => {
    const { store, sent } = harness({
      fetch: (url) => {
        if (url.includes('before=cur-next-1'))
          return ok({ items: [row('c', 'Third'), row('a', 'First', at)], unread: 1, next: null, latest: null })
        return ok({
          items: [row('b', 'Second'), row('a', 'First', at)],
          unread: 1,
          next: 'cur-next-1',
          latest: 'cur-b',
        })
      },
    })
    await store.start()
    expect(store.getState().next).toBe('cur-next-1')
    await store.loadMore()
    expect(store.getState().items.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    expect(store.getState().next).toBeNull()
    expect(sent.some((call) => call.url.includes('before=cur-next-1'))).toBe(true)
  })

  test('the archive is not requested until it is opened, and only once', async () => {
    const { store, sent } = harness()
    await store.start()
    expect(sent.some((call) => call.url.includes('view=archived'))).toBe(false)
    await store.openArchive()
    await store.openArchive()
    expect(sent.filter((call) => call.url.includes('view=archived'))).toHaveLength(1)
    expect(store.getState().view).toBe('archive')
    store.closeArchive()
    expect(store.getState().view).toBe('inbox')
  })

  test('archiving moves a row out of the inbox, marks it read, and posts its id', async () => {
    const { store, sent } = harness()
    await store.start()
    await store.archive(['b'])
    const state = store.getState()
    expect(state.items.map((item) => item.id)).toEqual(['a'])
    expect(state.unread).toBe(0)
    expect(state.archive.items.map((item) => item.id)).toEqual(['b'])
    expect(state.archive.items[0]?.archivedAt).not.toBeNull()
    await settle()
    expect(sent.find((call) => call.url.includes('/inbox/archive'))?.body).toEqual({ ids: ['b'] })
  })

  test('restoring brings a row back to the inbox and keeps it read', async () => {
    const { store, sent } = harness({
      fetch: (url) => {
        if (url.includes('view=archived'))
          return ok({ items: [archivedRow('x', 'Old')], unread: 0, next: null, latest: null })
        if (url.includes('/inbox/restore')) return ok({ restored: 1 })
        return ok({ items: [row('a', 'First', at)], unread: 0, next: null, latest: 'cur-a' })
      },
    })
    await store.start()
    await store.openArchive()
    await store.restore(['x'])
    const state = store.getState()
    expect(state.items.map((item) => item.id).sort()).toEqual(['a', 'x'])
    expect(state.items.find((item) => item.id === 'x')?.readAt).not.toBeNull()
    expect(state.archive.items).toHaveLength(0)
    await settle()
    expect(sent.find((call) => call.url.includes('/inbox/restore'))?.body).toEqual({ ids: ['x'] })
  })

  test('archive-read archives every read row, then re-reads the head', async () => {
    let heads = 0
    const { store, sent } = harness({
      fetch: (url) => {
        if (url.includes('view=archived')) return ok({ items: [], unread: 0, next: null, latest: null })
        if (url.includes('/inbox/archive')) return ok({ archived: 1 })
        heads += 1
        const items = heads === 1 ? [row('b', 'Second'), row('a', 'First', at)] : [row('b', 'Second')]
        return ok({ items, unread: 1, next: null, latest: 'cur-b' })
      },
    })
    await store.start()
    await store.archiveRead()
    expect(store.getState().items.map((item) => item.id)).toEqual(['b'])
    expect(store.getState().archive.items.map((item) => item.id)).toEqual(['a'])
    await settle()
    expect(sent.find((call) => call.url.includes('/inbox/archive'))?.body).toEqual({ read: true })
    expect(heads).toBeGreaterThan(1)
  })

  test('archive-read on an empty inbox drops the rows the server no longer has', async () => {
    let heads = 0
    const { store } = harness({
      fetch: (url) => {
        if (url.includes('/inbox/archive')) return ok({ archived: 1 })
        if (url.includes('view=archived')) return ok({ items: [], unread: 0, next: null, latest: null })
        heads += 1
        return heads === 1 ? ok(page) : ok({ items: [], total: 0, unread: 0, next: null, latest: null })
      },
    })
    await store.start()
    await store.archiveRead()
    expect(store.getState().items).toEqual([])
    expect(store.getState().total).toBe(0)
  })

  test('a failed archive reloads the inbox so the row is not lost', async () => {
    const fail = true
    const { store } = harness({
      fetch: (url) => {
        if (url.includes('/inbox/archive') && fail)
          return failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code)
        if (url.includes('view=archived')) return ok({ items: [], unread: 0, next: null, latest: null })
        return ok(page)
      },
    })
    await store.start()
    await store.archive(['b'])
    await settle(30)
    expect(store.getState().items.map((item) => item.id)).toContain('b')
  })

  test('archive all read reaches the server when no loaded row is read', async () => {
    const { store, sent } = harness({
      fetch: (url) => {
        if (url.includes('/inbox/archive')) return ok({ archived: 1 })
        // Both loaded rows are unread; the read row sits past this page, so no loaded row is read.
        if (url.includes('/inbox?'))
          return ok({
            items: [row('a', 'First'), row('b', 'Second')],
            total: 3,
            unread: 2,
            next: 'older',
            latest: null,
          })
        return ok({})
      },
    })
    await store.start()
    expect(await store.archiveRead()).toBe(true)
    expect(sent.find((call) => call.url.includes('/inbox/archive'))?.body).toEqual({ read: true })
  })
})

describe('inbox store failures', () => {
  test('a getToken that throws shows the error, not a missing bell, and retry asks the host again', async () => {
    let attempts = 0
    const errors: InboxError[] = []
    const { store } = harness({
      getToken: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('host backend down')
        return 'lrt_1'
      },
      onError: (error) => errors.push(error),
    })
    await store.start()
    expect(store.getState().status).toBe('error')
    expect(store.getState().error).toBe(LOAD_ERROR_MESSAGE)
    expect(errors.map((error) => [error.source, error.code])).toEqual([['token', 'TOKEN_UNAVAILABLE']])
    await store.retry()
    expect(store.getState().status).toBe('ready')
  })

  test('a getToken that returns null is still a signed-out visitor, not an error', async () => {
    const { store } = harness({ getToken: async () => null })
    await store.start()
    expect(store.getState().status).toBe('anonymous')
  })

  test('a failed load reports the server code to onError, once', async () => {
    const errors: InboxError[] = []
    const { store } = harness({
      fetch: (url) =>
        url.includes('/inbox?') ? failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code) : ok({}),
      onError: (error) => errors.push(error),
    })
    await store.start()
    expect(errors.map((error) => [error.source, error.code])).toEqual([['inbox', 'INTERNAL_ERROR']])
  })

  test('a network failure shows the error and reports NETWORK_ERROR', async () => {
    const errors: InboxError[] = []
    const { store } = harness({
      fetch: () => {
        throw new TypeError('fetch failed')
      },
      onError: (error) => errors.push(error),
    })
    await store.start()
    expect(store.getState().status).toBe('error')
    expect(errors.map((error) => error.code)).toEqual(['NETWORK_ERROR'])
  })

  test('a throwing onError does not break the store', async () => {
    const { store } = harness({
      fetch: (url) =>
        url.includes('/inbox?') ? failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code) : ok({}),
      onError: () => {
        throw new Error('host logger down')
      },
    })
    await store.start()
    expect(store.getState().status).toBe('error')
  })

  test('a stream outage reports once, however many retries follow, and a reconnect re-arms it', async () => {
    const errors: InboxError[] = []
    const { store, streams } = harness({
      tokens: ['lrt_1', 'lrt_2', 'lrt_3', 'lrt_4', 'lrt_5'],
      onError: (error) => errors.push(error),
    })
    await store.start()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      streams[attempt]?.emit('error', { data: 'stream answered 500' })
      await settle(40)
    }
    const streamErrors = () => errors.filter((error) => error.source === 'stream')
    expect(streamErrors()).toHaveLength(1)
    expect(streamErrors()[0]?.cause).toBe('stream answered 500')
    streams.at(-1)?.emit('open')
    streams.at(-1)?.emit('error')
    await settle(40)
    expect(streamErrors()).toHaveLength(2)
  })

  test('a failed load-more keeps the rows shown and flags it, and the next attempt clears the flag', async () => {
    let failing = true
    const { store } = harness({
      fetch: (url) => {
        if (url.includes('before=')) {
          return failing
            ? failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code)
            : ok({ items: [row('c', 'Third')], unread: 1, next: null, latest: null })
        }
        if (url.includes('/inbox?')) return ok({ ...page, next: 'older-1' })
        return ok({})
      },
    })
    await store.start()
    await store.loadMore()
    expect(store.getState().status).toBe('ready')
    expect(store.getState().items.map((item) => item.id)).toEqual(['b', 'a'])
    expect(store.getState().loadMoreFailed).toBe(true)
    failing = false
    await store.loadMore()
    expect(store.getState().loadMoreFailed).toBe(false)
    expect(store.getState().items.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  test('a failed archive load-more keeps the archived rows listed', async () => {
    const { store } = harness({
      fetch: (url) => {
        if (url.includes('view=archived')) {
          if (url.includes('before=')) return failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code)
          return ok({ items: [row('z', 'Old', at)], unread: 0, next: 'older', latest: null })
        }
        if (url.includes('/inbox?')) return ok(page)
        return ok({})
      },
    })
    await store.start()
    await store.openArchive()
    await store.loadMoreArchive()
    expect(store.getState().archive.status).toBe('ready')
    expect(store.getState().archive.items.map((item) => item.id)).toEqual(['z'])
    expect(store.getState().archive.loadMoreFailed).toBe(true)
  })

  test('actions resolve false when the server refuses them, and true when it applies them', async () => {
    let failing = true
    const { store } = harness({
      fetch: (url) => {
        if (failing && (url.includes('/inbox/archive') || url.includes('/inbox/read')))
          return failure('INTERNAL_ERROR', HttpStatus.INTERNAL_SERVER_ERROR.code)
        if (url.includes('/inbox?')) return ok(page)
        return ok({ updated: 1 })
      },
    })
    await store.start()
    expect(await store.markAllRead()).toBe(false)
    expect(await store.archive(['b'])).toBe(false)
    await settle(30)
    failing = false
    expect(await store.archive(['a'])).toBe(true)
    expect(await store.markAllRead()).toBe(true)
  })

  test('a token outage reports once, not on every refresh, and a working token re-arms it', async () => {
    let failing = false
    let calls = 0
    const errors: InboxError[] = []
    const { store } = harness({
      tokenRefreshMs: 5,
      getToken: async () => {
        calls += 1
        if (failing) throw new Error('host backend down')
        return 'lrt_1'
      },
      onError: (error) => errors.push(error),
    })
    await store.start()
    const tokenErrors = () => errors.filter((error) => error.source === 'token')
    failing = true
    await settle(60)
    // The refresh timer kept firing, so the single report is not just one attempt.
    expect(calls).toBeGreaterThan(3)
    expect(tokenErrors()).toHaveLength(1)
    failing = false
    await settle(20)
    failing = true
    await settle(20)
    expect(tokenErrors()).toHaveLength(2)
  })
})
