# @lst97-oss/last-notifications-widgets

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
