import type { InboxState, InboxStore } from '@last-notifications-widgets/client'
import { BellRing, Loader2Icon } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '@/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/empty'
import { NotificationError } from './NotificationError'
import { NotificationItem } from './NotificationItem'
import { NotificationSkeletons } from './NotificationSkeletons'

// The inbox list. Older pages load when the sentinel scrolls into view; "Load more" is the keyboard path.
export function NotificationList({
  state,
  store,
  onAnnounce,
}: {
  state: InboxState
  store: InboxStore
  onAnnounce: (note: string) => void
}) {
  // Watches the sentinel above "Load more". A ref callback runs on mount and returns its own cleanup, so there
  // is no effect to keep in sync. The sentinel is keyed by the list length (below), so each page remounts it
  // and a sentinel still on screen reports again.
  const watchSentinel = useCallback(
    (sentinel: HTMLDivElement) => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void store.loadMore()
        },
        // The sentinel is a direct child of the scroll container, so its parent is the scroll root.
        { root: sentinel.parentElement, rootMargin: '120px' },
      )
      observer.observe(sentinel)
      return () => observer.disconnect()
    },
    [store],
  )

  if (state.status === 'loading') return <NotificationSkeletons />
  if (state.status === 'error') {
    return <NotificationError message={state.error ?? ''} onRetry={() => void store.retry()} />
  }
  if (state.items.length === 0) {
    return (
      <Empty className="p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellRing aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>You&apos;re all caught up</EmptyTitle>
          <EmptyDescription>New notifications will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <ul aria-busy={state.loadingMore} className="flex flex-col gap-0.5 p-1">
        {state.items.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            action="archive"
            onOpen={() => store.markRead([item.id])}
            onAction={() => {
              onAnnounce(`Archived ${item.title}`)
              void store.archive([item.id])
            }}
          />
        ))}
      </ul>
      {state.next !== null && (
        <>
          <div key={state.items.length} ref={watchSentinel} className="h-px" />
          <div className="flex justify-center p-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={state.loadingMore}
              onClick={() => void store.loadMore()}
              className="pointer-coarse:min-h-11"
            >
              {state.loadingMore && <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />}
              Load more
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
