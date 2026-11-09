import { type BellNote, bellAnnouncement, bellLabel, createTokenProvider } from '@last-notifications-widgets/client'
import { lazy, Suspense, useState } from 'react'

import { Popover, PopoverContent } from '@/ui/popover'
import { TooltipProvider } from '@/ui/tooltip'
import { NotificationArchiveHeader } from './NotificationArchiveHeader'
import { BellTrigger, POPUP_CLASS } from './NotificationBellParts'
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
  return <InboxBell key={JSON.stringify([props.baseUrl, props.appKey, props.session, props.tokenUrl])} {...props} />
}

function InboxBell({ baseUrl, appKey, onError, theme, themeVars, className, ...source }: NotificationBellProps) {
  // A host's getToken wins; otherwise the widget calls the host's token endpoint itself. The store reads the latest
  // function through a ref, so building the provider on each render is harmless.
  const getToken = source.getToken ?? createTokenProvider({ url: source.tokenUrl ?? '' })
  const { store, state } = useInbox({ baseUrl, appKey, getToken, onError })
  const [note, setNote] = useState<BellNote>({ text: '', after: null })
  const announce = (text: string) => setNote({ text, after: state.announced })
  if (state.status === 'anonymous') return null

  const failed = state.status === 'error'

  return (
    <NotificationBellTheme theme={theme} themeVars={themeVars} className={className}>
      <TooltipProvider delay={300}>
        <Popover>
          <BellTrigger
            label={bellLabel(state)}
            unread={state.unread}
            loading={state.status === 'loading'}
            failed={failed}
          />
          <PopoverContent align="end" className={POPUP_CLASS}>
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
        {bellAnnouncement(state, note)}
      </div>
    </NotificationBellTheme>
  )
}
