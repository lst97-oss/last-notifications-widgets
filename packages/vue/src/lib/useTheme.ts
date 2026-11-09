import { type ComputedRef, computed, onMounted, onUnmounted, ref } from 'vue'

import type { Theme } from '../types'

const QUERY = '(prefers-color-scheme: dark)'

// The pure rule, separate from the reactive wiring so it can be tested directly.
export function resolveDark(theme: Theme, systemDark: boolean): boolean {
  return theme === 'system' ? systemDark : theme === 'dark'
}

// Whether the widget renders dark. `system` follows the OS and updates live; SSR paints light.
export function useTheme(theme: () => Theme): ComputedRef<boolean> {
  const query = typeof window === 'undefined' ? undefined : window.matchMedia(QUERY)
  const systemDark = ref(query?.matches ?? false)
  const onChange = () => {
    systemDark.value = query?.matches ?? false
  }
  onMounted(() => query?.addEventListener('change', onChange))
  onUnmounted(() => query?.removeEventListener('change', onChange))
  return computed(() => resolveDark(theme(), systemDark.value))
}
