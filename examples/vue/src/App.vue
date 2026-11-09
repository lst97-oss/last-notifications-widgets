<script setup lang="ts">
import { NotificationBell } from '@last-notifications-widgets/vue'

// The app key is public (it names the app); the server key lives only in vite.config.ts.
const APP_KEY = import.meta.env.VITE_NOTIFICATIONS_APP_KEY as string

// A failed request throws, so the bell shows its error state. Only a 200 with no token means signed out.
async function getToken(): Promise<string | null> {
  const response = await fetch('/api/notifications-token')
  if (!response.ok) throw new Error(`notifications token request failed (${response.status})`)
  return ((await response.json()) as { token: string | null }).token
}
</script>

<template>
  <main style="font-family: system-ui, sans-serif; padding: 2rem">
    <header style="display: flex; justify-content: space-between; align-items: center">
      <h1 style="font-size: 1.25rem; margin: 0">Demo site (Vue)</h1>
      <NotificationBell base-url="" :app-key="APP_KEY" session="demo-user" :get-token="getToken" />
    </header>
  </main>
</template>
