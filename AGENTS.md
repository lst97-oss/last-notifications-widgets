# AGENTS.md

Guidance for agents working in this repo. The scope is a single bell widget; see README.md for the contract.

## Layout

- `packages/client` — framework-free: `api.ts` (wire types, HTTP), `store.ts` (stream, cursor, token rotation, optimistic reads), `theme.ts`, `format.ts`. Pure TypeScript, no React.
- `packages/react` — the React bell. `src/ui/` holds shadcn components (base-nova, `components.json`); `src/lib/utils.ts` is `cn`. `NotificationBellTheme` owns the `.ln-bell` scope and the portal context, mirroring last-comments-widgets.
- `packages/theme` — Tailwind tokens scoped to `.ln-bell` with `@scope`. It compiles into `react/dist/styles.css`.
- `packages/last-notifications-widgets` — the only published package. `scripts/assemble-package.ts` builds it; `scripts/check-package.ts` guards it.

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
