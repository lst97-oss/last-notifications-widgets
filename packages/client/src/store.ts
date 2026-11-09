import {
  ApiError,
  createInboxApi,
  type FetchLike,
  type InboxItem,
  LOAD_ERROR_MESSAGE,
  TOKEN_ERROR_CODE,
  UNAVAILABLE_MESSAGE,
} from './api'
import { createArchive } from './archive'
import { createBackoff, type Failure, failureOf } from './failure'
import { uniqueById } from './rows'
import { openSseStream, type Stream, type StreamEvent } from './stream'

export type { Stream, StreamEvent } from './stream'

export type InboxStatus = 'loading' | 'ready' | 'anonymous' | 'error'
export type InboxView = 'inbox' | 'archive'
export type ArchiveStatus = 'idle' | 'loading' | 'ready' | 'error'

// Where a failure happened: `token` is the host's getToken, `stream` the live connection.
export type InboxErrorSource = 'token' | 'inbox' | 'archive' | 'action' | 'stream'

// What the host hears about a failure. The widget shows one general message; this is for the host's own logs.
// `code` is the server's code (or NETWORK_ERROR and TIMEOUT), or TOKEN_UNAVAILABLE, STREAM_DOWN, UNKNOWN.
// `retryable` is true when the widget tries again on its own; false means it has stopped and needs a fix.
export type InboxError = {
  source: InboxErrorSource
  code: string
  retryable: boolean
  requestId?: string | undefined
  cause: unknown
}

// The archive is fetched only when first opened, so a bell that is never opened costs one request.
export type ArchiveState = {
  items: InboxItem[]
  next: string | null
  status: ArchiveStatus
  loadingMore: boolean
  // A later page failed. The rows already listed stay, and the next load-more retries.
  loadMoreFailed: boolean
  error: string | null
}

export type InboxState = {
  status: InboxStatus
  items: InboxItem[]
  // Older-page cursor for the inbox; null when every older row is loaded.
  next: string | null
  loadingMore: boolean
  // A later page failed. The rows already listed stay, and the next load-more retries.
  loadMoreFailed: boolean
  // Every inbox row, for the header count. The badge uses `unread`.
  total: number
  unread: number
  // The latest live arrival, so the bell can announce it once.
  announced: InboxItem | null
  error: string | null
  // False when the error will not clear on a retry, so the bell offers no "Try again".
  retryable: boolean
  view: InboxView
  archive: ArchiveState
}

export type InboxStoreOptions = {
  baseUrl: string
  appKey: string
  // Returns the recipient token for the signed-in user, or null for an anonymous visitor. A throw is a failure, not a
  // signed-out visitor: the widget retries it on a backoff, unless the error says it is not retryable, which stops it.
  getToken: () => Promise<string | null>
  // Hears every failure, for the host's logs and metrics. The widget shows its own message either way.
  onError?: (error: InboxError) => void
  fetchImpl?: FetchLike
  // Opens the live stream. The default reads it over fetch, with the token in the Authorization header.
  openStream?: (url: string, token: string) => Stream
  tokenRefreshMs?: number
  retryMinMs?: number
  retryMaxMs?: number
  // How long a stream must stay up before the retry schedule resets and a later drop counts as a new outage.
  streamStableMs?: number
  pageSize?: number
}

export type InboxStore = {
  getState(): InboxState
  subscribe(listener: () => void): () => void
  start(): Promise<void>
  stop(): void
  retry(): Promise<void>
  // Each action resolves once the server has answered: true when applied, false when it failed and the change was rolled back.
  markRead(ids: string[]): Promise<boolean>
  markAllRead(): Promise<boolean>
  loadMore(): Promise<void>
  openArchive(): Promise<void>
  closeArchive(): void
  loadMoreArchive(): Promise<void>
  archive(ids: string[]): Promise<boolean>
  archiveRead(): Promise<boolean>
  restore(ids: string[]): Promise<boolean>
}

const EMPTY_ARCHIVE: ArchiveState = {
  items: [],
  next: null,
  status: 'idle',
  loadingMore: false,
  loadMoreFailed: false,
  error: null,
}
// The state before the first load. Ports that show a failed bell without a store copy it from here.
export const INITIAL_STATE: InboxState = {
  status: 'loading',
  items: [],
  next: null,
  loadingMore: false,
  loadMoreFailed: false,
  total: 0,
  unread: 0,
  announced: null,
  error: null,
  retryable: true,
  view: 'inbox',
  archive: EMPTY_ARCHIVE,
}

// Tokens live 15 minutes on the server, so rotate well before that.
const DEFAULT_TOKEN_REFRESH_MS = 12 * 60_000

// The browser's own signals, typed loosely so the store also runs where there is no window (tests, workers).
type BrowserGlobals = {
  navigator?: { onLine?: boolean }
  document?: {
    hidden?: boolean
    addEventListener?: (type: string, listener: () => void) => void
    removeEventListener?: (type: string, listener: () => void) => void
  }
  addEventListener?: (type: string, listener: () => void) => void
  removeEventListener?: (type: string, listener: () => void) => void
}
const browser = globalThis as unknown as BrowserGlobals

// Automatic retries wait while the browser is offline or the tab is hidden, then run when it can.
const canRetryNow = () => browser.navigator?.onLine !== false && browser.document?.hidden !== true

// A transient failure invites a retry; a permanent one shows that retrying cannot help.
const messageFor = (failure: Failure) => (failure.retryable ? LOAD_ERROR_MESSAGE : UNAVAILABLE_MESSAGE)

// `cause` is the error the host's getToken threw, kept so a failed refresh can be classified by its own error.
type Refresh = { token: string | null; failure: Failure | null; cause?: unknown }

export function createInboxStore(options: InboxStoreOptions): InboxStore {
  const api = createInboxApi(options)
  const openStream =
    options.openStream ?? ((url: string, token: string) => openSseStream(options.fetchImpl ?? fetch, url, token))
  const tokenRefreshMs = options.tokenRefreshMs ?? DEFAULT_TOKEN_REFRESH_MS
  const streamStableMs = options.streamStableMs ?? 30_000
  const pageSize = options.pageSize ?? 20
  // One schedule for every automatic retry: a stream reconnect, a token refresh and a failed load all wait on it.
  const backoff = createBackoff({ minMs: options.retryMinMs ?? 1_000, maxMs: options.retryMaxMs ?? 30_000 })
  const listeners = new Set<() => void>()

  let state: InboxState = INITIAL_STATE
  // Bumped by every start and stop, so late responses from an earlier session are dropped.
  let generation = 0
  let token: string | null = null
  let cursor: string | null = null
  let stream: Stream | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  // Runs the schedule reset once the current stream has stayed up for `streamStableMs`.
  let stableTimer: ReturnType<typeof setTimeout> | undefined
  // A retry that came due while the browser was offline or hidden; it runs when the browser can.
  let waiting: (() => void) | null = null
  // The refresh in flight, shared by every caller that needs a new token at the same time.
  let refreshing: Promise<Refresh> | null = null
  // Each is set by the first failure of an outage, so the host hears about it once, not once per retry.
  let streamDown = false
  let tokenDown = false
  let inboxDown = false

  function setState(next: Partial<InboxState>) {
    state = { ...state, ...next }
    for (const listener of listeners) listener()
  }

  // The host hears about every failure. A throwing host callback must not break the store.
  function report(source: InboxErrorSource, failure: Failure, cause: unknown) {
    try {
      options.onError?.({
        source,
        code: failure.code,
        retryable: failure.retryable,
        requestId: failure.requestId,
        cause,
      })
    } catch {
      // The widget keeps working when the host's own logger does not.
    }
  }

  function fail(source: InboxErrorSource, cause: unknown) {
    report(source, failureOf(cause, 'UNKNOWN'), cause)
  }

  // The only place automatic retries are scheduled. The latest schedule wins, so retries never stack.
  function scheduleRetry(gen: number, run: (gen: number) => unknown, hintMs?: number) {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = undefined
      const attempt = () => {
        void run(gen)
      }
      if (canRetryNow()) attempt()
      else waiting = attempt
    }, backoff.next(hintMs))
  }

  // The browser came back online, or the tab became visible: run the retry that was waiting for it.
  function resume() {
    if (waiting === null || !canRetryNow()) return
    const run = waiting
    waiting = null
    run()
  }

  function attachResume() {
    browser.addEventListener?.('online', resume)
    browser.document?.addEventListener?.('visibilitychange', resume)
  }

  function detachResume() {
    browser.removeEventListener?.('online', resume)
    browser.document?.removeEventListener?.('visibilitychange', resume)
  }

  function closeStream() {
    stream?.close()
    stream = null
    // A stream that ends before it was stable has not earned a schedule reset.
    clearTimeout(stableTimer)
  }

  function cancelTimers() {
    clearTimeout(refreshTimer)
    clearTimeout(retryTimer)
    retryTimer = undefined
    waiting = null
  }

  function goAnonymous() {
    closeStream()
    cancelTimers()
    setState({
      status: 'anonymous',
      items: [],
      next: null,
      loadMoreFailed: false,
      total: 0,
      unread: 0,
      announced: null,
      error: null,
      archive: EMPTY_ARCHIVE,
    })
  }

  // A permanent token failure: no more retries, and the bell says so without offering one.
  function halt() {
    closeStream()
    cancelTimers()
    setState({ status: 'error', error: UNAVAILABLE_MESSAGE, retryable: false })
  }

  // One refresh at a time: callers that all need a new token at once share a single getToken call.
  function refreshToken(): Promise<Refresh> {
    refreshing ??= Promise.resolve()
      .then(() => options.getToken())
      .then(
        (fresh): Refresh => {
          tokenDown = false
          return { token: fresh, failure: null }
        },
        (cause: unknown): Refresh => {
          const failure = failureOf(cause, 'TOKEN_UNAVAILABLE')
          if (!tokenDown) report('token', failure, cause)
          tokenDown = true
          // The current token stays in use; the caller decides what a failed refresh means.
          return { token, failure, cause }
        },
      )
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  // Runs one request with the current token. An expired token is replaced once and the request retried. When the
  // replacement cannot be had, the refresh's own error is thrown, so a transient outage stays retryable.
  async function authorized<T>(run: (current: string) => Promise<T>): Promise<T> {
    if (token === null) throw new Error('not signed in')
    try {
      return await run(token)
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== TOKEN_ERROR_CODE) throw error
      const refresh = await refreshToken()
      if (refresh.failure) throw refresh.cause
      token = refresh.token
      if (token === null) throw error
      return run(token)
    }
  }

  // Opens the live stream from the cursor. Errors close it and reconnect on the shared schedule.
  function open(gen: number, live: string) {
    closeStream()
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => void rotate(gen), tokenRefreshMs)
    const current = openStream(api.streamUrl(cursor), live)
    stream = current
    const guard = (handler: (event: StreamEvent) => void) => (event: StreamEvent) => {
      if (gen === generation && stream === current) handler(event)
    }
    current.addEventListener(
      'open',
      guard(() => {
        // Opening is not yet proof of health: a stream that opens and drops at once keeps backing off, and its outage
        // is reported once. Only a stream that stays up resets both.
        clearTimeout(stableTimer)
        stableTimer = setTimeout(() => {
          backoff.reset()
          streamDown = false
        }, streamStableMs)
      }),
    )
    current.addEventListener('notification', guard(receive))
    current.addEventListener(
      'error',
      guard((event) => {
        // `data` carries the failure text the stream saw, when it saw one.
        if (!streamDown) report('stream', { code: 'STREAM_DOWN', retryable: true }, event.data)
        streamDown = true
        reconnect(gen)
      }),
    )
  }

  // Replaces the token before it expires. A retryable failure keeps the stream on the current token and tries again on
  // the schedule; a permanent one stops the bell. A fresh token reopens the stream from the same cursor, so no row is skipped.
  async function rotate(gen: number) {
    const refresh = await refreshToken()
    if (gen !== generation) return
    if (refresh.failure) {
      if (!refresh.failure.retryable) {
        halt()
        return
      }
      if (stream === null && token !== null) open(gen, token)
      scheduleRetry(gen, rotate, refresh.failure.retryAfterMs)
      return
    }
    if (refresh.token === null) return goAnonymous()
    token = refresh.token
    open(gen, token)
  }

  function reconnect(gen: number) {
    closeStream()
    scheduleRetry(gen, rotate)
  }

  // Live arrivals go to the inbox only; the archive is fetched on demand and never streamed.
  function receive(event: StreamEvent) {
    cursor = event.lastEventId || cursor
    let item: InboxItem
    try {
      item = JSON.parse(event.data) as InboxItem
    } catch {
      return
    }
    // Reconnects replay from the cursor, so a row can arrive twice.
    if (state.items.some((existing) => existing.id === item.id)) return
    setState({
      items: [item, ...state.items],
      total: state.total + 1,
      unread: item.readAt === null ? state.unread + 1 : state.unread,
      announced: item,
    })
  }

  // The token step of a session. A failure is shown and retried quietly: the error stays on screen until a try works.
  async function attempt(gen: number): Promise<void> {
    let fresh: string | null
    try {
      fresh = await options.getToken()
    } catch (cause) {
      if (gen !== generation) return
      // A throw is not a signed-out visitor.
      token = null
      const failure = failureOf(cause, 'TOKEN_UNAVAILABLE')
      if (!tokenDown) report('token', failure, cause)
      tokenDown = true
      setState({ status: 'error', error: messageFor(failure), retryable: failure.retryable })
      if (failure.retryable) scheduleRetry(gen, attempt, failure.retryAfterMs)
      return
    }
    if (gen !== generation) return
    tokenDown = false
    token = fresh
    if (token === null) return goAnonymous()
    await load(gen)
  }

  async function load(gen: number): Promise<void> {
    try {
      const page = await authorized((current) => api.list(current, { limit: pageSize }))
      if (gen !== generation) return
      if (token === null) return goAnonymous()
      cursor = page.latest
      inboxDown = false
      backoff.reset()
      setState({
        status: 'ready',
        items: page.items,
        next: page.next,
        loadMoreFailed: false,
        total: page.total,
        unread: page.unread,
        error: null,
        retryable: true,
      })
      open(gen, token)
    } catch (cause) {
      if (gen !== generation) return
      if (token === null) return goAnonymous()
      const failure = failureOf(cause, 'UNKNOWN')
      if (!inboxDown) report('inbox', failure, cause)
      inboxDown = true
      // A list already on screen stays while a reconcile fails; the error replaces only an empty bell.
      if (state.status !== 'ready') {
        setState({ status: 'error', error: messageFor(failure), retryable: failure.retryable })
      }
      if (failure.retryable) scheduleRetry(gen, load, failure.retryAfterMs)
    }
  }

  // Re-reads the first inbox page after an action the server may have applied to rows we have not loaded.
  // Loaded older pages are kept, minus anything no longer in the inbox.
  async function refreshHead(gen: number) {
    try {
      const page = await authorized((current) => api.list(current, { limit: pageSize }))
      if (gen !== generation) return
      const headIds = new Set(page.items.map((item) => item.id))
      const oldest = page.items.at(-1)?.createdAt
      // An empty first page means the inbox is empty, so no loaded row can still be in it. A row that shares the
      // oldest timestamp is still in the inbox: it was not on this page, so it stays.
      const tail =
        oldest === undefined ? [] : state.items.filter((item) => !headIds.has(item.id) && item.createdAt <= oldest)
      setState({
        items: uniqueById([...page.items, ...tail]),
        next: tail.length > 0 ? state.next : page.next,
        total: page.total,
        unread: page.unread,
      })
    } catch (cause) {
      // The optimistic state stands until a reconcile works. Not worth a banner, but the host still hears of it.
      const failure = failureOf(cause, 'UNKNOWN')
      report('inbox', failure, cause)
      if (gen === generation && failure.retryable) scheduleRetry(gen, load, failure.retryAfterMs)
    }
  }

  async function loadMore(): Promise<void> {
    if (state.next === null || state.loadingMore || state.status !== 'ready') return
    const gen = generation
    const before = state.next
    setState({ loadingMore: true, loadMoreFailed: false })
    try {
      const page = await authorized((current) => api.list(current, { limit: pageSize, before }))
      if (gen !== generation) return
      setState({ items: uniqueById([...state.items, ...page.items]), next: page.next, loadingMore: false })
    } catch (cause) {
      if (gen !== generation) return
      fail('inbox', cause)
      setState({ loadingMore: false, loadMoreFailed: true })
    }
  }

  function stop() {
    generation += 1
    closeStream()
    cancelTimers()
    detachResume()
  }

  async function start() {
    stop()
    const gen = generation
    attachResume()
    streamDown = false
    tokenDown = false
    inboxDown = false
    backoff.reset()
    // loadingMore is cleared here too: a load-more still in flight from the old generation never clears it.
    setState({
      status: 'loading',
      error: null,
      retryable: true,
      announced: null,
      view: 'inbox',
      archive: EMPTY_ARCHIVE,
      loadingMore: false,
      loadMoreFailed: false,
    })
    await attempt(gen)
  }

  // Optimistic: the list already shows the new state. On failure the lists reload from the server.
  function send(body: { ids: string[] } | { all: true }): Promise<boolean> {
    const gen = generation
    return authorized((current) => api.markRead(current, body)).then(
      () => true,
      (cause) => {
        fail('action', cause)
        if (gen === generation) void load(gen)
        return false
      },
    )
  }

  function markRead(ids: string[]): Promise<boolean> {
    const fresh = state.items.filter((item) => item.readAt === null && ids.includes(item.id))
    if (fresh.length === 0) return Promise.resolve(true)
    const freshIds = fresh.map((item) => item.id)
    const now = new Date().toISOString()
    setState({
      items: state.items.map((item) => (freshIds.includes(item.id) ? { ...item, readAt: now } : item)),
      unread: Math.max(0, state.unread - fresh.length),
    })
    return send({ ids: freshIds })
  }

  function markAllRead(): Promise<boolean> {
    if (state.unread === 0) return Promise.resolve(true)
    const now = new Date().toISOString()
    setState({ items: state.items.map((item) => ({ ...item, readAt: item.readAt ?? now })), unread: 0 })
    return send({ all: true })
  }

  // The archive job owns its own list, paging and moves. It shares the state and the signed-in call with this store.
  const archiveJob = createArchive({
    api,
    pageSize,
    getState: () => state,
    setState,
    authorized,
    fail,
    generation: () => generation,
    reloadInbox: load,
    refreshHead,
  })

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start,
    stop,
    retry: start,
    markRead,
    markAllRead,
    loadMore,
    openArchive: archiveJob.open,
    closeArchive: archiveJob.close,
    loadMoreArchive: archiveJob.loadMore,
    archive: archiveJob.archive,
    archiveRead: archiveJob.archiveRead,
    restore: archiveJob.restore,
  }
}
