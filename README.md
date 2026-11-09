# last-notifications-widgets

A notification bell for sites that use last-notifications, the notifications server. It shows the signed-in
user's in-app notifications: an unread badge, a popover list, mark read, mark all read, click-through
via `data.url`, and live arrivals over the server's stream.

## Install

```sh
bun add @lst97-oss/last-notifications-widgets
# or: npm install @lst97-oss/last-notifications-widgets
```

React is an optional peer: the `/react` entry needs React 19, while `/client` and `/server` do not.

```tsx
import '@lst97-oss/last-notifications-widgets/styles.css'
import { NotificationBell } from '@lst97-oss/last-notifications-widgets/react'

<NotificationBell
  baseUrl="https://notifications.example.com"
  appKey="my-app"
  session={hostUser.id}
  tokenUrl="/api/notifications-token"
  onError={(error) => console.warn('[notifications]', error.source, error.code, error.retryable)}
/>
```

## Other frameworks

The same bell ships for Vue, plain HTML and Angular, with the same props as the React bell. Each framework imports its
own stylesheet, because the compiled CSS only carries the classes that framework's bell uses.

```vue
<script setup lang="ts">
import '@lst97-oss/last-notifications-widgets/vue/styles.css'
import { NotificationBell } from '@lst97-oss/last-notifications-widgets/vue'
</script>

<template>
  <NotificationBell
    base-url="https://notifications.example.com"
    app-key="my-app"
    :session="hostUser.id"
    token-url="/api/notifications-token"
    :on-error="(error) => console.warn('[notifications]', error.source, error.code)"
  />
</template>
```

```html
<div id="bell"></div>
<script type="module">
  import '@lst97-oss/last-notifications-widgets/vanilla/styles.css'
  import { mountNotificationBell } from '@lst97-oss/last-notifications-widgets/vanilla'

  const bell = mountNotificationBell(document.getElementById('bell'), {
    baseUrl: 'https://notifications.example.com',
    appKey: 'my-app',
    session: hostUser.id, // null renders nothing; call bell.update({ session }) when it changes
    tokenUrl: '/api/notifications-token',
  })
</script>
```

```ts
// In the global styles: @import "@lst97-oss/last-notifications-widgets/angular/styles.css";
import { Component } from '@angular/core'
import { NotificationBellComponent } from '@lst97-oss/last-notifications-widgets/angular'

@Component({
  selector: 'app-bell',
  imports: [NotificationBellComponent],
  template: `<ln-notification-bell baseUrl="https://notifications.example.com" appKey="my-app"
    [session]="hostUser.id" tokenUrl="/api/notifications-token" (error)="log($event)" />`,
})
export class BellComponent {}
```

Vue needs `vue`, `reka-ui` and `@lucide/vue`. Angular needs `@angular/core`, `@angular/common` and `@lucide/angular`.
Vanilla needs nothing extra. These are optional peers, so a React app never installs them.

## Sending notifications from a backend (server SDK)

Any host can publish, without the bell: the server entry sends with the app's `lnk_` key. It refuses to run in a browser, so the key cannot reach a page.

```ts
import { createNotificationsClient } from '@lst97-oss/last-notifications-widgets/server'

const notifications = createNotificationsClient({
  baseUrl: process.env.NOTIFICATIONS_URL!,
  appKey: process.env.NOTIFICATIONS_APP_KEY!,
  apiKey: process.env.NOTIFICATIONS_API_KEY!, // lnk_…, server-side only
})

await notifications.publish({
  recipientKey: 'user-42',
  type: 'comment.reply',
  title: 'New reply',
  channels: ['inapp', 'email'],
  data: { url: '/comments/9' },
})
```

- `publish` takes `channels`: a list of at least one of `inapp`, `email`, `webpush` and `webhook`. `webhook` is opt-in: name it to send it. Omit `channels` to use the server's defaults (`inapp`, `email`, `webpush`).
- The wire shapes are documented at the server's `/api/reference`; the raw OpenAPI document is `/api/openapi.json`.
- A call can time out after the server already saved the notification. Retry a `publish` with the same `dedupeKey`, or the notification is sent twice.
- `mintRecipientToken(recipientKey)` returns a token for the bell, valid 15 minutes.
- `setContact(recipientKey, { channel: 'email' | 'webhook', address })` stores where a recipient is reached. A webhook URL needs the `recipients:update` permission.
- `setPreference(recipientKey, { channel, enabled })` opts a recipient in or out of a channel.
- `deleteNotification(id, { recipientKey })` removes one notification. The key needs `notifications:delete`.
- A failed call rejects with `ApiError`, imported from the `/server` entry. `code` is the server's code, or `NETWORK_ERROR` and `TIMEOUT` when no response arrived (`status` is `0`). Branch on `code`, never on `status`.

### Delivery settings and recipients

Register the app's delivery settings on every boot. The call is idempotent, and a secret is returned only by the call that issues it, so store it at that moment.

```ts
const { webhook } = await notifications.delivery.configure({
  webhook: { endpointUrl: 'https://app.example.com/hooks/notifications' },
})
if (webhook?.secret) await secrets.save('webhook-signing', webhook.secret) // shown once

await notifications.delivery.get() // channels, enabled and configured; never a secret
await notifications.delivery.webhook.rotateSecret() // explicit; redeploy the receiver with the new secret

await notifications.recipients.set('user-42', {
  email: 'user@example.com',
  webhookUrl: 'https://hooks.example.com/user-42',
  preferences: { webpush: false },
})
await notifications.recipients.get('user-42') // masked: a***@example.com, webhook origin only
await notifications.recipients.list({ limit: 50, cursor }) // keyset page; `next` is the cursor
await notifications.recipients.clear('user-42', ['email']) // idempotent
```

- `recipients.set` writes each field as its own request, so it is not atomic. Repeating the call is the way to recover from a failure part-way.
- A recipient's own webhook URL wins over the app endpoint. Each notification is posted once.
- Retries are the caller's choice: every call here is safe to repeat except `rotateSecret`, which replaces the secret each time.

**Recommended keys.** Use one key per role, per environment. **Publisher**: `notifications:create`, for workers that only send. **Integration**: `recipients:read`, `recipients:update`, `recipients:delete`, `channels:read`, `channels:update`, `tokens:create`, for the backend that manages recipients and delivery settings. Keep the integration key out of workers, and never ship any `lnk_` key to a browser.

## Contract

- **The host mints the token.** `getToken` calls the host's own endpoint, which authenticates the
  session and mints an `lrt_` recipient token with its app key. The widget never receives an app key
  or a recipient key.
- **`session` is the isolation guard.** A change stops the old store, drops its items, and refetches.
  `null` or `undefined` renders nothing.
- **`getToken` returning `null`** means a signed-out visitor: nothing renders.
- **A token failure** is an error, not a signed-out visitor. The bell keeps its icon, adds a warning triangle, and
  shows one general message. A retryable failure is retried on its own (see Errors and retries), and "Try again"
  appears only when a retry can help. Return `null` only when the visitor is signed out.
- **`onError`** hears every failure, with `code`, `retryable` and the server's `requestId` when it sent one, for logs
  and metrics. A stream outage and a token outage are each reported once, not on every retry. The bell shows its
  error state when it cannot start or load. A stream outage does not show it, so the bell keeps its last list until
  the stream returns. A throwing `onError` cannot break it.
- **`NotificationBellUnavailable`** renders the same error bell for a host that cannot mount the live bell
  yet. It takes an `onRetry` and no token, key or URL.
- **`getToken` must return a valid token.** Mint on each call, or cache only until shortly before the
  token expires. A host that keeps returning an expired token leaves the bell retrying with it, up to every
  30 seconds, and the bell never recovers until a valid token arrives.
- **Tokens last 15 minutes.** The widget rotates them and reconnects the stream from the last cursor,
  so a rotation loses no rows.
- **Only in-app notifications appear.** A notification published with `channels: ['email']` never
  shows in the bell.

### Errors and retries

The bell retries on its own, so a host does not write retry loops. One schedule covers every automatic retry:
stream reconnects, token refreshes and failed loads. Each wait doubles from about one second up to 30 seconds, with
jitter, and a server's `Retry-After` replaces the wait once. Retries pause while the browser is offline or the tab
is hidden, and resume when it returns. A `Retry-After` longer than 5 minutes is capped at 5 minutes.

A live stream that does not answer within 10 seconds, or sends nothing for 90 seconds, is cut and reconnected. A stream
that stays up for 30 seconds resets the schedule and ends its outage, so a stream that opens and drops at once keeps
backing off and is reported once.

| Failure                                                 | Retried on its own | What the bell shows       |
| ------------------------------------------------------- | ------------------ | ------------------------- |
| Network error, timeout, 408, 425, 429, 500, 502, 503, 504 | yes                | message and "Try again"   |
| Other 4xx, and 501                                      | no                 | message only              |

A permanent failure stops the bell's retries, so a configuration fault never loops. A failed action (mark read,
archive, restore) never replaces the list: the rows stay, and the list reloads in the background.

`tokenUrl` is the host's token endpoint. The widget calls it, applies the timeout and the retry rules above, and
reads `{data:{token}}`; `{data:{token:null}}` means a signed-out visitor. Use `getToken` instead when the host needs its
own call. To say a failure is permanent, throw a `TokenError` with the status the host sent (`401`, `404` or `501`
are permanent, `503` is retried).

## Theming

`themeVars` is the one configuration object for design knobs; a new knob is a new key, not a prop.

```tsx
<NotificationBell
  theme="system"            // 'light' | 'dark' | 'system'
  themeVars={{
    vars: { primary: 'oklch(0.55 0.2 260)', radius: '0.75rem' },
    dark: { primary: 'oklch(0.8 0.15 260)' },
  }}
  …
/>
```

Light and dark follow the `theme` prop. To switch with your app's own toggle, pass `'light'` or `'dark'` from your state (or from `<html>`'s `dark` class, as last-comments does); the open bell restyles at once, no reload. `'system'` follows the OS.

Shadcn-named tokens (`background`, `primary`, `muted`, `border`, `radius`, …) match last-comments-widgets,
so one brand object themes both. The `--ln-*` knobs cover layout (`triggerSize`, `popoverWidth`,
`popoverMaxHeight`, `popoverShadow`) and badge colours. Host CSS can also override a token: `#nav .ln-bell { --primary: #0a7; }`.

## Server requirements

- Register the site's origin on the app at `/dashboard/apps`. Mark read is a cross-origin POST.
- The stream is long-lived. Run the server with `NITRO_PRESET=node-server` (the Docker default); the
  `vercel` preset cannot hold it open.
- Send a keepalive comment (a line starting with `:`) on the stream at least every 45 seconds. The widget cuts a
  stream that is silent for 90 seconds, so a quiet but healthy stream must still send one.

## Development

```sh
bun install
bun run check          # format, lint, typecheck, unit tests
bun run build          # client, react, vue, vanilla, angular, and the one published package
bun run package:check  # publish guard
bun run test:bell      # Chrome check of every port against a stub recipient API
```

`examples/react` is a Vite demo. It needs `NOTIFICATIONS_URL`, `NOTIFICATIONS_APP_KEY`,
`NOTIFICATIONS_API_KEY` (a server-side `lnk_` key, read only in `vite.config.ts`) and
`VITE_NOTIFICATIONS_APP_KEY`.
