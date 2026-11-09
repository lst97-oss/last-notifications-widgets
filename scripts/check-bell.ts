// Browser check for the bell. Serves the built harness and a stub recipient API, then drives
// Chrome: badge, popover, mark read, live stream arrival, theme variables, session isolation.
import { HttpStatus } from '@lst97-oss/last-httprism'
import { chromium, type Page } from 'playwright-core'

const ROOT = `${import.meta.dir}/..`
// One run per framework: `bun scripts/check-bell.ts vue`. Each run bundles its own fixture and serves its own sheet,
// so the scenarios below run unchanged against every port.
const framework = process.argv[2] ?? 'react'
const FIXTURES: Record<string, string> = {
  react: `${ROOT}/scripts/fixtures/bell-page.tsx`,
  vue: `${ROOT}/packages/vue/test/bell-page.ts`,
  vanilla: `${ROOT}/packages/vanilla/test/bell-page.ts`,
  angular: `${ROOT}/packages/angular/test/bell-page.ts`,
}
const fixture = FIXTURES[framework]
if (!fixture) throw new Error(`unknown framework "${framework}", expected one of ${Object.keys(FIXTURES).join(', ')}`)
const BUNDLE_DIR = `${ROOT}/.tmp/bell/${framework}`
const STYLES = `${ROOT}/packages/${framework}/dist/styles.css`
console.log(`bell browser check: ${framework}`)
const failures: string[] = []
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

// The harness is bundled with tsup (esbuild), the same toolchain as the package. Bun's bundler breaks
// Base UI's popover, so a Bun-built page would report a false failure.
const built = Bun.spawn(
  [
    'bunx',
    'tsup',
    fixture,
    '--format',
    'iife',
    '--platform',
    'browser',
    '--no-dts',
    // Vue and React read process.env.NODE_ENV; a browser bundle has no process, so set it at build time.
    '--env.NODE_ENV',
    'production',
    '--out-dir',
    BUNDLE_DIR,
  ],
  // The bundler comes from the React package, which pins tsup; the fixture's own imports resolve from its folder.
  { cwd: `${ROOT}/packages/react`, stdout: 'pipe', stderr: 'pipe' },
)
if ((await built.exited) !== 0) {
  console.error(await new Response(built.stderr).text())
  process.exit(1)
}

type Item = {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  priority: number
  readAt: string | null
  archivedAt: string | null
  createdAt: string
}
const at = '2026-10-29T10:00:00.000Z'
const item = (id: string, title: string, readAt: string | null = null, data: Record<string, unknown> = {}): Item => ({
  id,
  type: 'notice',
  title,
  body: '',
  data,
  priority: 0,
  readAt,
  archivedAt: null,
  createdAt: at,
})

const many = Array.from({ length: 25 }, (_, index) => item(`m${index + 1}`, `Item ${index + 1}`))
const sessions = new Map([
  [
    'user-a',
    {
      token: 'lrt_a',
      latest: 'cur-a1',
      items: [item('a1', 'Second'), item('a2', 'First', at, { url: '/orders/7' })],
      archived: [] as Item[],
    },
  ],
  [
    'user-b',
    {
      token: 'lrt_b',
      latest: 'cur-b1',
      items: [item('b1', 'Bob note'), item('b2', 'Open order', null, { url: '/orders/9' })],
      archived: [] as Item[],
    },
  ],
  ['user-c', { token: 'lrt_c', latest: 'cur-m1', items: many, archived: [] as Item[] }],
  // Twenty unread rows fill the first page; the two read rows sit past it.
  [
    'user-d',
    {
      token: 'lrt_d',
      latest: 'cur-d1',
      items: [
        ...Array.from({ length: 20 }, (_, index) => item(`u${index + 1}`, `Unread ${index + 1}`)),
        item('r1', 'Read newer', at),
        item('r2', 'Read oldest', at),
      ],
      archived: [] as Item[],
    },
  ],
])

// The checks flip these to make the stub answer 500, as a notification server does during an outage.
const outage = { token: false, list: false }
const serverError = () =>
  Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } },
    { status: HttpStatus.INTERNAL_SERVER_ERROR.code },
  )
const reads: unknown[] = []
const archives: { ids?: string[]; read?: boolean }[] = []
const restores: { ids: string[] }[] = []
const requestedViews: string[] = []
const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>()
const openedStreamUrls: string[] = []
const encoder = new TextEncoder()
const bearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer /, '') ?? null
const sessionFor = (token: string | null) => [...sessions.values()].find((session) => session.token === token)
const denied = () =>
  Response.json(
    { error: { code: 'INVALID_RECIPIENT_TOKEN', message: 'Recipient token is invalid or expired' } },
    { status: HttpStatus.UNAUTHORIZED.code },
  )
const ok = (data: unknown) => Response.json({ data }, { status: HttpStatus.OK.code })

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"></head>
<body><div id="root"></div><script src="/bell.js"></script></body></html>`

// The API answers CORS like the real server: a cross-origin mark-read needs a preflight first.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: HttpStatus.NO_CONTENT.code, headers: CORS })
  const response = await route(request)
  for (const [name, value] of Object.entries(CORS)) response.headers.set(name, value)
  return response
}

const route = async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  if (url.pathname === '/') return new Response(PAGE, { headers: { 'content-type': 'text/html' } })
  if (url.pathname === '/bell.js')
    return new Response(Bun.file(`${BUNDLE_DIR}/bell-page.global.js`), {
      headers: { 'content-type': 'text/javascript' },
    })
  if (url.pathname === '/styles.css') {
    return new Response(Bun.file(STYLES), {
      headers: { 'content-type': 'text/css' },
    })
  }
  if (url.pathname === '/api/notifications-token') {
    if (outage.token) return serverError()
    return Response.json({ token: sessions.get(url.searchParams.get('session') ?? '')?.token ?? null })
  }
  if (url.pathname === '/api/v1/apps/app-1/inbox' && request.method === 'GET') {
    if (outage.list) return serverError()
    const session = sessionFor(bearer(request))
    if (!session) return denied()
    const archivedView = url.searchParams.get('view') === 'archived'
    const list = archivedView ? session.archived : session.items
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const before = url.searchParams.get('before')
    const start = before ? Number(before.replace('c', '')) : 0
    const unread = session.items.filter((row) => row.readAt === null).length
    requestedViews.push(archivedView ? 'archived' : 'inbox')
    return ok({
      items: list.slice(start, start + limit),
      next: start + limit < list.length ? `c${start + limit}` : null,
      total: session.items.length,
      unread,
      latest: session.latest,
    })
  }
  if (url.pathname === '/api/v1/apps/app-1/inbox/archive' && request.method === 'POST') {
    const session = sessionFor(bearer(request))
    if (!session) return denied()
    const body = (await request.json()) as { ids?: string[]; read?: boolean }
    archives.push(body)
    const picked = session.items.filter((row) => (body.read ? row.readAt !== null : body.ids?.includes(row.id)))
    for (const row of picked) session.archived.unshift({ ...row, readAt: row.readAt ?? at, archivedAt: at })
    session.items = session.items.filter((row) => !picked.includes(row))
    return ok({ archived: picked.length })
  }
  if (url.pathname === '/api/v1/apps/app-1/inbox/restore' && request.method === 'POST') {
    const session = sessionFor(bearer(request))
    if (!session) return denied()
    const body = (await request.json()) as { ids: string[] }
    restores.push(body)
    const picked = session.archived.filter((row) => body.ids.includes(row.id))
    session.items = [...picked.map((row) => ({ ...row, archivedAt: null })), ...session.items]
    session.archived = session.archived.filter((row) => !picked.includes(row))
    return ok({ restored: picked.length })
  }
  if (url.pathname === '/api/v1/apps/app-1/inbox/read' && request.method === 'POST') {
    if (!sessionFor(bearer(request))) return denied()
    reads.push(await request.json())
    return ok({ updated: 1 })
  }
  if (url.pathname === '/api/v1/apps/app-1/stream') {
    const token = bearer(request) ?? ''
    if (!sessionFor(token)) return denied()
    openedStreamUrls.push(request.url)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streams.set(token, controller)
      },
    })
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
  }
  if (url.pathname === '/__push' && request.method === 'POST') {
    const { token, cursor, notification } = (await request.json()) as {
      token: string
      cursor: string
      notification: Item
    }
    streams
      .get(token)
      ?.enqueue(encoder.encode(`event: notification\ndata: ${JSON.stringify(notification)}\nid: ${cursor}\n\n`))
    return ok({ pushed: true })
  }
  return new Response('not found', { status: HttpStatus.NOT_FOUND.code })
}

// Pages and API run on separate origins, as a real host and the notifications server do.
const api = Bun.serve({ port: 0, fetch: handle })
const pages = Bun.serve({ port: 0, fetch: handle })
const base = `http://127.0.0.1:${pages.port}`
const apiBase = `http://127.0.0.1:${api.port}`
const until = async (condition: () => boolean, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the bell')
    await Bun.sleep(25)
  }
}

// CI passes the Chrome for Testing binary that its setup step installed; locally the installed Chrome is used.
const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' as const }
const browser = await chromium.launch({ ...launch, headless: true })
try {
  const page: Page = await browser.newPage()
  page.on('pageerror', (error) => {
    console.log(`PAGE ERROR: ${error.message}`)
    failures.push('page error')
  })
  const setSession = (value: string | null) =>
    page.evaluate(
      (next) => (window as unknown as { __setSession: (session: string | null) => void }).__setSession(next),
      value,
    )
  const openPopover = async () => {
    if ((await page.locator('.ln-popup').count()) === 0) await page.locator('.ln-trigger').click()
    await page.locator('.ln-popup').waitFor()
  }

  await page.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-a`)
  const badge = page.locator('.ln-badge')
  await badge.waitFor()
  check('badge shows the unread count', (await badge.textContent()) === '1')
  await until(() => streams.has('lrt_a'))
  check(
    'stream resumes from the list cursor',
    openedStreamUrls.some((url) => url.includes('lastEventId=cur-a1')),
  )

  await openPopover()
  check('popover lists newest first', (await page.locator('.ln-item').count()) === 2)
  const headerText = await page.locator('[data-slot="popover-title"]').textContent()
  check('the header shows the notification total', headerText?.endsWith('2') === true, headerText ?? '')

  await page.locator('.ln-item').filter({ hasText: 'Second' }).locator('button').first().click()
  await page.waitForFunction(() => document.querySelector('.ln-badge') === null)
  check(
    'clicking an unread row marks it read',
    JSON.stringify(reads.at(-1)) === JSON.stringify({ ids: ['a1'] }),
    JSON.stringify(reads.at(-1)),
  )

  await fetch(`${apiBase}/__push`, {
    method: 'POST',
    body: JSON.stringify({ token: 'lrt_a', cursor: 'cur-a3', notification: item('a3', 'Live') }),
  })
  await badge.waitFor()
  check('a live arrival raises the badge', (await badge.textContent()) === '1')
  const announced = (await page.locator('[role="status"]').textContent()) ?? ''
  check('a live arrival is announced', announced.includes('New notification: Live'), announced)

  const color = await badge.evaluate((element) => getComputedStyle(element).backgroundColor)
  check('themeVars recolour the badge', color === 'rgb(0, 128, 0)', color)

  await setSession('user-b')
  await openPopover()
  await page.getByText('Bob note').waitFor()
  const texts = (await page.locator('.ln-item').allTextContents()).join(' | ')
  check(
    'a session change shows only the new user’s rows',
    texts.includes('Bob note') && !texts.includes('Second') && !texts.includes('Live'),
    texts,
  )

  await setSession(null)
  await page.waitForFunction(() => document.querySelector('.ln-bell') === null)
  check('a signed-out session renders nothing', true)

  await page.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-z`)
  await Bun.sleep(400)
  check('an anonymous visitor renders nothing', (await page.locator('.ln-bell').count()) === 0)

  // A notification server that answers 500 keeps the bell on screen with a warning. It never hides the bell.
  const hostErrors = () =>
    page.evaluate(() => (window as unknown as { __errors: { source: string; code: string }[] }).__errors)
  outage.token = true
  await page.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-a`)
  await page.locator('[data-ln-error-icon]').waitFor()
  check('a token 500 keeps the bell on screen', (await page.locator('.ln-trigger').count()) === 1)
  check('a token 500 shows the warning triangle', (await page.locator('[data-ln-error-icon]').count()) === 1)
  // The triangle is an SVG drawn in currentColor, so the colour is read from the SVG itself.
  const triangleColor = await page
    .locator('[data-ln-error-icon] svg')
    .evaluate((element) => getComputedStyle(element).color)
  check('themeVars.destructive colours the warning', triangleColor === 'rgb(0, 128, 0)', triangleColor)
  const failedLabel = await page.locator('.ln-trigger').getAttribute('aria-label')
  check('the failed bell is labelled as such', failedLabel === "Notifications, couldn't load", failedLabel ?? '')
  const failedAnnouncement = (await page.locator('[role="status"]').textContent()) ?? ''
  check('the failure is announced', failedAnnouncement.includes("couldn't load"), failedAnnouncement)
  const tokenErrors = await hostErrors()
  check(
    'the host hears the token failure',
    tokenErrors.some((error) => error.source === 'token'),
    JSON.stringify(tokenErrors),
  )

  await openPopover()
  const general = (await page.locator('[data-ln-error]').textContent()) ?? ''
  check('the popup shows one general message', general.includes("Couldn't load notifications."), general)
  outage.token = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.locator('.ln-item').first().waitFor()
  check('Try again recovers the list', (await page.locator('.ln-item').count()) > 0)
  check('the warning clears once the list loads', (await page.locator('[data-ln-error-icon]').count()) === 0)

  outage.list = true
  await page.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-a`)
  await page.locator('[data-ln-error-icon]').waitFor()
  check('a list 500 shows the warning triangle', (await page.locator('[data-ln-error-icon]').count()) === 1)
  const listErrors = await hostErrors()
  check(
    'the host hears the list failure with the server code',
    listErrors.some((error) => error.source === 'inbox' && error.code === 'INTERNAL_ERROR'),
    JSON.stringify(listErrors),
  )
  outage.list = false

  // A host that cannot mount the live bell yet renders the same failed bell, and its retry reaches the host.
  await page.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-a&unavailable=1`)
  await page.locator('[data-ln-error-icon]').waitFor()
  check(
    'the unavailable bell shows the same warning triangle',
    (await page.locator('[data-ln-error-icon]').count()) === 1,
  )
  await page.locator('.ln-trigger').click()
  await page.locator('[data-ln-error]').waitFor()
  await page.getByRole('button', { name: 'Try again' }).click()
  const retried = await page.locator('body').getAttribute('data-retried')
  check('Try again on the unavailable bell calls the host onRetry', retried === '1', retried ?? '')

  // A row with a link navigates away on click; its mark-read must still reach the server.
  const linked = await browser.newPage()
  await linked.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-b`)
  await linked.locator('.ln-badge').waitFor()
  await linked.locator('.ln-trigger').click()
  await linked.getByRole('link', { name: /Open order/ }).click()
  let marked = true
  try {
    await until(() => reads.some((read) => JSON.stringify(read) === JSON.stringify({ ids: ['b2'] })))
  } catch {
    marked = false
  }
  check('a link row is marked read before the page navigates', marked, JSON.stringify(reads.at(-1)))
  let navigated = true
  try {
    await linked.waitForURL('**/orders/9', { timeout: 5_000 })
  } catch {
    navigated = false
  }
  check('the link then opens its page', navigated, linked.url())

  // Archive from a row, then open the archive: its list is requested only at that point.
  const archiving = await browser.newPage()
  const streamsBefore = openedStreamUrls.length
  await archiving.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-a`)
  await archiving.locator('.ln-badge').waitFor()
  await until(() => openedStreamUrls.length > streamsBefore)
  const archiveCallsBefore = requestedViews.filter((view) => view === 'archived').length
  await archiving.locator('.ln-trigger').click()
  await archiving.locator('.ln-popup').waitFor()
  const archivedCount = archives.length
  await archiving.getByRole('button', { name: 'Archive First' }).click()
  await until(() => archives.length > archivedCount)
  check(
    'archiving a row posts its id',
    JSON.stringify(archives.at(-1)) === JSON.stringify({ ids: ['a2'] }),
    JSON.stringify(archives.at(-1)),
  )
  // A live arrival after an action is still announced: the action's message must not hide it.
  await fetch(`${apiBase}/__push`, {
    method: 'POST',
    body: JSON.stringify({ token: 'lrt_a', cursor: 'cur-a4', notification: item('a4', 'Later') }),
  })
  const announcedAfterAction = await archiving
    .waitForFunction(
      () => document.querySelector('[role="status"]')?.textContent?.includes('New notification: Later') === true,
      undefined,
      { timeout: 5_000 },
    )
    .then(
      () => true,
      () => false,
    )
  check('a live arrival after an archive is still announced', announcedAfterAction)
  check(
    'the archive list is not requested until it is opened',
    requestedViews.filter((view) => view === 'archived').length === archiveCallsBefore,
  )
  await archiving.getByRole('button', { name: 'Open archive' }).click()
  await archiving.getByRole('heading', { name: 'Archived' }).waitFor()
  check(
    'opening the archive moves focus to its heading',
    await archiving.evaluate(() => document.activeElement?.textContent === 'Archived'),
  )
  check(
    'the archive keeps its Back control',
    (await archiving.getByRole('button', { name: 'Back to notifications' }).count()) === 1,
  )
  await archiving.locator('.ln-popup li', { hasText: 'First' }).waitFor()
  check(
    'the archive lists the archived row',
    (await archiving.locator('.ln-popup li', { hasText: 'First' }).count()) === 1,
  )

  // Restore it again from the archive view.
  const restoredBefore = restores.length
  await archiving.getByRole('button', { name: 'Restore First' }).click()
  await until(() => restores.length > restoredBefore)
  check('restoring posts the archived id', JSON.stringify(restores.at(-1)) === JSON.stringify({ ids: ['a2'] }))
  await archiving.getByRole('button', { name: 'Back to notifications' }).click()
  await archiving.locator('.ln-item').filter({ hasText: 'First' }).waitFor()
  check(
    'restore brings the row back to the inbox',
    (await archiving.locator('.ln-item').filter({ hasText: 'First' }).count()) === 1,
  )

  // Archive all read from the overflow menu.
  const readBefore = archives.length
  await archiving.getByRole('button', { name: 'Mark all as read' }).click()
  await archiving.getByRole('button', { name: 'More actions' }).click()
  await archiving.getByRole('menuitem', { name: 'Archive all read' }).click()
  await until(() => archives.length > readBefore)
  check('archive all read posts the read flag', JSON.stringify(archives.at(-1)) === JSON.stringify({ read: true }))
  await archiving.close()

  // "Archive all read" stays available when the read rows are past the first page.
  const menu = await browser.newPage()
  await menu.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-d`)
  await menu.locator('.ln-badge').waitFor()
  await menu.locator('.ln-trigger').click()
  await menu.locator('.ln-popup').waitFor()
  await menu.getByRole('button', { name: 'More actions' }).click()
  const archiveRead = menu.getByRole('menuitem', { name: 'Archive all read' })
  await archiveRead.waitFor()
  check('archive all read is on when read rows sit past the first page', !(await archiveRead.isDisabled()))
  await menu.close()

  // The host switches user while "Archive all read" is still waiting on the server. The late answer must not bring
  // the old user's bell back, nor announce its message into the new user's session.
  const switching = await browser.newPage()
  let archiveHeld = 0
  let releaseArchive!: () => void
  const archiveGate = new Promise<void>((resolve) => {
    releaseArchive = resolve
  })
  await switching.route(/\/inbox\/archive/, async (route) => {
    archiveHeld += 1
    await archiveGate
    await route.continue()
  })
  await switching.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-d`)
  await switching.locator('.ln-badge').waitFor()
  await switching.locator('.ln-trigger').click()
  await switching.locator('.ln-popup').waitFor()
  await switching.getByRole('button', { name: 'More actions' }).click()
  await switching.getByRole('menuitem', { name: 'Archive all read' }).click()
  await until(() => archiveHeld === 1)
  await switching.evaluate(
    (next) => (window as unknown as { __setSession: (session: string) => void }).__setSession(next),
    'user-b',
  )
  await switching.waitForFunction(() => document.querySelector('.ln-badge')?.textContent === '2')
  const archivedBeforeRelease = archives.length
  releaseArchive()
  await until(() => archives.length > archivedBeforeRelease)
  await Bun.sleep(300)
  check('a late answer does not bring the old bell back', (await switching.locator('.ln-bell').count()) === 1)
  const badges = (await switching.locator('.ln-badge').allTextContents()).join(' ')
  check('the bell shows only the new user’s count', badges === '2', badges)
  const live = (await switching.locator('[role="status"]').allTextContents()).join(' | ')
  check('a late answer is not announced into the new session', !live.includes('Archived read notifications'), live)
  await switching.close()

  // Paging: 25 unread items show 20, "Load more" adds the rest with no repeats.
  const paging = await browser.newPage()
  await paging.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-c`)
  await paging.locator('.ln-badge').waitFor()
  await paging.locator('.ln-trigger').click()
  await paging.locator('.ln-popup').waitFor()
  await paging.locator('.ln-item').nth(19).waitFor()
  check('the first page shows 20 rows', (await paging.locator('.ln-item').count()) === 20)
  const pagingTitle = await paging.locator('[data-slot="popover-title"]').textContent()
  check('the header shows all 25 rows, not the 20 loaded', pagingTitle?.endsWith('25') === true, pagingTitle ?? '')
  await paging.getByRole('button', { name: 'Load more' }).click()
  await paging.locator('.ln-item').nth(24).waitFor()
  const titles = await paging.locator('.ln-item').allTextContents()
  check(
    'load more adds the rest without repeats',
    titles.length === 25 && new Set(titles).size === 25,
    `${titles.length} rows`,
  )
  await paging.close()

  // Scrolling to the end loads the rest without a click: the sentinel above "Load more" is watched.
  const scrolling = await browser.newPage()
  await scrolling.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-c`)
  await scrolling.locator('.ln-badge').waitFor()
  await scrolling.locator('.ln-trigger').click()
  await scrolling.locator('.ln-popup').waitFor()
  await scrolling.locator('.ln-item').nth(19).waitFor()
  await scrolling
    .locator('.ln-item')
    .nth(19)
    .evaluate((row) => {
      const scroller = row.closest('.overflow-y-auto')
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    })
  const loadedByScroll = await scrolling
    .locator('.ln-item')
    .nth(24)
    .waitFor({ timeout: 5_000 })
    .then(
      () => true,
      () => false,
    )
  check(
    'scrolling to the end loads the rest by itself',
    loadedByScroll && (await scrolling.locator('.ln-item').count()) === 25,
  )
  await scrolling.close()

  // An open list keeps its place. Loading the next page, and a live arrival, must not jump it back to the top.
  const place = await browser.newPage()
  const streamsBeforePlace = openedStreamUrls.length
  await place.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-c`)
  await place.locator('.ln-badge').waitFor()
  await until(() => openedStreamUrls.length > streamsBeforePlace)
  await place.locator('.ln-trigger').click()
  await place.locator('.ln-popup').waitFor()
  await place.locator('.ln-item').nth(19).waitFor()
  const scrolledTo = await place
    .locator('.ln-item')
    .nth(19)
    .evaluate((row) => {
      const scroller = row.closest('.overflow-y-auto')
      if (!scroller) return -1
      scroller.scrollTop = scroller.scrollHeight
      return scroller.scrollTop
    })
  await place.locator('.ln-item').nth(24).waitFor()
  await Bun.sleep(300)
  const scrollOf = () => place.evaluate(() => document.querySelector('.ln-popup .overflow-y-auto')?.scrollTop ?? -1)
  const afterPage = await scrollOf()
  check(
    'loading the next page keeps the scroll position',
    scrolledTo > 0 && Math.abs(afterPage - scrolledTo) <= 2,
    `${scrolledTo} -> ${afterPage}`,
  )
  await fetch(`${apiBase}/__push`, {
    method: 'POST',
    body: JSON.stringify({ token: 'lrt_c', cursor: 'cur-place', notification: item('place1', 'Placed') }),
  })
  await place.waitForFunction(
    () =>
      [...document.querySelectorAll('[role="status"]')].some((el) =>
        el.textContent?.includes('New notification: Placed'),
      ),
    undefined,
    { timeout: 5_000 },
  )
  await Bun.sleep(300)
  const afterArrival = await scrollOf()
  // A new row above the view moves the list down by one row, so the position may grow; it must never go back up.
  check(
    'a live arrival does not jump the list up',
    scrolledTo > 0 && afterArrival >= scrolledTo - 2,
    `${scrolledTo} -> ${afterArrival}`,
  )
  await place.close()

  // A page that fails while the end of the list is still on screen is asked for once, not again by the bell itself.
  // Only "Try again" asks again. The first page is cut to three rows, so the end is on screen straight away.
  const loop = await browser.newPage()
  let pageTwoRequests = 0
  await loop.route(/\/inbox\?/, async (route) => {
    if (!route.request().url().includes('before=')) {
      const real = await route.fetch()
      const json = (await real.json()) as { data: { items: unknown[]; next: string | null } }
      json.data.items = json.data.items.slice(0, 3)
      json.data.next = 'c3'
      return route.fulfill({ response: real, json })
    }
    pageTwoRequests += 1
    return route.fulfill({
      status: HttpStatus.SERVICE_UNAVAILABLE.code,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }),
    })
  })
  await loop.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-c`)
  await loop.locator('.ln-badge').waitFor()
  await loop.locator('.ln-trigger').click()
  await loop.locator('.ln-popup').waitFor()
  await loop.getByRole('button', { name: "Couldn't load more" }).waitFor()
  await Bun.sleep(1_500)
  check('a failed page is not asked for again by itself', pageTwoRequests <= 2, `${pageTwoRequests} requests`)
  const askedBeforeRetry = pageTwoRequests
  await loop.getByRole('button', { name: "Couldn't load more" }).click()
  await until(() => pageTwoRequests > askedBeforeRetry)
  check('Try again asks for the page again', pageTwoRequests > askedBeforeRetry)
  await loop.close()

  // Small screens: the popup fits the viewport and the actions are touch-sized.
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  })
  const phone = await mobile.newPage()
  await phone.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-c`)
  await phone.locator('.ln-badge').waitFor()
  await phone.locator('.ln-trigger').tap()
  await phone.locator('.ln-popup').waitFor()
  const box = await phone.locator('.ln-popup').boundingBox()
  check('the popup fits a 375px screen', box !== null && box.x >= 0 && box.x + box.width <= 375, JSON.stringify(box))
  // The popup zooms in when it opens; measure once the animation has settled.
  await Bun.sleep(400)
  const action = await phone.getByRole('button', { name: 'Archive Item 1', exact: true }).boundingBox()
  check(
    'row actions are at least 44px on touch',
    action !== null && action.width >= 44 && action.height >= 44,
    JSON.stringify(action),
  )
  await phone.screenshot({ path: `${ROOT}/.tmp/bell-mobile.png` })
  await mobile.close()

  // The first page is held, so the popover shows its skeleton. The skeleton is labelled and its rows keep the list pitch.
  const held = await browser.newPage()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await held.route(/\/inbox\?/, async (route) => {
    await gate
    await route.continue()
  })
  await held.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-c`)
  await held.locator('.ln-trigger').click()
  const skeletonRows = held.locator('.ln-popup [role="status"] > div')
  await skeletonRows.nth(1).waitFor()
  // The popup zooms in when it opens; measure once the animation has settled.
  await Bun.sleep(400)
  const skeletonLabel = await held.locator('.ln-popup [role="status"]').textContent()
  check(
    'the popover labels its skeleton',
    skeletonLabel?.includes('Loading notifications') === true,
    skeletonLabel ?? '',
  )
  check('no real rows show while loading', (await held.locator('.ln-item').count()) === 0)
  check(
    'the bell shows a placeholder, not a zero count, while loading',
    (await held.locator('.ln-trigger [data-ln-placeholder]').count()) === 1 &&
      (await held.locator('.ln-badge').count()) === 0,
  )
  check(
    'the header shows a placeholder for its count while loading',
    (await held.locator('[data-slot="popover-title"] [data-ln-placeholder]').count()) === 1,
  )
  await held.locator('.ln-popup').screenshot({ path: `${ROOT}/.tmp/bell-skeleton.png` })
  const trigger = (await held.locator('.ln-trigger').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
  await held.screenshot({
    path: `${ROOT}/.tmp/bell-icon-loading.png`,
    clip: { x: trigger.x - 8, y: trigger.y - 8, width: trigger.width + 16, height: trigger.height + 16 },
  })
  const skeletonFirst = await skeletonRows.nth(0).boundingBox()
  const skeletonSecond = await skeletonRows.nth(1).boundingBox()
  release()
  await held.locator('.ln-item').nth(1).waitFor()
  check(
    'the real count replaces both placeholders',
    (await held.locator('[data-ln-placeholder]').count()) === 0 &&
      (await held.locator('.ln-badge').textContent()) === '25' &&
      ((await held.locator('[data-slot="popover-title"]').textContent()) ?? '').endsWith('25'),
  )
  const first = await held.locator('.ln-item').nth(0).boundingBox()
  const second = await held.locator('.ln-item').nth(1).boundingBox()
  const skeletonPitch = (skeletonSecond?.y ?? 0) - (skeletonFirst?.y ?? 0)
  const rowPitch = (second?.y ?? 0) - (first?.y ?? 0)
  check(
    'skeleton rows keep the list pitch',
    Math.abs(skeletonPitch - rowPitch) <= 1,
    `skeleton ${skeletonPitch}px, rows ${rowPitch}px`,
  )
  await held.close()

  // Desktop screenshot for review.
  const desktop = await browser.newPage()
  await desktop.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-c`)
  await desktop.locator('.ln-badge').waitFor()
  await desktop.locator('.ln-trigger').click()
  await desktop.locator('.ln-popup').waitFor()
  // Let the open animation settle so the capture shows the final colours.
  await Bun.sleep(400)
  await desktop.screenshot({ path: `${ROOT}/.tmp/bell-desktop.png` })
  await desktop.close()

  // The host sets light or dark; an open bell restyles without a reload (the admin sidebar toggle does this).
  const setHostTheme = (value: 'light' | 'dark') =>
    page.evaluate((next) => (window as unknown as { __setTheme: (theme: string) => void }).__setTheme(next), value)
  const popupColor = () => page.locator('.ln-popup').evaluate((element) => getComputedStyle(element).backgroundColor)
  // Lightness of an oklch()/oklab() colour: 1 is white, near 0.2 is the dark popover token.
  const lightness = (color: string) => Number(/^ok(?:lab|lch)\(([\d.]+)/.exec(color)?.[1] ?? Number.NaN)
  // Colours transition for a moment after a switch, so read them once the animation has settled.
  await page.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-a&theme=light`)
  await page.locator('.ln-badge').waitFor()
  await openPopover()
  await Bun.sleep(400)
  const lightPopup = await popupColor()
  check('theme=light renders a light popup', lightness(lightPopup) > 0.9, lightPopup)
  await setHostTheme('dark')
  await page.locator('.ln-bell.dark').waitFor()
  await Bun.sleep(400)
  const darkPopup = await popupColor()
  const scheme = await page.locator('.ln-bell').evaluate((element) => getComputedStyle(element).colorScheme)
  check(
    'switching to dark restyles the open popup',
    lightness(darkPopup) < 0.5 && scheme === 'dark',
    `${lightPopup} -> ${darkPopup}, color-scheme ${scheme}`,
  )
  await page.screenshot({ path: `${ROOT}/.tmp/bell-dark.png` })
  await setHostTheme('light')
  await page.waitForFunction(() => document.querySelector('.ln-bell.dark') === null)
  await Bun.sleep(400)
  check('switching back to light restores a light popup', lightness(await popupColor()) > 0.9)

  await page.goto(`${base}/?api=${encodeURIComponent(apiBase)}&session=user-a&theme=dark`)
  await page.locator('.ln-bell.dark').waitFor()
  const loadScheme = await page.locator('.ln-bell').evaluate((element) => getComputedStyle(element).colorScheme)
  check('theme=dark on load applies the dark scope', loadScheme === 'dark', loadScheme)
} finally {
  await browser.close()
  api.stop(true)
  pages.stop(true)
}

if (failures.length > 0) {
  console.error(`${failures.length} bell check(s) failed`)
  process.exit(1)
}
console.log('all bell checks passed')
