import { Component } from '@angular/core'

// Mirrors a notification row (58px with padding, plus the hidden action slot) so the list keeps its height.
@Component({
  selector: 'ln-notification-skeletons',
  template: `
    <div role="status" class="flex flex-col gap-0.5 p-1">
      <span class="sr-only">Loading notifications</span>
      @for (width of widths; track width) {
        <div class="flex items-center gap-1">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5">
            <div [class]="skeleton + ' my-[3px] h-3.5 ' + width"></div>
            <div [class]="skeleton + ' my-0.5 h-3 w-16'"></div>
          </div>
          <div class="me-1 size-8 shrink-0"></div>
        </div>
      }
    </div>
  `,
})
export class NotificationSkeletonsComponent {
  protected readonly widths = ['w-3/5', 'w-4/5', 'w-2/3']
  protected readonly skeleton = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'
}
