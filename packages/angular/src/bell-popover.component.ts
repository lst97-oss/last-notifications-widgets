import {
  afterNextRender,
  Component,
  ElementRef,
  HostListener,
  Injector,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core'

import { BELL_BADGE, ERROR_ICON, PLACEHOLDER, POPOVER_CONTENT, TRIGGER } from './classes'
import { cn } from './cn'

// The bell button and its popup. The popup sits inside the .ln-bell root (so it keeps the theme), positioned
// against the trigger and kept inside the viewport. Escape and an outside click close it, as in the other ports.
@Component({
  selector: 'ln-bell-popover',
  template: `
    <button
      #trigger
      type="button"
      [class]="triggerClass"
      [attr.aria-label]="label()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <svg lucideBell class="size-4" aria-hidden="true"></svg>
      @if (failed()) {
        <span aria-hidden="true" data-ln-error-icon [class]="errorIconClass">
          <svg lucideTriangleAlert class="size-3" aria-hidden="true"></svg>
        </span>
      } @else if (loading()) {
        <!-- The count is unknown until the first page lands; a placeholder keeps it from reading as zero. -->
        <span aria-hidden="true" data-ln-placeholder [class]="placeholderClass"></span>
      } @else if (unread() > 0) {
        <span aria-hidden="true" [class]="badgeClass">{{ unread() > 99 ? '99+' : unread() }}</span>
      }
    </button>
    @if (open()) {
      <div
        #panel
        role="dialog"
        aria-label="Notifications"
        tabindex="-1"
        data-state="open"
        [class]="popupClass"
        [style.top.px]="top()"
        [style.left.px]="left()"
      >
        <ng-content />
      </div>
    }
  `,
})
export class BellPopoverComponent {
  readonly label = input.required<string>()
  readonly unread = input.required<number>()
  readonly loading = input.required<boolean>()
  readonly failed = input.required<boolean>()
  // Tells the host the popup opened or closed, so it can reset its own transient state (such as an open menu).
  readonly openChange = output<boolean>()

  protected readonly triggerClass = TRIGGER
  protected readonly badgeClass = BELL_BADGE
  protected readonly placeholderClass = PLACEHOLDER
  protected readonly errorIconClass = ERROR_ICON
  protected readonly popupClass = cn(POPOVER_CONTENT, 'fixed z-50')
  protected readonly open = signal(false)
  protected readonly top = signal(0)
  protected readonly left = signal(0)

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
  private readonly injector = inject(Injector)
  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger')
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel')

  protected toggle() {
    if (this.open()) this.close()
    else this.show()
  }

  private show() {
    this.open.set(true)
    this.openChange.emit(true)
    afterNextRender(
      () => {
        this.place()
        this.panelRef()?.nativeElement.focus()
      },
      { injector: this.injector },
    )
  }

  private close() {
    this.open.set(false)
    this.openChange.emit(false)
  }

  // Below the trigger, right-aligned to it, and kept inside the viewport (as Base UI's collision handling does).
  private place() {
    const panel = this.panelRef()?.nativeElement
    if (!panel) return
    const rect = this.triggerRef().nativeElement.getBoundingClientRect()
    const width = Math.min(panel.offsetWidth, window.innerWidth - 16)
    this.top.set(rect.bottom + 4)
    this.left.set(Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8))
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onPointerDown(event: Event) {
    if (this.open() && !this.host.contains(event.target as Node)) this.close()
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    if (!this.open()) return
    this.close()
    this.triggerRef().nativeElement.focus()
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected onViewportChange() {
    if (this.open()) this.place()
  }
}
