import type { InboxItem } from '@last-notifications-widgets/client'
import { Bell } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'

import { Badge } from '@/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { TooltipProvider } from '@/ui/tooltip'
import { NotificationArchiveHeader } from './NotificationArchiveHeader'
import { NotificationBellTheme } from './NotificationBellTheme'
import { NotificationHeader } from './NotificationHeader'
import { NotificationList } from './NotificationList'
import { NotificationSkeletons } from './NotificationSkeletons'
import type { NotificationBellProps } from './types'
import { useInbox } from './useInbox'

// The archive view ships as its own chunk and loads the first time someone opens it.
const NotificationArchive = lazy(() => import('./NotificationArchive'))

// Renders nothing without a session. The inner bell is keyed by app, user and session, so each one gets a
// fresh store and a change drops the previous user's list.
export function NotificationBell(props: NotificationBellProps) {
  if (props.session == null) return null
  return <InboxBell key={JSON.stringify([props.baseUrl, props.appKey, props.session])} {...props} />
}

function InboxBell({ baseUrl, appKey, getToken, theme, themeVars, className }: NotificationBellProps) {
  const { store, state } = useInbox({ baseUrl, appKey, getToken })
  // A message from an action ("Archived 3 notifications"). It is tied to the newest live arrival at the time it
  // was set, so a later arrival is announced instead of the stale message.
  const [note, setNote] = useState<{ text: string; after: InboxItem | null }>({ text: '', after: null })
  const announce = (text: string) => setNote({ text, after: state.announced })
  if (state.status === 'anonymous') return null

  const label = state.unread > 0 ? `Notifications, ${state.unread} unread` : 'Notifications'
  const arrival = state.announced ? `New notification: ${state.announced.title}` : ''
  const announcement = note.text && note.after === state.announced ? note.text : arrival

  return (
    <NotificationBellTheme theme={theme} themeVars={themeVars} className={className}>
      <TooltipProvider delay={300}>
        <Popover>
          <PopoverTrigger
            aria-label={label}
            className="ln-trigger relative inline-flex size-(--ln-trigger-size) items-center justify-center rounded-lg text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11 motion-safe:transition-colors"
          >
            <Bell aria-hidden="true" className="size-4" />
            {state.status === 'loading' ? (
              // The count is unknown until the first page lands; a placeholder keeps it from reading as zero.
              <span
                aria-hidden="true"
                data-ln-placeholder
                className="absolute -end-1 -top-1 size-5 rounded-full bg-muted-foreground/20 motion-safe:animate-pulse"
              />
            ) : (
              state.unread > 0 && (
                <Badge
                  aria-hidden="true"
                  className="ln-badge absolute -end-1 -top-1 min-w-4 bg-(--ln-badge-background) px-1 text-(--ln-badge-foreground)"
                >
                  {state.unread > 99 ? '99+' : state.unread}
                </Badge>
              )
            )}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="ln-popup flex max-h-[min(var(--ln-popover-max-height),calc(100dvh-6rem))] w-[min(var(--ln-popover-width),calc(100vw-1rem))] flex-col gap-0 overflow-hidden p-0"
          >
            {state.view === 'archive' ? (
              <>
                <NotificationArchiveHeader store={store} />
                <Suspense fallback={<NotificationSkeletons />}>
                  <NotificationArchive state={state} store={store} onAnnounce={announce} />
                </Suspense>
              </>
            ) : (
              <>
                <NotificationHeader state={state} store={store} onAnnounce={announce} />
                <NotificationList state={state} store={store} onAnnounce={announce} />
              </>
            )}
          </PopoverContent>
        </Popover>
      </TooltipProvider>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </NotificationBellTheme>
  )
}
