// Browser harness for scripts/check-bell.ts, the Vue port. Same globals, query params and DOM as the React fixture
// (scripts/fixtures/bell-page.tsx), so every scenario runs unchanged. Bundled with tsup, not Bun's bundler.
import { createApp, h, ref } from 'vue'

import { NotificationBell, NotificationBellUnavailable, type Theme } from '../dist/index.js'

declare global {
  interface Window {
    __setSession: (session: string | null) => void
    __setTheme: (theme: Theme) => void
    __errors: { source: string; code: string }[]
  }
}

const params = new URLSearchParams(location.search)
const apiBase = params.get('api') ?? ''

// The host would mint this from its own session; a failed request throws, as the README tells hosts to.
async function tokenFor(session: string | null): Promise<string | null> {
  const response = await fetch(`${apiBase}/api/notifications-token?session=${encodeURIComponent(session ?? '')}`)
  if (!response.ok) throw new Error(`token request failed (${response.status})`)
  return ((await response.json()) as { token: string | null }).token
}

window.__errors = []
const session = ref<string | null>(params.get('session'))
const theme = ref<Theme>((params.get('theme') ?? 'system') as Theme)
window.__setSession = (value) => {
  session.value = value
}
window.__setTheme = (value) => {
  theme.value = value
}
const themeVars = { vars: { destructive: 'rgb(0, 128, 0)' } }
const unavailable = params.get('unavailable') === '1'

createApp({
  render: () =>
    unavailable
      ? h(NotificationBellUnavailable, {
          onRetry: () =>
            document.body.setAttribute('data-retried', String(Number(document.body.dataset.retried ?? 0) + 1)),
          theme: theme.value,
          themeVars,
        })
      : h(NotificationBell, {
          baseUrl: apiBase,
          appKey: 'app-1',
          session: session.value,
          getToken: () => tokenFor(session.value),
          onError: (error: { source: string; code: string }) =>
            window.__errors.push({ source: error.source, code: error.code }),
          theme: theme.value,
          themeVars,
        }),
}).mount('#root')
