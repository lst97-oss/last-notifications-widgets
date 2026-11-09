import { Component, computed, effect, input, output, signal, untracked } from '@angular/core'
import {
  type BellNote,
  bellAnnouncement,
  bellLabel,
  createInboxStore,
  createTokenProvider,
  type InboxError,
  type InboxItem,
  type InboxState,
  type InboxStore,
  type WidgetTheme,
} from '@last-notifications-widgets/client'
import {
  LucideArchive,
  LucideArchiveX,
  LucideArrowLeft,
  LucideBellRing,
  LucideCheckCheck,
  LucideEllipsis,
  LucideLoaderCircle,
} from '@lucide/angular'

import { BellPopoverComponent } from './bell-popover.component'
import { BellRootComponent } from './bell-root.component'
import * as C from './classes'
import { cn } from './cn'
import { FocusOnMountDirective, LoadOnViewDirective } from './directives'
import { NotificationErrorComponent } from './notification-error.component'
import { NotificationItemComponent } from './notification-item.component'
import { NotificationSkeletonsComponent } from './notification-skeletons.component'
import type { Theme } from './types'

// The live bell. The store is created per session, app and token URL: a change stops the old store and starts a new
// one, so the previous user's list is dropped. Renders nothing without a session, like the React component.
@Component({
  selector: 'ln-notification-bell',
  imports: [
    BellRootComponent,
    BellPopoverComponent,
    NotificationErrorComponent,
    NotificationItemComponent,
    NotificationSkeletonsComponent,
    LoadOnViewDirective,
    FocusOnMountDirective,
    LucideArchive,
    LucideArchiveX,
    LucideArrowLeft,
    LucideBellRing,
    LucideCheckCheck,
    LucideEllipsis,
    LucideLoaderCircle,
  ],
  template: `
    @let current = state();
    @if (current && current.status !== 'anonymous') {
      <ln-bell-root [theme]="theme()" [themeVars]="themeVars()" [className]="className()">
        <ln-bell-popover
          [label]="label()"
          [unread]="current.unread"
          [loading]="current.status === 'loading'"
          [failed]="current.status === 'error'"
          (openChange)="menuOpen.set(false)"
        >
          @if (current.view === 'archive') {
            <header [class]="archiveHeaderClass">
              <button
                type="button"
                aria-label="Back to notifications"
                [class]="touchIconButton"
                (click)="closeArchive()"
              >
                <svg lucideArrowLeft class="size-4" aria-hidden="true"></svg>
              </button>
              <div class="min-w-0">
                <h2 lnFocusOnMount tabindex="-1" class="text-base font-semibold outline-none">Archived</h2>
                <p class="text-xs text-muted-foreground">Archived notifications are deleted after 30 days.</p>
              </div>
            </header>
            @if (current.archive.status === 'loading' || current.archive.status === 'idle') {
              <ln-notification-skeletons />
            } @else if (current.archive.status === 'error') {
              <ln-notification-error [message]="current.archive.error ?? ''" (retry)="retryArchive()" />
            } @else if (current.archive.items.length === 0) {
              <div [class]="emptyClass">
                <div class="flex max-w-sm flex-col items-center gap-2">
                  <div [class]="emptyIconClass"><svg lucideArchiveX class="size-4" aria-hidden="true"></svg></div>
                  <div class="font-heading text-sm font-medium tracking-tight">Nothing archived yet</div>
                  <div class="text-sm/relaxed text-muted-foreground">Archived notifications stay here for 30 days.</div>
                </div>
              </div>
            } @else {
              <div [class]="scrollClass">
                <ul [attr.aria-busy]="current.archive.loadingMore" class="flex flex-col gap-0.5 p-1">
                  @for (item of current.archive.items; track item.id) {
                    <ln-notification-item [item]="item" action="restore" [onAction]="restoreItem(item)" />
                  }
                </ul>
                @if (current.archive.next !== null) {
                  <div class="flex justify-center p-2">
                    <button
                      type="button"
                      [disabled]="current.archive.loadingMore"
                      [class]="loadMoreClass(current.archive.loadMoreFailed)"
                      (click)="loadMoreArchive()"
                    >
                      {{ current.archive.loadMoreFailed ? "Couldn't load more. Try again" : 'Load more' }}
                    </button>
                  </div>
                }
              </div>
            }
          } @else {
            <header [class]="headerClass">
              <h2 data-slot="popover-title" class="flex items-center gap-2 text-base font-semibold">
                Notifications
                @if (current.status === 'loading') {
                  <span aria-hidden="true" data-ln-placeholder [class]="headerPlaceholderClass"></span>
                } @else if (current.total > 0) {
                  <span [class]="headerBadgeClass">{{ current.total > 99 ? '99+' : current.total }}</span>
                }
              </h2>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mark all as read"
                  title="Mark all as read"
                  [disabled]="current.unread === 0"
                  [class]="touchIconButton"
                  (click)="markAll()"
                >
                  <svg lucideCheckCheck class="size-4" aria-hidden="true"></svg>
                </button>
                <button
                  type="button"
                  aria-label="Open archive"
                  title="Archive"
                  [class]="touchIconButton"
                  (click)="openArchive()"
                >
                  <svg lucideArchive class="size-4" aria-hidden="true"></svg>
                </button>
                <div class="relative">
                  <button
                    type="button"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    [attr.aria-expanded]="menuOpen()"
                    [class]="touchIconButton"
                    (click)="menuOpen.set(!menuOpen())"
                  >
                    <svg lucideEllipsis class="size-4" aria-hidden="true"></svg>
                  </button>
                  @if (menuOpen()) {
                    <div
                      role="menu"
                      [class]="menuClass"
                      (keydown.escape)="menuOpen.set(false); $event.stopPropagation()"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        [disabled]="!hasRead(current)"
                        [class]="menuItemClass"
                        (click)="archiveRead()"
                      >
                        Archive all read
                      </button>
                    </div>
                  }
                </div>
              </div>
            </header>
            @if (current.status === 'loading') {
              <ln-notification-skeletons />
            } @else if (current.status === 'error') {
              <ln-notification-error
                [message]="current.error ?? ''"
                [retryable]="current.retryable"
                (retry)="retry()"
              />
            } @else if (current.items.length === 0) {
              <div [class]="emptyClass">
                <div class="flex max-w-sm flex-col items-center gap-2">
                  <div [class]="emptyIconClass"><svg lucideBellRing class="size-4" aria-hidden="true"></svg></div>
                  <div class="font-heading text-sm font-medium tracking-tight">You're all caught up</div>
                  <div class="text-sm/relaxed text-muted-foreground">New notifications will appear here.</div>
                </div>
              </div>
            } @else {
              <div [class]="scrollClass">
                <ul [attr.aria-busy]="current.loadingMore" class="flex flex-col gap-0.5 p-1">
                  @for (item of current.items; track item.id) {
                    <ln-notification-item
                      [item]="item"
                      action="archive"
                      [onOpen]="markRead(item.id)"
                      [onAction]="archiveItem(item)"
                    />
                  }
                </ul>
                @if (current.next !== null) {
                  <!-- Keyed by the list length, so each page remounts the sentinel and a sentinel still on screen reports again. -->
                  @for (count of [current.items.length]; track count) {
                    <div lnLoadOnView class="h-px" (loadOnView)="loadMore()"></div>
                  }
                  <div class="flex justify-center p-2">
                    <button
                      type="button"
                      [disabled]="current.loadingMore"
                      [class]="loadMoreClass(current.loadMoreFailed)"
                      (click)="loadMore()"
                    >
                      @if (current.loadingMore) {
                        <svg lucideLoaderCircle class="size-4 animate-spin" aria-hidden="true"></svg>
                      }
                      {{ current.loadMoreFailed ? "Couldn't load more. Try again" : 'Load more' }}
                    </button>
                  </div>
                }
              </div>
            }
          }
        </ln-bell-popover>
        <div role="status" aria-live="polite" class="sr-only">{{ announcement() }}</div>
      </ln-bell-root>
    }
  `,
})
export class NotificationBellComponent {
  readonly baseUrl = input.required<string>()
  readonly appKey = input.required<string>()
  // The host's stable user id. Renders nothing when null or undefined.
  readonly session = input<string | null | undefined>(null)
  // The host's token endpoint (the widget calls it), or `getToken` for the host's own call. getToken wins if both.
  readonly tokenUrl = input<string | undefined>(undefined)
  readonly getToken = input<(() => Promise<string | null>) | undefined>(undefined)
  // Hears every failure, for the host's logs. The bell shows its own error state either way.
  readonly error = output<InboxError>()
  readonly theme = input<Theme>('system')
  readonly themeVars = input<WidgetTheme | undefined>(undefined)
  readonly className = input<string | undefined>(undefined)

  protected readonly state = signal<InboxState | null>(null)
  protected readonly menuOpen = signal(false)
  private readonly note = signal<BellNote>({ text: '', after: null })
  private store: InboxStore | null = null

  protected readonly label = computed(() => {
    const current = this.state()
    return current ? bellLabel(current) : ''
  })
  protected readonly announcement = computed(() => {
    const current = this.state()
    return current ? bellAnnouncement(current, this.note()) : ''
  })

  protected readonly touchIconButton = C.TOUCH_ICON_BUTTON
  protected readonly headerClass = 'flex items-center justify-between gap-2 border-b px-4 py-3'
  protected readonly archiveHeaderClass = 'flex items-center gap-2 border-b px-2 py-3'
  protected readonly headerPlaceholderClass = 'h-5 w-6 rounded-full bg-muted-foreground/20 motion-safe:animate-pulse'
  protected readonly headerBadgeClass = C.HEADER_BADGE
  protected readonly scrollClass = 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'
  protected readonly emptyClass =
    'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance'
  protected readonly emptyIconClass =
    "mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  protected readonly menuClass = cn(C.MENU_CONTENT, 'absolute end-0 top-full z-50 mt-1')
  protected readonly menuItemClass = C.MENU_ITEM

  constructor() {
    effect((onCleanup) => {
      const session = this.session()
      if (session == null) {
        this.store = null
        this.state.set(null)
        return
      }
      const baseUrl = this.baseUrl()
      const appKey = this.appKey()
      const tokenProvider = createTokenProvider({ url: this.tokenUrl() ?? '' })
      const store = createInboxStore({
        baseUrl,
        appKey,
        // Read the latest inputs at call time, so a host's new getToken or onError takes effect without a remount.
        getToken: () => {
          const provider = untracked(() => this.getToken())
          return provider ? provider() : tokenProvider()
        },
        onError: (error) => untracked(() => this.error.emit(error)),
      })
      this.store = store
      const unsubscribe = store.subscribe(() => this.state.set(store.getState()))
      this.state.set(store.getState())
      untracked(() => void store.start())
      onCleanup(() => {
        unsubscribe()
        store.stop()
      })
    })
  }

  protected hasRead(current: InboxState) {
    // Read rows are every inbox row the unread count does not cover, including rows past the loaded page.
    return current.total > current.unread
  }

  protected loadMoreClass(failed: boolean) {
    return cn(C.GHOST_BUTTON_SMALL, 'pointer-coarse:min-h-11', failed && 'text-destructive')
  }

  // A message from an action. Tied to the newest live arrival at the time it was set (see bellAnnouncement).
  private announce(text: string) {
    this.note.set({ text, after: this.state()?.announced ?? null })
  }

  // An action can finish after the session changed. Its message belongs to the store it ran on, so it is dropped then.
  private announceFrom(store: InboxStore | null, text: string) {
    if (store === this.store) this.announce(text)
  }

  protected markAll() {
    const store = this.store
    void store?.markAllRead().then((applied) => applied || this.announceFrom(store, "Couldn't mark all as read"))
  }

  protected archiveRead() {
    this.menuOpen.set(false)
    const store = this.store
    void store
      ?.archiveRead()
      .then((applied) =>
        this.announceFrom(store, applied ? 'Archived read notifications' : "Couldn't archive read notifications"),
      )
  }

  protected openArchive() {
    void this.store?.openArchive()
  }

  protected closeArchive() {
    this.store?.closeArchive()
  }

  protected retryArchive() {
    this.closeArchive()
    this.openArchive()
  }

  protected retry() {
    void this.store?.retry()
  }

  protected loadMore() {
    void this.store?.loadMore()
  }

  protected loadMoreArchive() {
    void this.store?.loadMoreArchive()
  }

  protected markRead(id: string): () => Promise<unknown> {
    return () => (this.store ? this.store.markRead([id]) : Promise.resolve(false))
  }

  protected archiveItem(item: InboxItem): () => void {
    return () => {
      const store = this.store
      this.announce(`Archived ${item.title}`)
      void store
        ?.archive([item.id])
        .then((applied) => applied || this.announceFrom(store, `Couldn't archive ${item.title}`))
    }
  }

  protected restoreItem(item: InboxItem): () => void {
    return () => {
      const store = this.store
      this.announce(`Restored ${item.title}`)
      void store
        ?.restore([item.id])
        .then((applied) => applied || this.announceFrom(store, `Couldn't restore ${item.title}`))
    }
  }
}
