import {
  createInboxStore,
  createTokenProvider,
  type InboxState,
  type InboxStore,
} from '@last-notifications-widgets/client'
import { onMounted, onUnmounted, type ShallowRef, shallowRef } from 'vue'

import type { NotificationBellProps } from '../types'

// The store is created once per mount. NotificationBell keys its inner component by app, user and session, so a
// change mounts a fresh store and the unmount below stops the old one.
export function useInbox(
  props: Pick<NotificationBellProps, 'baseUrl' | 'appKey' | 'tokenUrl' | 'getToken' | 'onError'>,
): { store: InboxStore; state: ShallowRef<InboxState> } {
  const tokenProvider = createTokenProvider({ url: props.tokenUrl ?? '' })
  const store = createInboxStore({
    baseUrl: props.baseUrl,
    appKey: props.appKey,
    // Read the latest props at call time, so a host's new getToken or onError closure takes effect without a remount.
    getToken: () => (props.getToken ? props.getToken() : tokenProvider()),
    onError: (error) => props.onError?.(error),
  })
  const state = shallowRef(store.getState())
  const unsubscribe = store.subscribe(() => {
    state.value = store.getState()
  })
  onMounted(() => void store.start())
  onUnmounted(() => {
    unsubscribe()
    store.stop()
  })
  return { store, state }
}
