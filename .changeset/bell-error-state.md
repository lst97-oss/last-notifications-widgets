---
"@lst97-oss/last-notifications-widgets": minor
---

The bell shows a failure instead of disappearing. A failed token request or load keeps the bell icon, adds a warning triangle, and opens to one general message with "Try again". A `getToken` that throws is now an error, not a signed-out visitor. Only `null` still means signed out.

- **`onError`** on `NotificationBell` reports every failure to the host, for logs and metrics. A stream outage is reported once per outage.
- **`NotificationBellUnavailable`** renders the same error bell for a host that cannot mount the live bell yet.
- **Network and timeout failures** reject with `ApiError` (`code` `NETWORK_ERROR` or `TIMEOUT`, `status` `0`), not a raw `TypeError`. The server SDK behaves the same way.
- **Load-more and actions** keep the rows already shown when a later page fails. `archive`, `restore`, `archiveRead` and `markAllRead` resolve `true` or `false`, and the bell announces a failed archive, restore or bulk action. A single mark-read stays silent, because a link click navigates away.
