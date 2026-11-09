---
"@lst97-oss/last-notifications-widgets": minor
---

Add the Vue, vanilla and Angular bells. Each one binds the same client store as the React bell and renders the same
UI, props and DOM hooks.

- New entries: `@lst97-oss/last-notifications-widgets/vue`, `/vanilla` and `/angular`, with their own stylesheets at `/vue/styles.css`, `/vanilla/styles.css` and `/angular/styles.css`.
- New stylesheet for React at `/react/styles.css`. The root `./styles.css` still points at the React sheet, so existing imports keep working.
- The client exports `bellLabel` and `bellAnnouncement`, the trigger label and live announcement that every port shares.
- Vue, Angular and Lucide-Angular are optional peers, so React apps install nothing new.
