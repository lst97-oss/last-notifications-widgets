import type { InboxError, WidgetTheme } from '@last-notifications-widgets/client'

export type Theme = 'light' | 'dark' | 'system'

export type NotificationBellProps = {
  baseUrl: string
  appKey: string
  // The host's stable user id. Renders nothing when null; a change drops the list for the new session.
  session: string | null | undefined
  // Returns a recipient token (lrt_…) minted by the host's own backend; null for signed-out visitors.
  getToken: () => Promise<string | null>
  // Hears every failure, for the host's logs. The bell shows its own error state either way.
  onError?: (error: InboxError) => void
  theme?: Theme
  themeVars?: WidgetTheme
  className?: string
}
