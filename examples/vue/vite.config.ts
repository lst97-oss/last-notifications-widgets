import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { tokenEndpoint } from '../shared/token-endpoint'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), tokenEndpoint(env)],
    server: {
      // Same-origin in the demo: the page calls /api/v1 and Vite forwards it to the server.
      proxy: { '/api/v1': { target: env.NOTIFICATIONS_URL ?? 'http://localhost:3000', changeOrigin: true } },
    },
  }
})
