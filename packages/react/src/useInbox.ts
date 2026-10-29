import { createInboxStore, type InboxState, type InboxStore } from '@last-notifications-widgets/client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

export type InboxOptions = {
  baseUrl: string
  appKey: string
  getToken: () => Promise<string | null>
}

// The store is created once per mount. NotificationBell keys its inner component by app, user and session,
// so a change mounts a fresh store and the effect below stops the old one.
export function useInbox(options: InboxOptions): { store: InboxStore; state: InboxState } {
  // The store can call getToken from a click (a retry after an expired token), not only from an effect,
  // so it reads the latest function through this ref. useEffectEvent does not fit: React forbids calling it from handlers.
  const getTokenRef = useRef(options.getToken)
  const [store] = useState(() =>
    createInboxStore({ baseUrl: options.baseUrl, appKey: options.appKey, getToken: () => getTokenRef.current() }),
  )

  useEffect(() => {
    getTokenRef.current = options.getToken
  })

  // The stream and the requests are an external system: connect on mount, disconnect on unmount.
  useEffect(() => {
    void store.start()
    return () => store.stop()
  }, [store])

  const state = useSyncExternalStore(store.subscribe, store.getState)
  return { store, state }
}
