import { useCallback, useSyncExternalStore } from 'react'
import type { Theme } from './types'

const QUERY = '(prefers-color-scheme: dark)'

// Whether the widget renders dark. `system` follows the OS and updates live; SSR paints light.
export function useTheme(theme: Theme): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (theme !== 'system') return () => {}
      const query = window.matchMedia(QUERY)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    [theme],
  )
  return useSyncExternalStore(
    subscribe,
    () => (theme === 'system' ? window.matchMedia(QUERY).matches : theme === 'dark'),
    () => theme === 'dark',
  )
}
