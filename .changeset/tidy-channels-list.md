---
"@lst97-oss/last-notifications-widgets": minor
---

`publish` takes `channels` as a non-empty list, matching the server, which rejects an empty one. Omit the field to use the server's defaults; a list built at runtime must keep at least one channel.
