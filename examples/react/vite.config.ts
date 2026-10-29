import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// The host's own endpoint in a real site: it authenticates the signed-in user and mints a
// recipient token with the app's server key. The key stays here, on the server, never in the page.
// Dev only: no login, and it always mints a token for demo-user. Never ship this route to production.
function tokenEndpoint(env: Record<string, string>): Plugin {
  return {
    name: 'notifications-token',
    configureServer(server) {
      server.middlewares.use('/api/notifications-token', async (_req: IncomingMessage, res: ServerResponse) => {
        const base = env.NOTIFICATIONS_URL ?? 'http://localhost:3000'
        // Demo user: a real host passes its own stable user id here.
        const recipientKey = 'demo-user'
        const upstream = await fetch(
          `${base}/api/v1/apps/${env.NOTIFICATIONS_APP_KEY}/recipients/${recipientKey}/token`,
          { method: 'POST', headers: { authorization: `Bearer ${env.NOTIFICATIONS_API_KEY}` } },
        )
        const body = (await upstream.json()) as { data?: { token: string } }
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ token: body.data?.token ?? null }))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tokenEndpoint(env)],
    server: {
      // Same-origin in the demo: the page calls /api/v1 and Vite forwards it to the server.
      proxy: { '/api/v1': { target: env.NOTIFICATIONS_URL ?? 'http://localhost:3000', changeOrigin: true } },
    },
  }
})
