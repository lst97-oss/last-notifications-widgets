import { computed, DestroyRef, inject, type Signal, signal } from '@angular/core'

import type { Theme } from './types'

const QUERY = '(prefers-color-scheme: dark)'

// The pure rule, separate from the reactive wiring so it can be tested directly.
export function resolveDark(theme: Theme, systemDark: boolean): boolean {
  return theme === 'system' ? systemDark : theme === 'dark'
}

// Whether the widget renders dark. `system` follows the OS and updates live. Call in an injection context.
export function themeIsDark(theme: Signal<Theme>): Signal<boolean> {
  const query = typeof window === 'undefined' ? undefined : window.matchMedia(QUERY)
  const systemDark = signal(query?.matches ?? false)
  const onChange = () => systemDark.set(query?.matches ?? false)
  query?.addEventListener('change', onChange)
  inject(DestroyRef).onDestroy(() => query?.removeEventListener('change', onChange))
  return computed(() => resolveDark(theme(), systemDark()))
}
