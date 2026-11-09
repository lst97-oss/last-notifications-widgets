# Graph Report - last-notifications-widgets  (2026-11-09)

## Corpus Check
- 127 files · ~36,560 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1094 nodes · 2017 edges · 60 communities (57 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- React Bell UI Components
- Vanilla Bell Mount and Views
- Angular Bell Popover and Items
- React Package Manifest
- Vanilla Package Manifest
- Inbox Store Archive Actions
- check-bell Port Scenarios
- React Example Manifest
- Vue Bell Components and Header
- Umbrella Package Entry Map
- Example App Bootstrapping
- Vue Example Manifest
- shadcn Component Aliases
- Store Test Harness
- Angular TSConfig
- Client Package Build Config
- Formatting and Theme Tokens
- Vue Bell Token and Store Wiring
- Angular Bell Controller
- Client API Wire Types
- HTTP Transport and Failure Backoff
- Server Notifications SDK
- Theme Package Manifest
- Vue List and Archive Views
- Package Assemble and Check Scripts
- Angular Build Dependencies
- Optional Peer Metadata
- Umbrella Peer Dependencies
- Angular Test Fixture
- Vue Build Dependencies
- Angular Package Metadata
- Umbrella Package Metadata
- Vue Theme and Portal Root
- Vanilla Example Manifest
- SSE Stream Transport
- Vue Package Metadata
- Vanilla Test Fixture
- Vite Example Configs
- Server and Token Tests
- Umbrella Runtime Dependencies
- Vue Test Fixture
- Vue TSConfig
- Angular Peer Dependencies
- Vanilla TSConfig
- Changelog Failure Recovery Notes
- Vue Runtime Dependencies
- React TSConfig
- Angular Runtime Dependencies
- Example Demos and Release Notes
- ng-packagr Config
- Angular Repository Link
- Client TSConfig
- Umbrella Repository Link
- Vue Peer Dependencies
- Vue Repository Link
- Vue Package Scripts
- Angular Package Scripts
- React Doctor Config
- Vue Package Exports

## God Nodes (most connected - your core abstractions)
1. `createInboxStore()` - 43 edges
2. `cn()` - 38 edges
3. `createBell()` - 28 edges
4. `NotificationBellComponent` - 20 edges
5. `setState()` - 17 edges
6. `InboxStore` - 16 edges
7. `InboxBell()` - 16 edges
8. `compilerOptions` - 15 edges
9. `InboxState` - 15 edges
10. `WidgetTheme` - 15 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `NotificationBell()`  [EXTRACTED]
  examples/react/src/App.tsx → packages/react/src/NotificationBell.tsx
- `React Example Demo Page` --conceptually_related_to--> `Vue, Vanilla and Angular Bells (v0.2.0)`  [INFERRED]
  examples/react/index.html → packages/last-notifications-widgets/CHANGELOG.md
- `Vanilla Example Demo Page` --references--> `Vue, Vanilla and Angular Bells (v0.2.0)`  [EXTRACTED]
  examples/vanilla/index.html → packages/last-notifications-widgets/CHANGELOG.md
- `Vue Example Demo Page` --references--> `Vue, Vanilla and Angular Bells (v0.2.0)`  [EXTRACTED]
  examples/vue/index.html → packages/last-notifications-widgets/CHANGELOG.md
- `render()` --indirect_call--> `state()`  [INFERRED]
  packages/vanilla/src/mount.ts → packages/client/src/bell.test.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Framework Demo Pages (React / Vue / Vanilla)** — examples_react_index_react_demo_page, examples_vue_index_vue_demo_page, examples_vanilla_index_vanilla_demo_page [INFERRED 0.85]
- **Bell Failure Handling and Retry Contract** — packages_last_notifications_widgets_changelog_live_bell_recovery, packages_last_notifications_widgets_changelog_tokenerror, packages_last_notifications_widgets_changelog_apierror, packages_last_notifications_widgets_changelog_onerror, packages_last_notifications_widgets_changelog_notificationbell_unavailable [INFERRED 0.85]

## Communities (60 total, 3 thin omitted)

### Community 0 - "React Bell UI Components"
Cohesion: 0.07
Nodes (58): InboxError, InboxState, InboxStore, cn(), NotificationArchive(), NotificationArchiveHeader(), InboxBell(), NotificationArchive (+50 more)

### Community 1 - "Vanilla Bell Mount and Views"
Cohesion: 0.07
Nodes (56): APP_KEY, container, bellAnnouncement(), bellLabel(), BellNote, state(), INITIAL_STATE, BELL_BADGE (+48 more)

### Community 2 - "Angular Bell Popover and Items"
Cohesion: 0.06
Nodes (27): BellPopoverComponent, BellRootComponent, BELL_BADGE, ERROR_ICON, GHOST_BUTTON_SMALL, HEADER_BADGE, ICON_BUTTON, MENU_CONTENT (+19 more)

### Community 3 - "React Package Manifest"
Cohesion: 0.05
Nodes (52): dependencies, @base-ui/react@^1.9.0, class-variance-authority@^0.7.1, @last-notifications-widgets/client@workspace:*, lucide-react@^1.61.0, tailwind-merge@^3.7.0, description, devDependencies (+44 more)

### Community 4 - "Vanilla Package Manifest"
Cohesion: 0.06
Nodes (41): bugs, url, dependencies, @last-notifications-widgets/client@workspace:*, lucide@^1.66.0, tailwind-merge@^3.7.0, description, devDependencies (+33 more)

### Community 5 - "Inbox Store Archive Actions"
Cohesion: 0.15
Nodes (41): createArchive(), archive(), archiveRead(), closeArchive(), loadArchive(), loadMoreArchive(), openArchive(), reloadAfterFailure() (+33 more)

### Community 6 - "check-bell Port Scenarios"
Cohesion: 0.09
Nodes (25): api, archives, bearer(), built, CORS, denied(), encoder, failures (+17 more)

### Community 7 - "React Example Manifest"
Cohesion: 0.10
Nodes (26): dependencies, @last-notifications-widgets/react@workspace:*, @last-notifications-widgets/theme@workspace:*, react@^19.3.1, react-dom@^19.3.1, devDependencies, @types/react@^19.3.0, @types/react-dom@^19.3.0 (+18 more)

### Community 8 - "Vue Bell Components and Header"
Cohesion: 0.12
Nodes (17): widgetRoot, heading, hasRead, props, widgetRoot, BELL_BADGE, ERROR_ICON, HEADER_BADGE (+9 more)

### Community 9 - "Umbrella Package Entry Map"
Cohesion: 0.08
Nodes (25): import, types, import, types, exports, ./angular, ./angular/styles.css, ./client (+17 more)

### Community 10 - "Example App Bootstrapping"
Cohesion: 0.09
Nodes (8): App(), APP_KEY, APP_KEY, App(), initialTheme, params, tokenFor(), Window

### Community 11 - "Vue Example Manifest"
Cohesion: 0.11
Nodes (22): dependencies, @last-notifications-widgets/vue@workspace:*, @lucide/vue@^1.61.0, reka-ui@^2.11.0, vue@^3.5.44, devDependencies, typescript@^6.0.3, vite@^8.3.5 (+14 more)

### Community 12 - "shadcn Component Aliases"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 13 - "Store Test Harness"
Cohesion: 0.13
Nodes (13): InboxPage, UNAVAILABLE_MESSAGE, archivedRow(), defaultFetch(), FakeStream, harness(), ok(), page (+5 more)

### Community 14 - "Angular TSConfig"
Cohesion: 0.10
Nodes (19): angularCompilerOptions, standalone, strictTemplates, compilerOptions, declaration, emitDecoratorMetadata, experimentalDecorators, lib (+11 more)

### Community 15 - "Client Package Build Config"
Cohesion: 0.11
Nodes (19): description, devDependencies, tsup@^9.0.0, typescript@^6.0.3, exports, ./package.json, files, tsup (+11 more)

### Community 16 - "Formatting and Theme Tokens"
Cohesion: 0.13
Nodes (16): format, formatRelativeTime(), safeUrl(), UNITS, THEME_CSS_VARIABLES, ThemeKey, ThemeVars, themeVarsToStyle() (+8 more)

### Community 17 - "Vue Bell Token and Store Wiring"
Cohesion: 0.21
Nodes (11): WidgetTheme, createTokenProvider(), TokenError, note, props, { store, state }, instanceKey, props (+3 more)

### Community 19 - "Client API Wire Types"
Cohesion: 0.16
Nodes (15): InboxApi, InboxListOptions, LOAD_ERROR_MESSAGE, TOKEN_ERROR_CODE, ArchiveDeps, ArchiveState, ArchiveStatus, browser (+7 more)

### Community 20 - "HTTP Transport and Failure Backoff"
Cohesion: 0.22
Nodes (12): createInboxApi(), createBackoff(), Failure, ApiError, callApi(), Envelope, FetchLike, isRetryableStatus() (+4 more)

### Community 21 - "Server Notifications SDK"
Cohesion: 0.11
Nodes (17): Channel, CHANNELS, CONTACT_CHANNELS, ContactChannel, DeliveryChannel, DeliverySettings, NotificationData, NotificationsClient (+9 more)

### Community 22 - "Theme Package Manifest"
Cohesion: 0.13
Nodes (17): description, devDependencies, shadcn@^4.22.2, tailwindcss@4.3.3, tw-animate-css@^1.4.0, exports, ./package.json, ./theme.css (+9 more)

### Community 23 - "Vue List and Archive Views"
Cohesion: 0.16
Nodes (6): props, props, TITLE_WIDTHS, GHOST_BUTTON_SMALL, OUTLINE_BUTTON_SMALL, cn()

### Community 24 - "Package Assemble and Check Scripts"
Cohesion: 0.11
Nodes (14): ADAPTERS, ENTRIES, missing, required, BROWSER_ENTRY, declared, FRONT_ENDS, Manifest (+6 more)

### Community 25 - "Angular Build Dependencies"
Cohesion: 0.12
Nodes (17): devDependencies, @angular/compiler-cli@22.2.3, @last-notifications-widgets/theme@workspace:*, ng-packagr@22.2.4, rxjs@^7.8.2, tailwindcss@4.3.3, @tailwindcss/cli@4.3.3, tslib@^2.8.1 (+9 more)

### Community 26 - "Optional Peer Metadata"
Cohesion: 0.12
Nodes (17): optional, optional, optional, optional, peerDependenciesMeta, @angular/common, @angular/core, @lucide/angular (+9 more)

### Community 27 - "Umbrella Peer Dependencies"
Cohesion: 0.12
Nodes (17): @angular/common, @angular/core, @lucide/angular, @lucide/vue, react, react-dom, reka-ui, vue (+9 more)

### Community 28 - "Angular Test Fixture"
Cohesion: 0.13
Nodes (7): @angular/compiler@22.2.3, Fixture, host, params, tokenFor(), Window, @angular/compiler

### Community 29 - "Vue Build Dependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @last-notifications-widgets/theme@workspace:*, tailwindcss@4.3.3, @tailwindcss/cli@4.3.3, typescript@^6.0.3, vite@^8.3.5, @vitejs/plugin-vue@^6.0.10, vue-tsc@^3.3.13 (+7 more)

### Community 30 - "Angular Package Metadata"
Cohesion: 0.14
Nodes (13): bugs, url, description, exports, ./styles.css, files, homepage, license (+5 more)

### Community 31 - "Umbrella Package Metadata"
Cohesion: 0.14
Nodes (13): bugs, url, description, files, homepage, keywords, license, name (+5 more)

### Community 32 - "Vue Theme and Portal Root"
Cohesion: 0.21
Nodes (8): dark, props, root, resolveDark(), useTheme(), provideWidgetRoot(), useWidgetRoot(), WidgetRootKey

### Community 33 - "Vanilla Example Manifest"
Cohesion: 0.18
Nodes (12): dependencies, @last-notifications-widgets/vanilla@workspace:*, devDependencies, vite@^8.3.5, vite, name, private, scripts (+4 more)

### Community 34 - "SSE Stream Transport"
Cohesion: 0.21
Nodes (9): EMPTY, openSseStream(), dispatch(), expectProgress(), read(), StreamTimeouts, encoder, settle() (+1 more)

### Community 35 - "Vue Package Metadata"
Cohesion: 0.15
Nodes (12): bugs, url, description, files, homepage, license, main, name (+4 more)

### Community 36 - "Vanilla Test Fixture"
Cohesion: 0.17
Nodes (6): params, root, session, theme, themeVars, Window

### Community 37 - "Vite Example Configs"
Cohesion: 0.31
Nodes (3): tokenEndpoint(), vite-plugin-dts@^5.1.2, vite-plugin-dts

### Community 38 - "Server and Token Tests"
Cohesion: 0.22
Nodes (4): createNotificationsClient(), client(), Sent, providerReturning()

### Community 39 - "Umbrella Runtime Dependencies"
Cohesion: 0.18
Nodes (11): dependencies, @base-ui/react@^1.9.0, class-variance-authority@^0.7.1, lucide@^1.66.0, lucide-react@^1.61.0, tailwind-merge@^3.7.0, @base-ui/react, class-variance-authority (+3 more)

### Community 40 - "Vue Test Fixture"
Cohesion: 0.18
Nodes (5): params, session, theme, themeVars, Window

### Community 41 - "Vue TSConfig"
Cohesion: 0.18
Nodes (10): compilerOptions, allowImportingTsExtensions, jsx, moduleResolution, noEmit, strict, types, extends (+2 more)

### Community 42 - "Angular Peer Dependencies"
Cohesion: 0.20
Nodes (10): @angular/common@22.2.3, @angular/core@22.2.3, @angular/platform-browser@22.2.3, @angular/common, @angular/core, peerDependencies, @angular/common@^22.0.0, @angular/core@^22.0.0 (+2 more)

### Community 43 - "Vanilla TSConfig"
Cohesion: 0.20
Nodes (9): compilerOptions, allowImportingTsExtensions, moduleResolution, noEmit, strict, types, extends, include (+1 more)

### Community 44 - "Changelog Failure Recovery Notes"
Cohesion: 0.25
Nodes (8): ApiError (retryable / retryAfterMs / requestId), createNotificationsClient (requestId -> x-request-id), InboxError, NotificationBellUnavailable, onError Callback, publish channels Non-Empty Validation, TokenError, tokenUrl Host Token Endpoint Prop

### Community 45 - "Vue Runtime Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, @last-notifications-widgets/client@workspace:*, @lucide/vue@^1.61.0, reka-ui@^2.11.0, tailwind-merge@^3.7.0, @last-notifications-widgets/client, @lucide/vue, reka-ui (+1 more)

### Community 46 - "React TSConfig"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, paths, types, extends, include, ../../tsconfig.json

### Community 47 - "Angular Runtime Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, @last-notifications-widgets/client@workspace:*, @lucide/angular@^1.66.0, tailwind-merge@^3.7.0, @last-notifications-widgets/client, @lucide/angular, tailwind-merge

### Community 48 - "Example Demos and Release Notes"
Cohesion: 0.47
Nodes (5): React Example Demo Page, Vanilla Example Demo Page, Vue Example Demo Page, bellLabel / bellAnnouncement Client Exports, Vue, Vanilla and Angular Bells (v0.2.0)

### Community 49 - "ng-packagr Config"
Cohesion: 0.33
Nodes (5): allowedNonPeerDependencies, dest, lib, entryFile, $schema

### Community 50 - "Angular Repository Link"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 51 - "Client TSConfig"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.json

### Community 52 - "Umbrella Repository Link"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 53 - "Vue Peer Dependencies"
Cohesion: 0.50
Nodes (4): vue@^3.5.44, vue, peerDependencies, vue@~3.5.44

### Community 54 - "Vue Repository Link"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 55 - "Vue Package Scripts"
Cohesion: 0.50
Nodes (4): scripts, build, test, typecheck

### Community 56 - "Angular Package Scripts"
Cohesion: 0.67
Nodes (3): scripts, build, typecheck

### Community 58 - "Vue Package Exports"
Cohesion: 0.67
Nodes (3): exports, ./package.json, ./styles.css

## Knowledge Gaps
- **9 isolated node(s):** `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json`, `bellLabel / bellAnnouncement Client Exports` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 437 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `InboxStore` connect `React Bell UI Components` to `Vanilla Bell Mount and Views`, `Angular Bell Popover and Items`, `Vue Bell Components and Header`, `Store Test Harness`, `Vue Bell Token and Store Wiring`, `Angular Bell Controller`, `Client API Wire Types`, `Vue List and Archive Views`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `createInboxStore()` (e.g. with `authorized()` and `fail()`) actually correct?**
  _`createInboxStore()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.json`, `../../tsconfig.json`, `../../tsconfig.json` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React Bell UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07381748686096512 - nodes in this community are weakly interconnected._
- **Why does `vite-plugin-dts` connect `Vite Example Configs` to `Vue Package Metadata`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `Vanilla Bell Mount and Views` be split into smaller, more focused modules?**
  _Cohesion score 0.06947996589940324 - nodes in this community are weakly interconnected._
- **Why does `createInboxStore()` connect `Inbox Store Archive Actions` to `React Bell UI Components`, `Vanilla Bell Mount and Views`, `Angular Bell Popover and Items`, `SSE Stream Transport`, `Store Test Harness`, `Vue Bell Token and Store Wiring`, `Angular Bell Controller`, `Client API Wire Types`, `HTTP Transport and Failure Backoff`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._