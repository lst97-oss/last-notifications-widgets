import type { InboxStore } from '@last-notifications-widgets/client'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/ui/button'

// A module-level ref callback is stable, so React calls it once, on mount: focus moves to the heading when the
// archive opens, and it does not move again on later re-renders.
function focusOnMount(heading: HTMLHeadingElement | null) {
  heading?.focus()
}

// Lives outside the lazy NotificationArchive chunk, so Back stays on screen while that chunk loads.
export function NotificationArchiveHeader({ store }: { store: InboxStore }) {
  return (
    <header className="flex items-center gap-2 border-b px-2 py-3">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back to notifications"
        onClick={() => store.closeArchive()}
        className="pointer-coarse:size-11"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
      </Button>
      <div className="min-w-0">
        <h2 ref={focusOnMount} tabIndex={-1} className="text-base font-semibold outline-none">
          Archived
        </h2>
        <p className="text-xs text-muted-foreground">Archived notifications are deleted after 30 days.</p>
      </div>
    </header>
  )
}
