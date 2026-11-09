import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, input } from '@angular/core'
import { formatRelativeTime, type InboxItem, safeUrl } from '@last-notifications-widgets/client'
import { LucideArchive, LucideArchiveRestore, LucideExternalLink } from '@lucide/angular'

import { ICON_BUTTON } from './classes'
import { cn } from './cn'

// Longest a click waits for the mark-read before it navigates anyway.
const OPEN_WAIT_MS = 1_000
const ROW_BODY =
  'flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2.5 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-3'
const ACTION_BUTTON =
  'me-1 shrink-0 pointer-coarse:size-11 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:group-focus-within:opacity-100'

// One row. A safe data.url makes it a link that marks itself read before it follows. A row with onOpen (the inbox)
// marks itself read when clicked; an archive row has no onOpen, so its link navigates straight away.
@Component({
  selector: 'ln-notification-item',
  imports: [NgTemplateOutlet, LucideArchive, LucideArchiveRestore, LucideExternalLink],
  template: `
    <ng-template #content>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="flex items-center gap-2">
          @if (unread()) {
            <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-(--ln-unread-indicator)"></span>
          }
          <span [class]="titleClass()">{{ item().title }}</span>
          @if (href()) {
            <svg lucideExternalLink class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true"></svg>
          }
        </span>
        @if (item().body) {
          <span class="line-clamp-2 text-sm text-muted-foreground">{{ item().body }}</span>
        }
        <time [attr.datetime]="item().createdAt" class="text-xs text-muted-foreground">{{ relative() }}</time>
      </span>
    </ng-template>
    <li [class]="itemClass()">
      @if (href(); as link) {
        <a [class]="rowBody" [href]="link" (click)="openLink($event, link)">
          <ng-container [ngTemplateOutlet]="content" />
        </a>
      } @else if (onOpen()) {
        <button type="button" [class]="rowBody" (click)="openRow()">
          <ng-container [ngTemplateOutlet]="content" />
        </button>
      } @else {
        <div [class]="rowBody">
          <ng-container [ngTemplateOutlet]="content" />
        </div>
      }
      <button type="button" [attr.aria-label]="actionLabel()" [class]="actionClass" (click)="act()">
        @if (action() === 'archive') {
          <svg lucideArchive class="size-4" aria-hidden="true"></svg>
        } @else {
          <svg lucideArchiveRestore class="size-4" aria-hidden="true"></svg>
        }
      </button>
    </li>
  `,
})
export class NotificationItemComponent {
  readonly item = input.required<InboxItem>()
  readonly action = input<'archive' | 'restore'>('archive')
  readonly onOpen = input<(() => Promise<unknown>) | undefined>(undefined)
  readonly onAction = input.required<() => void>()

  protected readonly rowBody = ROW_BODY
  protected readonly actionClass = cn(ICON_BUTTON, ACTION_BUTTON)
  protected readonly href = computed(() => safeUrl(this.item().data.url))
  protected readonly unread = computed(() => this.item().readAt === null)
  protected readonly relative = computed(() => formatRelativeTime(this.item().createdAt))
  protected readonly itemClass = computed(() =>
    cn(
      'ln-item group relative flex items-center gap-1 rounded-lg motion-safe:transition-colors hover:bg-muted focus-within:bg-muted',
      this.unread() && 'ln-unread',
    ),
  )
  protected readonly titleClass = computed(() => cn('truncate text-sm', this.unread() && 'font-medium'))
  protected readonly actionLabel = computed(
    () => `${this.action() === 'archive' ? 'Archive' : 'Restore'} ${this.item().title}`,
  )

  protected openRow() {
    const open = this.onOpen()
    if (open) void open()
  }

  protected openLink(event: MouseEvent, href: string) {
    const open = this.onOpen()
    if (!open) return
    // Modified clicks (new tab, new window) keep the browser's behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, OPEN_WAIT_MS))
    void Promise.race([open(), timeout]).finally(() => window.location.assign(href))
  }

  protected act() {
    this.onAction()()
  }
}
