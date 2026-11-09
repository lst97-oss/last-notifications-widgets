import { Component, input, output } from '@angular/core'
import { LucideTriangleAlert } from '@lucide/angular'

import { OUTLINE_BUTTON_SMALL } from './classes'
import { cn } from './cn'

// The same triangle the bell shows on failure. A permanent failure (retryable false) shows the message alone.
@Component({
  selector: 'ln-notification-error',
  imports: [LucideTriangleAlert],
  template: `
    <div role="alert" data-ln-error class="flex flex-col items-start gap-2 p-4 text-sm">
      <p class="flex items-center gap-2 text-destructive">
        <svg lucideTriangleAlert class="size-4 shrink-0" aria-hidden="true"></svg>
        {{ message() }}
      </p>
      @if (retryable()) {
        <button type="button" [class]="buttonClass" (click)="retry.emit()">Try again</button>
      }
    </div>
  `,
})
export class NotificationErrorComponent {
  readonly message = input.required<string>()
  readonly retryable = input(true)
  readonly retry = output<void>()

  protected readonly buttonClass = cn(OUTLINE_BUTTON_SMALL, 'pointer-coarse:min-h-11')
}
