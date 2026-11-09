# AGENTS.md

Guidance for agents working in this repo. The scope is a single bell widget; see README.md for the contract.

## Layout

- `packages/client` — framework-free: `api.ts` (wire types, HTTP), `store.ts` (stream, cursor, token rotation, optimistic reads), `bell.ts` (the trigger label and live announcement), `theme.ts`, `format.ts`. Pure TypeScript, no React.
- `packages/react` — the React bell. `src/ui/` holds shadcn components (base-nova, `components.json`); `src/lib/utils.ts` is `cn`. `NotificationBellTheme` owns the `.ln-bell` scope and the portal context, mirroring last-comments-widgets.
- `packages/vue` — the Vue 3 bell. `src/components/` mirrors the React files; `src/lib/` holds the portal root, theme and store composables. Portals use reka-ui with the `.ln-bell` root as target.
- `packages/vanilla` — the plain-DOM bell (`mountNotificationBell`). No framework: `mount.ts` rebuilds the panel from the store and keeps focus with `data-ln-key`.
- `packages/angular` — the Angular bell (`NotificationBellComponent`), built with ng-packagr in partial compilation mode. Its popup is positioned in the component, not in a CDK overlay.
- `packages/theme` — Tailwind tokens scoped to `.ln-bell` with `@scope`. Each front-end compiles it into its own `dist/styles.css`.
- `packages/last-notifications-widgets` — the only published package. `scripts/assemble-package.ts` builds it (the `ENTRIES` table lists each front-end's entry files); `scripts/check-package.ts` guards it.

- `packages/client/src/server.ts` — the server SDK, its own entry (`/server`). Keep it out of every browser entry: `scripts/check-package.ts` fails if a browser bundle references `createNotificationsClient`.

## Rules

- Never hand-type HTTP status numbers or standard error codes: use `@lst97-oss/last-httprism`. The client compares `error.code`, never a status number.
- Only the recipient token goes to the browser. Never add an app key or a recipient key to the widget's inputs.
- Portals render inside the `.ln-bell` root (`WidgetRootContext`) so the scoped theme applies.
- Browser checks must bundle with tsup/esbuild. Bun's bundler breaks Base UI's popover, which surfaces as a false `target.addEventListener is not a function`.
- Do not hand-edit `src/ui/*` beyond the portal container; re-add components with `bunx shadcn add <name>`.
- `getToken` throwing is an error state, not signed-out. Only `null` means signed-out; the store must never turn a throw into `anonymous`.
- Retries live only in the store, on one `createBackoff` schedule. The transport (`callApi`, `createTokenProvider`) is single-shot and classifies failures with `ApiError.retryable` / `TokenError`; a non-retryable failure stops the bell instead of retrying.
- Every failed call throws `ApiError`, including network and timeout failures (`status` 0). Failures reach the host through `onError`. The bell's own error state covers a failed start or load, not a stream outage; never add a host-rendered error UI.
- Ports stay in parity. Every front-end uses the same prop names, the same `createInboxStore`, and the same DOM hooks (`.ln-bell`, `.ln-trigger`, `.ln-popup`, `.ln-item`, `data-ln-*`). `scripts/check-bell.ts` runs one scenario list against each port (`bun scripts/check-bell.ts <react|vue|vanilla|angular>`); a port that needs a selector changed fails there, so change the port, not the scenario.
- The trigger label and the live announcement come from `packages/client/src/bell.ts` (`bellLabel`, `bellAnnouncement`). Never re-derive them in a port.
- Each port's class strings (`classes.ts` in vanilla, vue and angular; the `ui/` wrappers in react) copy the shadcn values. Change them together.
- Each framework imports its own stylesheet (`<pkg>/vue/styles.css` and so on). The compiled CSS only has the classes that framework uses.
- Biome does not lint `.vue` files, because it cannot see identifiers used only in a template. `vue-tsc` covers them.
