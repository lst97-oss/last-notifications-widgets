// Browser harness for scripts/check-bell.ts, the vanilla port. Same globals, query params and DOM as the React fixture
// (scripts/fixtures/bell-page.tsx), so every scenario runs unchanged. Bundled with tsup, not Bun's bundler.
import { type Theme, mountNotificationBell, mountNotificationBellUnavailable } from '../dist/index.js'

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
const root = document.getElementById('root') as HTMLElement
let session = params.get('session')
let theme = (params.get('theme') ?? 'system') as Theme
const themeVars = { vars: { destructive: 'rgb(0, 128, 0)' } }

if (params.get('unavailable') === '1') {
  mountNotificationBellUnavailable(root, {
    onRetry: () => document.body.setAttribute('data-retried', String(Number(document.body.dataset.retried ?? 0) + 1)),
    theme,
    themeVars,
  })
} else {
  const bell = mountNotificationBell(root, {
    baseUrl: apiBase,
    appKey: 'app-1',
    session,
    getToken: () => tokenFor(session),
    onError: (error) => window.__errors.push({ source: error.source, code: error.code }),
    theme,
    themeVars,
  })
  window.__setSession = (value) => {
    session = value
    bell.update({ session: value })
  }
  window.__setTheme = (value) => {
    theme = value
    bell.update({ theme: value })
  }
}
