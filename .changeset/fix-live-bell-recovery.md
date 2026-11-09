---
"@lst97-oss/last-notifications-widgets": patch
---

Fix how the live bell recovers from failures, and tidy the code behind it.

- A token refresh that fails during a request is retried. It is no longer reported as a permanent refusal.
- A stream that opens and drops at once keeps backing off, and its outage is reported once. The schedule resets only after the stream stays up for 30 seconds.
- A stream that does not answer within 10 seconds, or sends nothing for 90 seconds, is cut and reconnected.
- A row that shares a timestamp stays in the list after the bell re-reads its first page.
- A server's `Retry-After` is capped at 5 minutes.
- The token request is never served from the browser cache.
- The vanilla bell draws a burst of changes once instead of once per change.
- `clsx` is no longer a direct dependency.
