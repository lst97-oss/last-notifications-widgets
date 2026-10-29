import { formatRelativeTime, type InboxItem, safeUrl } from '@last-notifications-widgets/client'
import { Archive, ArchiveRestore, ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// Longest a click waits for the mark-read before it navigates anyway.
const OPEN_WAIT_MS = 1_000

// One row. Archive and restore are always reachable: on touch they are always visible, on pointer devices
// they appear on hover or focus. A row with a safe data.url is a link; it marks itself read before it follows.
export function NotificationItem({
  item,
  action,
  onOpen,
  onAction,
}: {
  item: InboxItem
  action: 'archive' | 'restore'
  onOpen?: () => Promise<void>
  onAction: () => void
}) {
  const href = safeUrl(item.data.url)
  const unread = item.readAt === null

  const content = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex items-center gap-2">
        {unread && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-(--ln-unread-indicator)" />}
        <span className={cn('truncate text-sm', unread && 'font-medium')}>{item.title}</span>
        {href && <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
      </span>
      {item.body && <span className="line-clamp-2 text-sm text-muted-foreground">{item.body}</span>}
      <time dateTime={item.createdAt} className="text-xs text-muted-foreground">
        {formatRelativeTime(item.createdAt)}
      </time>
    </span>
  )

  const rowBody =
    'flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2.5 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-3'

  const handleOpen = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onOpen) return
    // Modified clicks (new tab, new window) keep the browser's behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, OPEN_WAIT_MS))
    void Promise.race([onOpen(), timeout]).finally(() => window.location.assign(href ?? '/'))
  }

  return (
    <li
      className={cn(
        'ln-item group relative flex items-center gap-1 rounded-lg motion-safe:transition-colors hover:bg-muted focus-within:bg-muted',
        unread && 'ln-unread',
      )}
    >
      {href ? (
        <a className={rowBody} href={href} onClick={handleOpen}>
          {content}
        </a>
      ) : onOpen ? (
        <button type="button" className={rowBody} onClick={() => void onOpen()}>
          {content}
        </button>
      ) : (
        <div className={rowBody}>{content}</div>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${action === 'archive' ? 'Archive' : 'Restore'} ${item.title}`}
        onClick={onAction}
        className="me-1 shrink-0 pointer-coarse:size-11 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:group-focus-within:opacity-100"
      >
        {action === 'archive' ? (
          <Archive aria-hidden="true" className="size-4" />
        ) : (
          <ArchiveRestore aria-hidden="true" className="size-4" />
        )}
      </Button>
    </li>
  )
}
