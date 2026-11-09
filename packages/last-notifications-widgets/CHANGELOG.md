# @lst97-oss/last-notifications-widgets

## 0.2.1

### Patch Changes

- `lucide` and `lucide-react` are optional peers instead of dependencies, matching the existing `@lucide/vue` and
  `@lucide/angular` peers. Install `lucide-react` for the React entry and `lucide` for the vanilla entry. A default
  install no longer pulls both icon packages (~82 MB) for frameworks you do not use.

## 0.2.0

### Minor Changes

- 9416d92: Add the Vue, vanilla and Angular bells. Each one binds the same client store as the React bell and renders the same
  UI, props and DOM hooks.
  
  - New entries: `@lst97-oss/last-notifications-widgets/vue`, `/vanilla` and `/angular`, with their own stylesheets at `/vue/styles.css`, `/vanilla/styles.css` and `/angular/styles.css`.
  - New stylesheet for React at `/react/styles.css`. The root `./styles.css` still points at the React sheet, so existing imports keep working.
  - The client exports `bellLabel` and `bellAnnouncement`, the trigger label and live announcement that every port shares.
  - Vue, Angular and Lucide-Angular are optional peers, so React apps install nothing new.

### Patch Changes

- 4ed627e: Fix how the live bell recovers from failures, and tidy the code behind it.
  
  - A token refresh that fails during a request is retried. It is no longer reported as a permanent refusal.
  - A stream that opens and drops at once keeps backing off, and its outage is reported once. The schedule resets only after the stream stays up for 30 seconds.
  - A stream that does not answer within 10 seconds, or sends nothing for 90 seconds, is cut and reconnected.
  - A row that shares a timestamp stays in the list after the bell re-reads its first page.
  - A server's `Retry-After` is capped at 5 minutes.
  - The token request is never served from the browser cache.
  - The vanilla bell draws a burst of changes once instead of once per change.
  - `clsx` is no longer a direct dependency.

## 0.1.0

### Minor Changes

- The bell shows a failure instead of disappearing. A failed token request or load keeps the bell icon, adds a warning triangle, and opens to one general message with "Try again". A `getToken` that throws is now an error, not a signed-out visitor. Only `null` still means signed out.

  - **`onError`** on `NotificationBell` reports every failure to the host, for logs and metrics. A stream outage is reported once per outage.
  - **`NotificationBellUnavailable`** renders the same error bell for a host that cannot mount the live bell yet.
  - **Network and timeout failures** reject with `ApiError` (`code` `NETWORK_ERROR` or `TIMEOUT`, `status` `0`), not a raw `TypeError`. The server SDK behaves the same way.
  - **Load-more and actions** keep the rows already shown when a later page fails. `archive`, `restore`, `archiveRead` and `markAllRead` resolve `true` or `false`, and the bell announces a failed archive, restore or bulk action. A single mark-read stays silent, because a link click navigates away.

- The bell retries on its own. A failed start, token refresh or load retries with backoff, honoring `Retry-After`, and pauses while the browser is offline or the tab is hidden. A failed action no longer replaces the list with an error.

  - **`tokenUrl`** on `NotificationBell` is the host's token endpoint. The widget calls it, so a host does not write fetch and envelope parsing. `getToken` still works.
  - **`TokenError`** lets a host throw a token failure with its status. A 501, 401 or 404 stops the bell; a 503 is retried.
  - **`ApiError`** gains `retryable`, `retryAfterMs` and `requestId`. **`InboxError`** gains `retryable` and `requestId`. Branch on `retryable` rather than on `status`.
  - **Server SDK:** `createNotificationsClient` takes an optional `requestId`, sent as `x-request-id`.

- `publish` takes `channels` as a non-empty list, matching the server, which rejects an empty one. Omit the field to use the server's defaults; a list built at runtime must keep at least one channel.
