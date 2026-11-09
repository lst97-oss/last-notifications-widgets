import { Component, computed, input } from '@angular/core'
import { themeVarsToStyle, type WidgetTheme } from '@last-notifications-widgets/client'

import { themeIsDark } from './theme'
import type { Theme } from './types'

// The scoped root: owns the .ln-bell scope, dark mode and themeVars. Everything the bell draws sits inside it.
@Component({
  selector: 'ln-bell-root',
  template: `<div class="ln-bell" [class.dark]="dark()" [class]="className()" [style]="style()"><ng-content /></div>`,
})
export class BellRootComponent {
  readonly theme = input<Theme>('system')
  readonly themeVars = input<WidgetTheme | undefined>(undefined)
  readonly className = input<string | undefined>(undefined)

  protected readonly dark = themeIsDark(this.theme)
  protected readonly style = computed(() => themeVarsToStyle(this.themeVars(), this.dark()))
}
