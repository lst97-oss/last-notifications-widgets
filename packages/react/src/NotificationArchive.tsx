import type { InboxState, InboxStore } from '@last-notifications-widgets/client'
import { ArchiveX } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/ui/empty'
import { NotificationError } from './NotificationError'
import { NotificationItem } from './NotificationItem'
import { NotificationSkeletons } from './NotificationSkeletons'

// The archive list. Loaded lazily from NotificationBell; its header is in NotificationArchiveHeader.
export default function NotificationArchive({
  state,
  store,
  onAnnounce,
}: {
  state: InboxState
  store: InboxStore
  onAnnounce: (note: string) => void
}) {
  const archive = state.archive

  if (archive.status === 'loading' || archive.status === 'idle') return <NotificationSkeletons />
  if (archive.status === 'error') {
    return (
      <NotificationError
        message={archive.error ?? ''}
        onRetry={() => {
          store.closeArchive()
          void store.openArchive()
        }}
      />
    )
  }
  if (archive.items.length === 0) {
    return (
      <Empty className="p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArchiveX aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nothing archived yet</EmptyTitle>
          <EmptyDescription>Archived notifications stay here for 30 days.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <ul aria-busy={archive.loadingMore} className="flex flex-col gap-0.5 p-1">
        {archive.items.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            action="restore"
            onAction={() => {
              onAnnounce(`Restored ${item.title}`)
              void store.restore([item.id]).then((applied) => applied || onAnnounce(`Couldn't restore ${item.title}`))
            }}
          />
        ))}
      </ul>
      {archive.next !== null && (
        <div className="flex justify-center p-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={archive.loadingMore}
            onClick={() => void store.loadMoreArchive()}
            className={cn('pointer-coarse:min-h-11', archive.loadMoreFailed && 'text-destructive')}
          >
            {archive.loadMoreFailed ? "Couldn't load more. Try again" : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}
