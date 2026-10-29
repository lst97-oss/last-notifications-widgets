import { ApiError, createInboxApi, type InboxItem, LOAD_ERROR_MESSAGE, TOKEN_ERROR_CODE } from './api'
import { openSseStream, type Stream, type StreamEvent } from './stream'

export type { Stream, StreamEvent } from './stream'

export type InboxStatus = 'loading' | 'ready' | 'anonymous' | 'error'
export type InboxView = 'inbox' | 'archive'
export type ArchiveStatus = 'idle' | 'loading' | 'ready' | 'error'

// The archive is fetched only when first opened, so a bell that is never opened costs one request.
export type ArchiveState = {
  items: InboxItem[]
  next: string | null
  status: ArchiveStatus
  loadingMore: boolean
  error: string | null
}

export type InboxState = {
  status: InboxStatus
  items: InboxItem[]
  // Older-page cursor for the inbox; null when every older row is loaded.
  next: string | null
  loadingMore: boolean
  // Every inbox row, for the header count. The badge uses `unread`.
  total: number
  unread: number
  // The latest live arrival, so the bell can announce it once.
  announced: InboxItem | null
  error: string | null
  view: InboxView
  archive: ArchiveState
}

export type InboxStoreOptions = {
  baseUrl: string
  appKey: string
  // Returns the recipient token for the signed-in user, or null for an anonymous visitor.
  getToken: () => Promise<string | null>
  fetchImpl?: typeof fetch
  // Opens the live stream. The default reads it over fetch, with the token in the Authorization header.
  openStream?: (url: string, token: string) => Stream
  tokenRefreshMs?: number
  retryMinMs?: number
  retryMaxMs?: number
  pageSize?: number
}

export type InboxStore = {
  getState(): InboxState
  subscribe(listener: () => void): () => void
  start(): Promise<void>
  stop(): void
  retry(): Promise<void>
  // Each action resolves once the server has answered, or the optimistic change has been rolled back.
  markRead(ids: string[]): Promise<void>
  markAllRead(): Promise<void>
  loadMore(): Promise<void>
  openArchive(): Promise<void>
  closeArchive(): void
  loadMoreArchive(): Promise<void>
  archive(ids: string[]): Promise<void>
  archiveRead(): Promise<void>
  restore(ids: string[]): Promise<void>
}

const EMPTY_ARCHIVE: ArchiveState = { items: [], next: null, status: 'idle', loadingMore: false, error: null }
const INITIAL: InboxState = {
  status: 'loading',
  items: [],
  next: null,
  loadingMore: false,
  total: 0,
  unread: 0,
  announced: null,
  error: null,
  view: 'inbox',
  archive: EMPTY_ARCHIVE,
}

// Tokens live 15 minutes on the server, so rotate well before that.
const DEFAULT_TOKEN_REFRESH_MS = 12 * 60_000

// Keeps the first occurrence of each id: a page boundary or a reconnect can deliver a row twice.
function uniqueById(items: InboxItem[]): InboxItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function createInboxStore(options: InboxStoreOptions): InboxStore {
  const api = createInboxApi(options)
  const openStream =
    options.openStream ?? ((url: string, token: string) => openSseStream(options.fetchImpl ?? fetch, url, token))
  const tokenRefreshMs = options.tokenRefreshMs ?? DEFAULT_TOKEN_REFRESH_MS
  const retryMinMs = options.retryMinMs ?? 1_000
  const retryMaxMs = options.retryMaxMs ?? 30_000
  const pageSize = options.pageSize ?? 20
  const listeners = new Set<() => void>()

  let state: InboxState = INITIAL
  // Bumped by every start and stop, so late responses from an earlier session are dropped.
  let generation = 0
  let token: string | null = null
  let cursor: string | null = null
  let stream: Stream | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retryDelay = retryMinMs

  function setState(next: Partial<InboxState>) {
    state = { ...state, ...next }
    for (const listener of listeners) listener()
  }

  function setArchive(next: Partial<ArchiveState>) {
    setState({ archive: { ...state.archive, ...next } })
  }

  // A failed refresh keeps the current token; the next request then reports its own error.
  const nextToken = () => options.getToken().catch(() => token)

  function closeStream() {
    stream?.close()
    stream = null
  }

  function cancelTimers() {
    clearTimeout(refreshTimer)
    clearTimeout(retryTimer)
  }

  function goAnonymous() {
    closeStream()
    cancelTimers()
    setState({
      status: 'anonymous',
      items: [],
      next: null,
      total: 0,
      unread: 0,
      announced: null,
      error: null,
      archive: EMPTY_ARCHIVE,
    })
  }

  // Runs one request with the current token; an expired token is replaced once and the request retried.
  async function authorized<T>(run: (current: string) => Promise<T>): Promise<T> {
    if (token === null) throw new Error('not signed in')
    try {
      return await run(token)
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== TOKEN_ERROR_CODE) throw error
      token = await nextToken()
      if (token === null) throw error
      return run(token)
    }
  }

  // Opens the live stream from the cursor. Errors close it and reconnect with backoff.
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
        retryDelay = retryMinMs
      }),
    )
    current.addEventListener('notification', guard(receive))
    current.addEventListener(
      'error',
      guard(() => reconnect(gen)),
    )
  }

  // A fresh token reopens the stream from the same cursor, so no row is skipped.
  async function rotate(gen: number) {
    const fresh = await nextToken()
    if (gen !== generation) return
    if (fresh === null) return goAnonymous()
    token = fresh
    open(gen, fresh)
  }

  function reconnect(gen: number) {
    closeStream()
    clearTimeout(retryTimer)
    // Random spread: tabs that lost the stream together must not all retry in the same instant.
    retryTimer = setTimeout(() => void rotate(gen), retryDelay * (0.5 + Math.random()))
    retryDelay = Math.min(retryDelay * 2, retryMaxMs)
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

  async function load(gen: number) {
    try {
      const page = await authorized((current) => api.list(current, { limit: pageSize }))
      if (gen !== generation) return
      if (token === null) return goAnonymous()
      cursor = page.latest
      setState({
        status: 'ready',
        items: page.items,
        next: page.next,
        total: page.total,
        unread: page.unread,
        error: null,
      })
      open(gen, token)
    } catch {
      if (gen !== generation) return
      if (token === null) return goAnonymous()
      setState({ status: 'error', error: LOAD_ERROR_MESSAGE })
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
      // An empty first page means the inbox is empty, so no loaded row can still be in it.
      const tail =
        oldest === undefined ? [] : state.items.filter((item) => !headIds.has(item.id) && item.createdAt < oldest)
      setState({
        items: uniqueById([...page.items, ...tail]),
        next: tail.length > 0 ? state.next : page.next,
        total: page.total,
        unread: page.unread,
      })
    } catch {
      // The optimistic state stands until the next load; a failed refresh is not worth a banner.
    }
  }

  async function loadMore(): Promise<void> {
    if (state.next === null || state.loadingMore || state.status !== 'ready') return
    const gen = generation
    const before = state.next
    setState({ loadingMore: true })
    try {
      const page = await authorized((current) => api.list(current, { limit: pageSize, before }))
      if (gen !== generation) return
      setState({ items: uniqueById([...state.items, ...page.items]), next: page.next, loadingMore: false })
    } catch {
      if (gen === generation) setState({ loadingMore: false })
    }
  }

  async function loadArchive(gen: number, from?: string): Promise<void> {
    const isMore = from !== undefined
    setArchive(isMore ? { loadingMore: true } : { status: 'loading', error: null })
    try {
      const page = await authorized((current) =>
        api.list(current, { limit: pageSize, view: 'archived', ...(isMore ? { before: from } : {}) }),
      )
      if (gen !== generation) return
      setArchive({
        items: uniqueById(isMore ? [...state.archive.items, ...page.items] : page.items),
        next: page.next,
        status: 'ready',
        loadingMore: false,
        error: null,
      })
    } catch {
      if (gen !== generation) return
      setArchive({ status: 'error', loadingMore: false, error: LOAD_ERROR_MESSAGE })
    }
  }

  // Refetches the archive only if it was ever loaded; an unopened archive stays unfetched.
  function reloadArchiveIfLoaded(gen: number) {
    if (state.archive.status !== 'idle') void loadArchive(gen)
  }

  // After a failed action both lists reload from the server, replacing the optimistic change.
  function reloadAfterFailure(gen: number) {
    if (gen !== generation) return
    void load(gen)
    reloadArchiveIfLoaded(gen)
  }

  function stop() {
    generation += 1
    closeStream()
    cancelTimers()
  }

  async function start() {
    stop()
    const gen = generation
    // loadingMore is cleared here too: a load-more still in flight from the old generation never clears it.
    setState({
      status: 'loading',
      error: null,
      announced: null,
      view: 'inbox',
      archive: EMPTY_ARCHIVE,
      loadingMore: false,
    })
    token = await nextToken()
    if (gen !== generation) return
    if (token === null) return goAnonymous()
    await load(gen)
  }

  // Optimistic: the list already shows the new state. On failure the lists reload from the server.
  function send(body: { ids: string[] } | { all: true }): Promise<void> {
    const gen = generation
    return authorized((current) => api.markRead(current, body)).catch(() => {
      if (gen === generation) void load(gen)
    })
  }

  function markRead(ids: string[]): Promise<void> {
    const fresh = state.items.filter((item) => item.readAt === null && ids.includes(item.id))
    if (fresh.length === 0) return Promise.resolve()
    const freshIds = fresh.map((item) => item.id)
    const now = new Date().toISOString()
    setState({
      items: state.items.map((item) => (freshIds.includes(item.id) ? { ...item, readAt: now } : item)),
      unread: Math.max(0, state.unread - fresh.length),
    })
    return send({ ids: freshIds })
  }

  function markAllRead(): Promise<void> {
    if (state.unread === 0) return Promise.resolve()
    const now = new Date().toISOString()
    setState({ items: state.items.map((item) => ({ ...item, readAt: item.readAt ?? now })), unread: 0 })
    return send({ all: true })
  }

  async function openArchive(): Promise<void> {
    if (state.view === 'archive') return
    setState({ view: 'archive' })
    if (state.archive.status === 'idle' || state.archive.status === 'error') {
      await loadArchive(generation)
    }
  }

  function closeArchive() {
    setState({ view: 'inbox' })
  }

  async function loadMoreArchive(): Promise<void> {
    if (state.archive.next === null || state.archive.loadingMore || state.archive.status !== 'ready') return
    await loadArchive(generation, state.archive.next)
  }

  // Moves rows from the inbox to the archive. Archiving marks them read, so the badge drops by the unread ones.
  function archive(ids: string[]): Promise<void> {
    const picked = state.items.filter((item) => ids.includes(item.id))
    if (picked.length === 0) return Promise.resolve()
    const pickedIds = picked.map((item) => item.id)
    const now = new Date().toISOString()
    const moved = picked.map((item) => ({ ...item, readAt: item.readAt ?? now, archivedAt: now }))
    const unread = picked.filter((item) => item.readAt === null).length
    setState({
      items: state.items.filter((item) => !pickedIds.includes(item.id)),
      total: Math.max(0, state.total - picked.length),
      unread: Math.max(0, state.unread - unread),
      archive: { ...state.archive, items: uniqueById([...moved, ...state.archive.items]) },
    })
    const gen = generation
    return authorized((current) => api.archive(current, { ids: pickedIds })).then(
      () => undefined,
      () => reloadAfterFailure(gen),
    )
  }

  // Archives every read row. The server may hold read rows beyond the loaded pages, so both lists re-read.
  function archiveRead(): Promise<void> {
    const now = new Date().toISOString()
    const moved = state.items.filter((item) => item.readAt !== null).map((item) => ({ ...item, archivedAt: now }))
    if (moved.length === 0) return Promise.resolve()
    const movedIds = new Set(moved.map((item) => item.id))
    setState({
      items: state.items.filter((item) => !movedIds.has(item.id)),
      total: Math.max(0, state.total - moved.length),
      archive: { ...state.archive, items: uniqueById([...moved, ...state.archive.items]) },
    })
    const gen = generation
    return authorized((current) => api.archive(current, { read: true })).then(
      async () => {
        if (gen !== generation) return
        await refreshHead(gen)
        reloadArchiveIfLoaded(gen)
      },
      () => reloadAfterFailure(gen),
    )
  }

  // Brings archived rows back to the inbox. They are read already, so the badge does not change.
  function restore(ids: string[]): Promise<void> {
    const picked = state.archive.items.filter((item) => ids.includes(item.id))
    if (picked.length === 0) return Promise.resolve()
    const pickedIds = picked.map((item) => item.id)
    const restored = picked.map((item) => ({ ...item, archivedAt: null }))
    setState({
      items: uniqueById([...state.items, ...restored]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      total: state.total + pickedIds.length,
      archive: { ...state.archive, items: state.archive.items.filter((item) => !pickedIds.includes(item.id)) },
    })
    const gen = generation
    return authorized((current) => api.restore(current, pickedIds)).then(
      () => undefined,
      () => reloadAfterFailure(gen),
    )
  }

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
    openArchive,
    closeArchive,
    loadMoreArchive,
    archive,
    archiveRead,
    restore,
  }
}
