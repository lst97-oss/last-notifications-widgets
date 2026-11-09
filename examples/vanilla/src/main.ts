import '@last-notifications-widgets/vanilla/styles.css'
import { mountNotificationBell } from '@last-notifications-widgets/vanilla'

// The app key is public (it names the app); the server key lives only in vite.config.ts.
const APP_KEY = import.meta.env.VITE_NOTIFICATIONS_APP_KEY as string

// A failed request throws, so the bell shows its error state. Only a 200 with no token means signed out.
async function getToken(): Promise<string | null> {
  const response = await fetch('/api/notifications-token')
  if (!response.ok) throw new Error(`notifications token request failed (${response.status})`)
  return ((await response.json()) as { token: string | null }).token
}

const container = document.getElementById('bell')
if (!container) throw new Error('missing #bell')
mountNotificationBell(container, { baseUrl: '', appKey: APP_KEY, session: 'demo-user', getToken })
