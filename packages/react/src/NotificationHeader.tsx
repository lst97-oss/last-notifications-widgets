import type { InboxState, InboxStore } from '@last-notifications-widgets/client'
import { Archive, CheckCheck, Ellipsis } from 'lucide-react'

import { Badge } from '@/ui/badge'
import { buttonVariants } from '@/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu'
import { PopoverTitle } from '@/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'

const iconButton = buttonVariants({ variant: 'ghost', size: 'icon' })

export function NotificationHeader({
  state,
  store,
  onAnnounce,
}: {
  state: InboxState
  store: InboxStore
  onAnnounce: (note: string) => void
}) {
  // Read rows are every inbox row the unread count does not cover, including rows past the loaded page.
  const hasRead = state.total > state.unread
  return (
    <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
      <PopoverTitle className="flex items-center gap-2 text-base font-semibold">
        Notifications
        {state.status === 'loading' ? (
          <span
            aria-hidden="true"
            data-ln-placeholder
            className="h-5 w-6 rounded-full bg-muted-foreground/20 motion-safe:animate-pulse"
          />
        ) : (
          state.total > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {state.total > 99 ? '99+' : state.total}
            </Badge>
          )
        )}
      </PopoverTitle>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            aria-label="Mark all as read"
            disabled={state.unread === 0}
            className={`${iconButton} pointer-coarse:size-11`}
            onClick={() =>
              void store.markAllRead().then((applied) => applied || onAnnounce("Couldn't mark all as read"))
            }
          >
            <CheckCheck aria-hidden="true" className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Mark all as read</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            aria-label="Open archive"
            className={`${iconButton} pointer-coarse:size-11`}
            onClick={() => void store.openArchive()}
          >
            <Archive aria-hidden="true" className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="More actions" className={`${iconButton} pointer-coarse:size-11`}>
            <Ellipsis aria-hidden="true" className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!hasRead}
              onClick={() =>
                void store
                  .archiveRead()
                  .then((applied) =>
                    onAnnounce(applied ? 'Archived read notifications' : "Couldn't archive read notifications"),
                  )
              }
            >
              Archive all read
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
