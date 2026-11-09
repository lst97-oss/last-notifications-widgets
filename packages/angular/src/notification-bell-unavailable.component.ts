import { Component, input, output } from '@angular/core'
import { LOAD_ERROR_MESSAGE, type WidgetTheme } from '@last-notifications-widgets/client'

import { BellPopoverComponent } from './bell-popover.component'
import { BellRootComponent } from './bell-root.component'
import { NotificationErrorComponent } from './notification-error.component'
import type { Theme } from './types'

// The bell's error state, for a host that cannot mount the live bell yet. It takes no token, key or URL, so the host's
// fallback looks exactly like the real bell in its failure state.
@Component({
  selector: 'ln-notification-bell-unavailable',
  imports: [BellRootComponent, BellPopoverComponent, NotificationErrorComponent],
  template: `
    <ln-bell-root [theme]="theme()" [themeVars]="themeVars()" [className]="className()">
      <ln-bell-popover label="Notifications, couldn't load" [unread]="0" [loading]="false" [failed]="true">
        <ln-notification-error [message]="loadError" (retry)="retry.emit()" />
      </ln-bell-popover>
    </ln-bell-root>
  `,
})
export class NotificationBellUnavailableComponent {
  readonly theme = input<Theme>('system')
  readonly themeVars = input<WidgetTheme | undefined>(undefined)
  readonly className = input<string | undefined>(undefined)
  readonly retry = output<void>()

  protected readonly loadError = LOAD_ERROR_MESSAGE
}
