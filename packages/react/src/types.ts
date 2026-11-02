import type { InboxError, WidgetTheme } from '@last-notifications-widgets/client'

export type Theme = 'light' | 'dark' | 'system'

// How the bell gets its token. Either the widget calls the host's token endpoint itself (`tokenUrl`), or the host
// writes its own call (`getToken`). Passing both is a mistake, and `getToken` wins if a caller does it anyway.
type TokenSource =
  | {
      // The host's token endpoint: GET it, expect {data:{token}}. The widget owns the retries, timeouts and copy.
      tokenUrl: string
      getToken?: undefined
    }
  | {
      // Returns a recipient token (lrt_…) minted by the host's own backend; null for signed-out visitors.
      // A throw is a failure: the bell retries it unless the error is a TokenError with retryable false.
      getToken: () => Promise<string | null>
      tokenUrl?: undefined
    }

export type NotificationBellProps = TokenSource & {
  baseUrl: string
  appKey: string
  // The host's stable user id. Renders nothing when null; a change drops the list for the new session.
  session: string | null | undefined
  // Hears every failure, for the host's logs. The bell shows its own error state either way.
  onError?: (error: InboxError) => void
  theme?: Theme
  themeVars?: WidgetTheme
  className?: string
}
