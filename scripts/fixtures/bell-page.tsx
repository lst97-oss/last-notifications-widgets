// Browser harness for scripts/check-bell.ts. The check serves this bundle and a stub recipient API.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NotificationBell, NotificationBellUnavailable, type Theme } from '../../packages/react/dist/index'

declare global {
  interface Window {
    __setSession: (session: string | null) => void
    // The host flips its own theme at runtime; the bell must follow without a reload.
    __setTheme: (theme: Theme) => void
    // Every failure the host's onError heard, so the check can assert the host is told.
    __errors: { source: string; code: string }[]
  }
}

const params = new URLSearchParams(location.search)
const initialTheme = (params.get('theme') ?? 'system') as Theme

// The page is served from its own origin; the API sits on another, so the calls are cross-origin, as in a real host.
const apiBase = params.get('api') ?? ''

// The host would mint this from its own session; the harness asks the stub. A failed request throws, as the
// README tells hosts to: an error is not a signed-out visitor.
async function tokenFor(session: string | null): Promise<string | null> {
  const response = await fetch(`${apiBase}/api/notifications-token?session=${encodeURIComponent(session ?? '')}`)
  if (!response.ok) throw new Error(`token request failed (${response.status})`)
  return ((await response.json()) as { token: string | null }).token
}

window.__errors = []

function App() {
  const [session, setSession] = useState<string | null>(params.get('session'))
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => {
    window.__setSession = setSession
    window.__setTheme = setTheme
  }, [])
  const themeVars = { vars: { destructive: 'rgb(0, 128, 0)' } }
  // A host that cannot mount the live bell yet renders the unavailable bell; a click on its retry is counted.
  if (params.get('unavailable') === '1') {
    return (
      <NotificationBellUnavailable
        onRetry={() =>
          document.body.setAttribute('data-retried', String(Number(document.body.dataset.retried ?? 0) + 1))
        }
        theme={theme}
        themeVars={themeVars}
      />
    )
  }
  return (
    <NotificationBell
      baseUrl={apiBase}
      appKey="app-1"
      session={session}
      getToken={() => tokenFor(session)}
      onError={(error) => window.__errors.push({ source: error.source, code: error.code })}
      theme={theme}
      themeVars={themeVars}
    />
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
