import type { InboxError, WidgetTheme } from '@last-notifications-widgets/client'

export type Theme = 'light' | 'dark' | 'system'

// The bell's props. Pass either `tokenUrl` (the widget calls the host's endpoint) or `getToken` (the host's own call).
// Vue cannot express that either/or at compile time as React's types do, so `getToken` wins if both are passed.
export type NotificationBellProps = {
  baseUrl: string
  appKey: string
  // The host's stable user id. Renders nothing when null or undefined; a change drops the list for the new session.
  session?: string | null
  tokenUrl?: string
  getToken?: () => Promise<string | null>
  onError?: (error: InboxError) => void
  theme?: Theme
  themeVars?: WidgetTheme
  className?: string
}
