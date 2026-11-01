import { LOAD_ERROR_MESSAGE, type WidgetTheme } from '@last-notifications-widgets/client'

import { Popover, PopoverContent } from '@/ui/popover'
import { BellTrigger, POPUP_CLASS } from './NotificationBellParts'
import { NotificationBellTheme } from './NotificationBellTheme'
import { NotificationError } from './NotificationError'
import type { Theme } from './types'

// The bell's error state, for a host that cannot mount the live bell (it has no baseUrl or appKey yet).
// It takes no token, key or URL, so the host's fallback looks exactly like the real bell in its failure state.
export function NotificationBellUnavailable({
  onRetry,
  theme,
  themeVars,
  className,
}: {
  onRetry: () => void
  theme?: Theme
  themeVars?: WidgetTheme
  className?: string
}) {
  return (
    <NotificationBellTheme theme={theme} themeVars={themeVars} className={className}>
      <Popover>
        <BellTrigger label="Notifications, couldn't load" unread={0} loading={false} failed />
        <PopoverContent align="end" className={POPUP_CLASS}>
          <NotificationError message={LOAD_ERROR_MESSAGE} onRetry={onRetry} />
        </PopoverContent>
      </Popover>
    </NotificationBellTheme>
  )
}
