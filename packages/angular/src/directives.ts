import { afterNextRender, DestroyRef, Directive, ElementRef, inject, output } from '@angular/core'

// Emits when the element scrolls into view of its scroll container. The list uses it for the infinite-scroll sentinel.
@Directive({ selector: '[lnLoadOnView]' })
export class LoadOnViewDirective {
  readonly loadOnView = output<void>()

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
    const destroyRef = inject(DestroyRef)
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) this.loadOnView.emit()
        },
        // The sentinel is a direct child of the scroll container, so its parent is the scroll root.
        { root: element.parentElement, rootMargin: '120px' },
      )
      observer.observe(element)
      destroyRef.onDestroy(() => observer.disconnect())
    })
  }
}

// Moves focus to the element once it is on screen (the archive heading, when the archive opens).
@Directive({ selector: '[lnFocusOnMount]' })
export class FocusOnMountDirective {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement
    afterNextRender(() => element.focus())
  }
}
