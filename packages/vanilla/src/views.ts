import { formatRelativeTime, type InboxItem, safeUrl } from '@last-notifications-widgets/client'
import { Archive, ArchiveRestore, ExternalLink, TriangleAlert } from 'lucide'

import * as C from './classes'
import { cn } from './cn'
import { h, icon } from './dom'

// Longest a click waits for the mark-read before it navigates anyway.
const OPEN_WAIT_MS = 1_000
const ROW_BODY =
  'flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2.5 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-3'
const ACTION_BUTTON =
  'me-1 shrink-0 pointer-coarse:size-11 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:group-focus-within:opacity-100'

const SKELETON = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'
const EMPTY =
  'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance'
const EMPTY_ICON =
  "mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export function row(
  item: InboxItem,
  options: { action: 'archive' | 'restore'; onOpen?: () => Promise<unknown>; onAction: () => void },
): HTMLElement {
  const href = safeUrl(item.data.url)
  const unread = item.readAt === null
  const content = h(
    'span',
    { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
    h(
      'span',
      { class: 'flex items-center gap-2' },
      unread &&
        h('span', { 'aria-hidden': 'true', class: 'size-1.5 shrink-0 rounded-full bg-(--ln-unread-indicator)' }),
      h('span', { class: cn('truncate text-sm', unread && 'font-medium') }, item.title),
      href && icon(ExternalLink, 'size-3.5 shrink-0 text-muted-foreground'),
    ),
    item.body && h('span', { class: 'line-clamp-2 text-sm text-muted-foreground' }, item.body),
    h('time', { datetime: item.createdAt, class: 'text-xs text-muted-foreground' }, formatRelativeTime(item.createdAt)),
  )
  const onOpen = options.onOpen
  const key = `open:${item.id}`
  const body = href
    ? h(
        'a',
        {
          href,
          class: ROW_BODY,
          'data-ln-key': key,
          onClick: onOpen ? (event: Event) => openLink(event as MouseEvent, href, onOpen) : undefined,
        },
        content,
      )
    : onOpen
      ? h('button', { type: 'button', class: ROW_BODY, 'data-ln-key': key, onClick: () => void onOpen() }, content)
      : h('div', { class: ROW_BODY }, content)
  return h(
    'li',
    {
      class: cn(
        'ln-item group relative flex items-center gap-1 rounded-lg motion-safe:transition-colors hover:bg-muted focus-within:bg-muted',
        unread && 'ln-unread',
      ),
    },
    body,
    h(
      'button',
      {
        type: 'button',
        'aria-label': `${options.action === 'archive' ? 'Archive' : 'Restore'} ${item.title}`,
        class: cn(C.ICON_BUTTON, ACTION_BUTTON),
        'data-ln-key': `${options.action}:${item.id}`,
        onClick: options.onAction,
      },
      icon(options.action === 'archive' ? Archive : ArchiveRestore, 'size-4'),
    ),
  )
}

export function skeletons(): HTMLElement {
  return h(
    'div',
    { role: 'status', class: 'flex flex-col gap-0.5 p-1' },
    h('span', { class: 'sr-only' }, 'Loading notifications'),
    ...['w-3/5', 'w-4/5', 'w-2/3'].map((width) =>
      h(
        'div',
        { class: 'flex items-center gap-1' },
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5' },
          h('div', { class: cn(SKELETON, 'my-[3px] h-3.5', width) }),
          h('div', { class: cn(SKELETON, 'my-0.5 h-3 w-16') }),
        ),
        h('div', { class: 'me-1 size-8 shrink-0' }),
      ),
    ),
  )
}

export function empty(node: Parameters<typeof icon>[0], title: string, description: string): HTMLElement {
  return h(
    'div',
    { class: EMPTY },
    h(
      'div',
      { class: 'flex max-w-sm flex-col items-center gap-2' },
      h('div', { class: EMPTY_ICON }, icon(node, 'size-4')),
      h('div', { class: 'font-heading text-sm font-medium tracking-tight' }, title),
      h('div', { class: 'text-sm/relaxed text-muted-foreground' }, description),
    ),
  )
}

export function errorBlock(message: string, retryable: boolean, onRetry: () => void): HTMLElement {
  return h(
    'div',
    { role: 'alert', 'data-ln-error': '', class: 'flex flex-col items-start gap-2 p-4 text-sm' },
    h('p', { class: 'flex items-center gap-2 text-destructive' }, icon(TriangleAlert, 'size-4 shrink-0'), message),
    retryable
      ? h(
          'button',
          {
            type: 'button',
            class: cn(C.OUTLINE_BUTTON_SMALL, 'pointer-coarse:min-h-11'),
            'data-ln-key': 'retry',
            onClick: onRetry,
          },
          'Try again',
        )
      : null,
  )
}

function openLink(event: MouseEvent, href: string, open: () => Promise<unknown>) {
  // Modified clicks (new tab, new window) keep the browser's behaviour; a plain click marks read, then follows.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
  event.preventDefault()
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, OPEN_WAIT_MS))
  void Promise.race([open(), timeout]).finally(() => window.location.assign(href))
}
