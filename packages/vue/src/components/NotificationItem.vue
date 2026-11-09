<script setup lang="ts">
import { formatRelativeTime, type InboxItem, safeUrl } from '@last-notifications-widgets/client'
import { Archive, ArchiveRestore, ExternalLink } from '@lucide/vue'
import { computed } from 'vue'
import { ICON_BUTTON } from '../lib/classes'
import { cn } from '../lib/cn'

// Longest a click waits for the mark-read before it navigates anyway.
const OPEN_WAIT_MS = 1_000

const props = defineProps<{
  item: InboxItem
  action: 'archive' | 'restore'
  onOpen?: () => Promise<void>
  onAction: () => void
}>()

const href = computed(() => safeUrl(props.item.data.url))
const unread = computed(() => props.item.readAt === null)
const rowTag = computed(() => (href.value ? 'a' : props.onOpen ? 'button' : 'div'))

// Modified clicks (new tab, new window) keep the browser's behaviour; a plain click marks read, then follows.
function handleOpen(event: MouseEvent) {
  const open = props.onOpen
  if (!open) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
  event.preventDefault()
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, OPEN_WAIT_MS))
  void Promise.race([open(), timeout]).finally(() => window.location.assign(href.value ?? '/'))
}

function onRowClick(event: MouseEvent) {
  if (!props.onOpen) return
  if (!href.value) {
    void props.onOpen()
    return
  }
  handleOpen(event)
}

const ROW_BODY =
  'flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2.5 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:py-3'
</script>

<template>
  <li
    :class="
      cn(
        'ln-item group relative flex items-center gap-1 rounded-lg motion-safe:transition-colors hover:bg-muted focus-within:bg-muted',
        unread && 'ln-unread',
      )
    "
  >
    <component
      :is="rowTag"
      :href="href ?? undefined"
      :type="rowTag === 'button' ? 'button' : undefined"
      :class="ROW_BODY"
      @click="onRowClick"
    >
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="flex items-center gap-2">
          <span v-if="unread" aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-(--ln-unread-indicator)" />
          <span :class="cn('truncate text-sm', unread && 'font-medium')">{{ item.title }}</span>
          <ExternalLink v-if="href" aria-hidden="true" class="size-3.5 shrink-0 text-muted-foreground" />
        </span>
        <span v-if="item.body" class="line-clamp-2 text-sm text-muted-foreground">{{ item.body }}</span>
        <time :datetime="item.createdAt" class="text-xs text-muted-foreground">
          {{ formatRelativeTime(item.createdAt) }}
        </time>
      </span>
    </component>
    <!-- Archive and restore are always reachable: visible on touch, on hover or focus for pointer devices. -->
    <button
      type="button"
      :aria-label="`${action === 'archive' ? 'Archive' : 'Restore'} ${item.title}`"
      :class="
        cn(
          ICON_BUTTON,
          'me-1 shrink-0 pointer-coarse:size-11 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:group-focus-within:opacity-100',
        )
      "
      @click="onAction"
    >
      <Archive v-if="action === 'archive'" aria-hidden="true" class="size-4" />
      <ArchiveRestore v-else aria-hidden="true" class="size-4" />
    </button>
  </li>
</template>
