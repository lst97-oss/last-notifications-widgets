// Browser harness for scripts/check-bell.ts. The check serves this bundle and a stub recipient API.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NotificationBell, type Theme } from '../../packages/react/dist/index'

declare global {
  interface Window {
    __setSession: (session: string | null) => void
    // The host flips its own theme at runtime; the bell must follow without a reload.
    __setTheme: (theme: Theme) => void
  }
}

const params = new URLSearchParams(location.search)
const initialTheme = (params.get('theme') ?? 'system') as Theme

// The page is served from its own origin; the API sits on another, so the calls are cross-origin, as in a real host.
const apiBase = params.get('api') ?? ''

// The host would mint this from its own session; the harness asks the stub.
async function tokenFor(session: string | null): Promise<string | null> {
  const response = await fetch(`${apiBase}/api/notifications-token?session=${encodeURIComponent(session ?? '')}`)
  return ((await response.json()) as { token: string | null }).token
}

function App() {
  const [session, setSession] = useState<string | null>(params.get('session'))
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => {
    window.__setSession = setSession
    window.__setTheme = setTheme
  }, [])
  return (
    <NotificationBell
      baseUrl={apiBase}
      appKey="app-1"
      session={session}
      getToken={() => tokenFor(session)}
      theme={theme}
      themeVars={{ vars: { destructive: 'rgb(0, 128, 0)' } }}
    />
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
