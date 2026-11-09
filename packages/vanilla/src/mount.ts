import {
  type BellNote,
  bellAnnouncement,
  bellLabel,
  createInboxStore,
  createTokenProvider,
  INITIAL_STATE,
  type InboxError,
  type InboxItem,
  type InboxState,
  type InboxStore,
  LOAD_ERROR_MESSAGE,
  themeVarsToStyle,
  type WidgetTheme,
} from '@last-notifications-widgets/client'
import { Archive, ArchiveX, ArrowLeft, Bell, BellRing, CheckCheck, Ellipsis, LoaderCircle, TriangleAlert } from 'lucide'

import * as C from './classes'
import { cn } from './cn'
import { type Child, h, icon } from './dom'
import { empty, errorBlock, row, skeletons } from './views'

export type Theme = 'light' | 'dark' | 'system'

export type NotificationBellOptions = {
  baseUrl: string
  appKey: string
  // The host's stable user id. Renders nothing when null or undefined; a change drops the list for the new session.
  session: string | null | undefined
  // The host's token endpoint (the widget calls it), or `getToken` for the host's own call. getToken wins if both.
  tokenUrl?: string
  getToken?: () => Promise<string | null>
  onError?: (error: InboxError) => void
  theme?: Theme
  themeVars?: WidgetTheme
  className?: string
}

export type NotificationBellHandle = {
  // Applies new options. A change to session, baseUrl, appKey or tokenUrl remounts the store, like the React key.
  update(next: Partial<NotificationBellOptions>): void
  destroy(): void
}

export type NotificationBellUnavailableOptions = {
  onRetry: () => void
  theme?: Theme
  themeVars?: WidgetTheme
  className?: string
}

const SCROLL = 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'

// The state the unavailable bell shows: a failed load with no store behind it.
const UNAVAILABLE_STATE: InboxState = { ...INITIAL_STATE, status: 'error', error: LOAD_ERROR_MESSAGE }

type BellInstance = { applyTheme(): void; destroy(): void }
type Pager = { next: string | null; loadingMore: boolean; loadMoreFailed: boolean; onMore: () => void }

// Mounts the live bell into `container`. Renders nothing while session is null, like the React component.
export function mountNotificationBell(
  container: HTMLElement,
  initial: NotificationBellOptions,
): NotificationBellHandle {
  let options = initial
  let bell: BellInstance | undefined
  let bellKey = ''
  const sync = () => {
    if (options.session == null) {
      bell?.destroy()
      bell = undefined
      bellKey = ''
      return
    }
    const key = JSON.stringify([options.baseUrl, options.appKey, options.session, options.tokenUrl])
    if (bell && key === bellKey) {
      bell.applyTheme()
      return
    }
    bell?.destroy()
    bellKey = key
    bell = createBell(container, () => options, null)
  }
  sync()
  return {
    update(next) {
      options = { ...options, ...next }
      sync()
    },
    destroy() {
      bell?.destroy()
      bell = undefined
      bellKey = ''
    },
  }
}

// The bell's error state, for a host that cannot mount the live bell yet. Takes no token, key or URL.
export function mountNotificationBellUnavailable(
  container: HTMLElement,
  options: NotificationBellUnavailableOptions,
): { destroy(): void } {
  const bell = createBell(container, () => options, options)
  return { destroy: () => bell.destroy() }
}

function createBell(
  container: HTMLElement,
  read: () => NotificationBellOptions | NotificationBellUnavailableOptions,
  unavailable: NotificationBellUnavailableOptions | null,
): BellInstance {
  const first = read()
  const isLive = unavailable === null
  const tokenProvider = createTokenProvider({ url: ('tokenUrl' in first ? first.tokenUrl : undefined) ?? '' })
  const store: InboxStore | null = isLive
    ? createInboxStore({
        baseUrl: (first as NotificationBellOptions).baseUrl,
        appKey: (first as NotificationBellOptions).appKey,
        // Read the latest options at call time, so a host's new getToken or onError takes effect without a remount.
        getToken: () => {
          const current = read() as NotificationBellOptions
          return current.getToken ? current.getToken() : tokenProvider()
        },
        onError: (error) => (read() as NotificationBellOptions).onError?.(error),
      })
    : null

  let state: InboxState = store ? store.getState() : UNAVAILABLE_STATE
  let note: BellNote = { text: '', after: null }
  let open = false
  let menuOpen = false
  let lastView = state.view
  let observer: IntersectionObserver | undefined
  // Set by destroy(). An action can still be waiting on the server; its answer must not put this bell back.
  let destroyed = false

  // The root is the widget's own scope: the theme's .ln-bell rules and themeVars apply inside it only.
  const root = h('div', { class: 'ln-bell relative inline-block' })
  const trigger = h('button', {
    type: 'button',
    class: C.TRIGGER,
    'aria-haspopup': 'dialog',
    'data-ln-key': 'trigger',
    onClick: () => toggle(),
  })
  const panel = h('div', {
    role: 'dialog',
    'aria-label': 'Notifications',
    tabindex: '-1',
    'data-state': 'open',
    class: cn(C.POPOVER_CONTENT, 'fixed z-50'),
  })
  const announcer = h('div', { role: 'status', 'aria-live': 'polite', class: 'sr-only' })
  root.append(trigger, announcer)

  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined
  const isDark = () => {
    const theme = read().theme ?? 'system'
    return theme === 'system' ? Boolean(media?.matches) : theme === 'dark'
  }
  const applyTheme = () => {
    const current = read()
    const dark = isDark()
    root.className = cn('ln-bell relative inline-block', dark && 'dark', current.className)
    for (const [name, value] of Object.entries(themeVarsToStyle(current.themeVars, dark))) {
      root.style.setProperty(name, value)
    }
  }
  const onMediaChange = () => applyTheme()
  media?.addEventListener('change', onMediaChange)
  applyTheme()

  const close = () => {
    open = false
    menuOpen = false
    render()
  }
  function toggle() {
    open = !open
    menuOpen = false
    render()
    if (open) panel.focus()
  }
  // Below the trigger, right-aligned to it, and kept inside the viewport (as Base UI's collision handling does).
  const place = () => {
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(panel.offsetWidth, window.innerWidth - 16)
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
    panel.style.top = `${rect.bottom + 4}px`
    panel.style.left = `${left}px`
  }
  const onPointerDown = (event: Event) => {
    if (open && !root.contains(event.target as Node)) close()
  }
  const onViewportChange = () => {
    if (open) place()
  }
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    if (menuOpen) {
      menuOpen = false
      render()
      return
    }
    if (!open) return
    close()
    trigger.focus()
  }
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)

  // A message from an action. Tied to the newest live arrival at the time it was set (see bellAnnouncement).
  function announce(text: string) {
    note = { text, after: state.announced }
    render()
  }

  function focusKey(): string | undefined {
    const active = document.activeElement
    return active instanceof HTMLElement && root.contains(active) ? active.dataset.lnKey : undefined
  }
  // Re-rendering rebuilds the panel. Keep the keyboard user's place by re-focusing the same keyed control.
  function restoreFocus(key: string | undefined) {
    if (!key) return
    const match = [...root.querySelectorAll<HTMLElement>('[data-ln-key]')].find((el) => el.dataset.lnKey === key)
    match?.focus()
  }

  function render() {
    if (destroyed) return
    const focused = focusKey()
    if (state.status === 'anonymous') {
      root.remove()
      return
    }
    if (!root.isConnected) container.append(root)

    trigger.setAttribute('aria-label', bellLabel(state))
    trigger.setAttribute('aria-expanded', String(open))
    const badge = triggerBadge()
    trigger.replaceChildren(icon(Bell, 'size-4'), ...(badge ? [badge] : []))

    if (open) {
      // Rebuilding the panel would put the list back at the top. Keep the place while the same view stays open.
      const top =
        panel.isConnected && state.view === lastView
          ? panel.querySelector<HTMLElement>('.overflow-y-auto')?.scrollTop
          : undefined
      panel.replaceChildren(...panelChildren())
      const list = panel.querySelector<HTMLElement>('.overflow-y-auto')
      if (list && top !== undefined) list.scrollTop = top
      // Inside the root, so the popup keeps the .ln-bell theme scope; `fixed` positioning lifts it out of layout flow.
      if (!panel.isConnected) root.append(panel)
      place()
    } else panel.remove()

    announcer.textContent = bellAnnouncement(state, note)
    restoreFocus(focused)
    // Opening the archive moves focus to its heading, as the React archive does.
    if (open && state.view === 'archive' && lastView !== 'archive') {
      root.querySelector<HTMLElement>('[data-ln-key="archive-heading"]')?.focus()
    }
    lastView = state.view
    watchSentinel()
  }

  function triggerBadge(): Child {
    if (state.status === 'error')
      return h(
        'span',
        { 'aria-hidden': 'true', 'data-ln-error-icon': '', class: C.ERROR_ICON },
        icon(TriangleAlert, 'size-3'),
      )
    // The count is unknown until the first page lands; a placeholder keeps it from reading as zero.
    if (state.status === 'loading')
      return h('span', { 'aria-hidden': 'true', 'data-ln-placeholder': '', class: C.PLACEHOLDER })
    if (state.unread > 0)
      return h('span', { 'aria-hidden': 'true', class: C.BELL_BADGE }, state.unread > 99 ? '99+' : String(state.unread))
    return null
  }

  function panelChildren(): HTMLElement[] {
    if (!store) return [errorBlock(LOAD_ERROR_MESSAGE, true, () => unavailable?.onRetry())]
    return state.view === 'archive' ? archiveView(store) : inboxView(store)
  }

  function inboxView(current: InboxStore): HTMLElement[] {
    const hasRead = state.total > state.unread
    const total =
      state.status === 'loading'
        ? h('span', {
            'aria-hidden': 'true',
            'data-ln-placeholder': '',
            class: 'h-5 w-6 rounded-full bg-muted-foreground/20 motion-safe:animate-pulse',
          })
        : state.total > 0
          ? h('span', { class: C.HEADER_BADGE }, state.total > 99 ? '99+' : String(state.total))
          : null
    const header = h(
      'header',
      { class: 'flex items-center justify-between gap-2 border-b px-4 py-3' },
      h(
        'h2',
        { 'data-slot': 'popover-title', class: 'flex items-center gap-2 text-base font-semibold' },
        'Notifications',
        total,
      ),
      h(
        'div',
        { class: 'flex items-center gap-1' },
        h(
          'button',
          {
            type: 'button',
            title: 'Mark all as read',
            'aria-label': 'Mark all as read',
            disabled: state.unread === 0,
            class: C.TOUCH_ICON_BUTTON,
            'data-ln-key': 'mark-all',
            onClick: () =>
              void current.markAllRead().then((applied) => applied || announce("Couldn't mark all as read")),
          },
          icon(CheckCheck, 'size-4'),
        ),
        h(
          'button',
          {
            type: 'button',
            title: 'Archive',
            'aria-label': 'Open archive',
            class: C.TOUCH_ICON_BUTTON,
            'data-ln-key': 'open-archive',
            onClick: () => void current.openArchive(),
          },
          icon(Archive, 'size-4'),
        ),
        moreMenu(hasRead, current),
      ),
    )
    return [header, inboxBody(current)]
  }

  function moreMenu(hasRead: boolean, current: InboxStore): HTMLElement {
    const item = h(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        disabled: !hasRead,
        class: C.MENU_ITEM,
        onClick: () => {
          menuOpen = false
          void current
            .archiveRead()
            .then((applied) =>
              announce(applied ? 'Archived read notifications' : "Couldn't archive read notifications"),
            )
        },
      },
      'Archive all read',
    )
    return h(
      'div',
      { class: 'relative' },
      h(
        'button',
        {
          type: 'button',
          'aria-label': 'More actions',
          'aria-haspopup': 'menu',
          'aria-expanded': menuOpen,
          class: C.TOUCH_ICON_BUTTON,
          'data-ln-key': 'more',
          onClick: () => {
            menuOpen = !menuOpen
            render()
          },
        },
        icon(Ellipsis, 'size-4'),
      ),
      menuOpen
        ? h('div', { role: 'menu', class: cn(C.MENU_CONTENT, 'absolute end-0 top-full z-50 mt-1') }, item)
        : null,
    )
  }

  function inboxBody(current: InboxStore): HTMLElement {
    if (state.status === 'loading') return skeletons()
    if (state.status === 'error') return errorBlock(state.error ?? '', state.retryable, () => void current.retry())
    if (state.items.length === 0) return empty(BellRing, "You're all caught up", 'New notifications will appear here.')
    const pager: Pager = {
      next: state.next,
      loadingMore: state.loadingMore,
      loadMoreFailed: state.loadMoreFailed,
      onMore: () => void current.loadMore(),
    }
    return rowsView(state.items, pager, true, (item) =>
      row(item, {
        action: 'archive',
        onOpen: () => current.markRead([item.id]),
        onAction: () => {
          announce(`Archived ${item.title}`)
          void current.archive([item.id]).then((applied) => applied || announce(`Couldn't archive ${item.title}`))
        },
      }),
    )
  }

  function archiveView(current: InboxStore): HTMLElement[] {
    const archive = state.archive
    const header = h(
      'header',
      { class: 'flex items-center gap-2 border-b px-2 py-3' },
      h(
        'button',
        {
          type: 'button',
          'aria-label': 'Back to notifications',
          class: C.TOUCH_ICON_BUTTON,
          'data-ln-key': 'back',
          onClick: () => current.closeArchive(),
        },
        icon(ArrowLeft, 'size-4'),
      ),
      h(
        'div',
        { class: 'min-w-0' },
        h(
          'h2',
          { tabindex: '-1', 'data-ln-key': 'archive-heading', class: 'text-base font-semibold outline-none' },
          'Archived',
        ),
        h('p', { class: 'text-xs text-muted-foreground' }, 'Archived notifications are deleted after 30 days.'),
      ),
    )
    if (archive.status === 'loading' || archive.status === 'idle') return [header, skeletons()]
    if (archive.status === 'error')
      return [
        header,
        errorBlock(archive.error ?? '', true, () => {
          current.closeArchive()
          void current.openArchive()
        }),
      ]
    if (archive.items.length === 0)
      return [header, empty(ArchiveX, 'Nothing archived yet', 'Archived notifications stay here for 30 days.')]
    const pager: Pager = {
      next: archive.next,
      loadingMore: archive.loadingMore,
      loadMoreFailed: archive.loadMoreFailed,
      onMore: () => void current.loadMoreArchive(),
    }
    return [
      header,
      rowsView(archive.items, pager, false, (item) =>
        row(item, {
          action: 'restore',
          onAction: () => {
            announce(`Restored ${item.title}`)
            void current.restore([item.id]).then((applied) => applied || announce(`Couldn't restore ${item.title}`))
          },
        }),
      ),
    ]
  }

  // Older inbox pages load when the sentinel scrolls into view; "Load more" is the keyboard path. The archive has
  // no sentinel, only the button. After a failed page the bell stops watching: a new observer fires at once while the
  // sentinel is on screen, which would ask for the same page again in a loop. "Try again" is the way back.
  function watchSentinel() {
    observer?.disconnect()
    observer = undefined
    const sentinel = panel.querySelector<HTMLElement>('[data-ln-sentinel]')
    if (!sentinel || !store || state.loadMoreFailed) return
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void store.loadMore()
      },
      { root: sentinel.parentElement, rootMargin: '120px' },
    )
    observer.observe(sentinel)
  }

  function rowsView(items: InboxItem[], pager: Pager, sentinel: boolean, renderRow: (item: InboxItem) => HTMLElement) {
    return h(
      'div',
      { class: SCROLL },
      h('ul', { 'aria-busy': pager.loadingMore, class: 'flex flex-col gap-0.5 p-1' }, ...items.map(renderRow)),
      pager.next !== null && sentinel ? h('div', { 'data-ln-sentinel': '', class: 'h-px' }) : null,
      pager.next !== null
        ? h(
            'div',
            { class: 'flex justify-center p-2' },
            h(
              'button',
              {
                type: 'button',
                disabled: pager.loadingMore,
                class: cn(C.GHOST_BUTTON_SMALL, 'pointer-coarse:min-h-11', pager.loadMoreFailed && 'text-destructive'),
                'data-ln-key': 'load-more',
                onClick: () => pager.onMore(),
              },
              pager.loadingMore ? icon(LoaderCircle, 'size-4 animate-spin') : null,
              pager.loadMoreFailed ? "Couldn't load more. Try again" : 'Load more',
            ),
          )
        : null,
    )
  }

  // The store runs for the life of the bell; its state drives every re-render. A burst of changes (a reconnect replays
  // several live arrivals at once) is drawn once, on the microtask after the burst.
  let renderQueued = false
  const scheduleRender = () => {
    if (renderQueued) return
    renderQueued = true
    queueMicrotask(() => {
      renderQueued = false
      render()
    })
  }
  let unsubscribe = () => {}
  if (store) {
    unsubscribe = store.subscribe(() => {
      state = store.getState()
      scheduleRender()
    })
    void store.start()
  }
  render()

  return {
    applyTheme,
    destroy() {
      destroyed = true
      unsubscribe()
      void store?.stop()
      observer?.disconnect()
      media?.removeEventListener('change', onMediaChange)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeydown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
      panel.remove()
      root.remove()
    },
  }
}
