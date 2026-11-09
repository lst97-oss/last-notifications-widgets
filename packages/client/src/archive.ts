// The archive job: its own list, its own paging, and the moves between the inbox and the archive. The store passes in
// only what the two share (the state, the signed-in call, the failure hook and the inbox reload).
import { type InboxApi, LOAD_ERROR_MESSAGE } from './api'
import { uniqueById } from './rows'
import type { ArchiveState, InboxErrorSource, InboxState } from './store'

export type ArchiveDeps = {
  api: InboxApi
  pageSize: number
  getState: () => InboxState
  setState: (next: Partial<InboxState>) => void
  authorized: <T>(run: (token: string) => Promise<T>) => Promise<T>
  fail: (source: InboxErrorSource, cause: unknown) => void
  generation: () => number
  reloadInbox: (gen: number) => Promise<void>
  refreshHead: (gen: number) => Promise<void>
}

// Rows move optimistically, then the server is told. A refused move reloads both lists, so the screen never keeps a
// change the server did not accept.
export function createArchive(deps: ArchiveDeps) {
  const { api, pageSize, getState, setState } = deps

  const setArchive = (next: Partial<ArchiveState>) => setState({ archive: { ...getState().archive, ...next } })

  async function loadArchive(gen: number, from?: string): Promise<void> {
    const isMore = from !== undefined
    setArchive(
      isMore ? { loadingMore: true, loadMoreFailed: false } : { status: 'loading', error: null, loadMoreFailed: false },
    )
    try {
      const page = await deps.authorized((current) =>
        api.list(current, { limit: pageSize, view: 'archived', ...(isMore ? { before: from } : {}) }),
      )
      if (gen !== deps.generation()) return
      setArchive({
        items: uniqueById(isMore ? [...getState().archive.items, ...page.items] : page.items),
        next: page.next,
        status: 'ready',
        loadingMore: false,
        loadMoreFailed: false,
        error: null,
      })
    } catch (cause) {
      if (gen !== deps.generation()) return
      deps.fail('archive', cause)
      // Only the first page can replace the list with an error. A later page keeps the rows already listed.
      if (isMore) setArchive({ loadingMore: false, loadMoreFailed: true })
      else setArchive({ status: 'error', loadingMore: false, error: LOAD_ERROR_MESSAGE })
    }
  }

  // Refetches the archive only if it was ever loaded; an unopened archive stays unfetched.
  function reloadIfLoaded(gen: number) {
    if (getState().archive.status !== 'idle') void loadArchive(gen)
  }

  // After a refused move both lists reload from the server, replacing the optimistic change.
  function reloadAfterFailure(gen: number) {
    if (gen !== deps.generation()) return
    void deps.reloadInbox(gen)
    reloadIfLoaded(gen)
  }

  async function openArchive(): Promise<void> {
    if (getState().view === 'archive') return
    setState({ view: 'archive' })
    const { status } = getState().archive
    if (status === 'idle' || status === 'error') await loadArchive(deps.generation())
  }

  function closeArchive() {
    setState({ view: 'inbox' })
  }

  async function loadMoreArchive(): Promise<void> {
    const { archive } = getState()
    if (archive.next === null || archive.loadingMore || archive.status !== 'ready') return
    await loadArchive(deps.generation(), archive.next)
  }

  // Moves rows from the inbox to the archive. Archiving marks them read, so the badge drops by the unread ones.
  function archive(ids: string[]): Promise<boolean> {
    const state = getState()
    const picked = state.items.filter((item) => ids.includes(item.id))
    if (picked.length === 0) return Promise.resolve(true)
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
    const gen = deps.generation()
    return deps
      .authorized((current) => api.archive(current, { ids: pickedIds }))
      .then(
        () => true,
        (cause) => {
          deps.fail('action', cause)
          reloadAfterFailure(gen)
          return false
        },
      )
  }

  // Archives every read row. The server may hold read rows beyond the loaded pages, so both lists re-read.
  function archiveRead(): Promise<boolean> {
    const state = getState()
    const now = new Date().toISOString()
    const moved = state.items.filter((item) => item.readAt !== null).map((item) => ({ ...item, archivedAt: now }))
    const movedIds = new Set(moved.map((item) => item.id))
    setState({
      items: state.items.filter((item) => !movedIds.has(item.id)),
      total: Math.max(0, state.total - moved.length),
      archive: { ...state.archive, items: uniqueById([...moved, ...state.archive.items]) },
    })
    const gen = deps.generation()
    return deps
      .authorized((current) => api.archive(current, { read: true }))
      .then(
        async () => {
          if (gen === deps.generation()) {
            await deps.refreshHead(gen)
            reloadIfLoaded(gen)
          }
          return true
        },
        (cause) => {
          deps.fail('action', cause)
          reloadAfterFailure(gen)
          return false
        },
      )
  }

  // Brings archived rows back to the inbox. They are read already, so the badge does not change.
  function restore(ids: string[]): Promise<boolean> {
    const state = getState()
    const picked = state.archive.items.filter((item) => ids.includes(item.id))
    if (picked.length === 0) return Promise.resolve(true)
    const pickedIds = picked.map((item) => item.id)
    const restored = picked.map((item) => ({ ...item, archivedAt: null }))
    setState({
      items: uniqueById([...state.items, ...restored]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      total: state.total + pickedIds.length,
      archive: { ...state.archive, items: state.archive.items.filter((item) => !pickedIds.includes(item.id)) },
    })
    const gen = deps.generation()
    return deps
      .authorized((current) => api.restore(current, pickedIds))
      .then(
        () => true,
        (cause) => {
          deps.fail('action', cause)
          reloadAfterFailure(gen)
          return false
        },
      )
  }

  return {
    open: openArchive,
    close: closeArchive,
    loadMore: loadMoreArchive,
    archive,
    archiveRead,
    restore,
  }
}
