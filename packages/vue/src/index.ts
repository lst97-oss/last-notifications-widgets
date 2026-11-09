export type { InboxError, ThemeVars, WidgetTheme } from '@last-notifications-widgets/client'
// A getToken throws this to say whether a retry can help: `retryable: false` stops the bell retrying.
export { TokenError } from '@last-notifications-widgets/client'
export { default as NotificationBell } from './components/NotificationBell.vue'
export { default as NotificationBellUnavailable } from './components/NotificationBellUnavailable.vue'
export type { NotificationBellProps, Theme } from './types'
