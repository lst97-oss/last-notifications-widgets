import { NotificationBell } from '@last-notifications-widgets/react'

// The app key is public (it names the app); the server key lives only in vite.config.ts.
const APP_KEY = import.meta.env.VITE_NOTIFICATIONS_APP_KEY as string

// A failed request throws, so the bell shows its error state. Only a 200 with no token means signed out.
async function getToken(): Promise<string | null> {
  const response = await fetch('/api/notifications-token')
  if (!response.ok) throw new Error(`notifications token request failed (${response.status})`)
  return ((await response.json()) as { token: string | null }).token
}

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Demo site</h1>
        <NotificationBell baseUrl="" appKey={APP_KEY} session="demo-user" getToken={getToken} />
      </header>
    </main>
  )
}
