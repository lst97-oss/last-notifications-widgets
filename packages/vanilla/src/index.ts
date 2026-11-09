export type { InboxError, ThemeVars, WidgetTheme } from '@last-notifications-widgets/client'
// A getToken throws this to say whether a retry can help: `retryable: false` stops the bell retrying.
export { TokenError } from '@last-notifications-widgets/client'
export {
  mountNotificationBell,
  mountNotificationBellUnavailable,
  type NotificationBellHandle,
  type NotificationBellOptions,
  type NotificationBellUnavailableOptions,
  type Theme,
} from './mount'
