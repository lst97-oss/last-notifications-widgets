<script setup lang="ts">
import type { InboxState, InboxStore } from '@last-notifications-widgets/client'
import { BellRing, LoaderCircle } from '@lucide/vue'
import { onBeforeUnmount } from 'vue'
import { GHOST_BUTTON_SMALL } from '../lib/classes'
import { cn } from '../lib/cn'
import NotificationEmpty from './NotificationEmpty.vue'
import NotificationError from './NotificationError.vue'
import NotificationItem from './NotificationItem.vue'
import NotificationSkeletons from './NotificationSkeletons.vue'

const props = defineProps<{ state: InboxState; store: InboxStore; onAnnounce: (note: string) => void }>()

// Watches the sentinel above "Load more". Vue calls this ref on every render, not only when the sentinel changes, so
// it rebuilds the observer each time. After a failed page it must not watch: a new observer fires at once while the
// sentinel is on screen, which would ask for the same page in a loop. "Try again" is the way back.
let observer: IntersectionObserver | undefined
function watchSentinel(element: unknown) {
  observer?.disconnect()
  observer = undefined
  if (!(element instanceof HTMLElement) || props.state.loadMoreFailed) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void props.store.loadMore()
    },
    // The sentinel is a direct child of the scroll container, so its parent is the scroll root.
    { root: element.parentElement, rootMargin: '120px' },
  )
  observer.observe(element)
}
onBeforeUnmount(() => observer?.disconnect())

const openItem = (id: string) => () => props.store.markRead([id]).then(() => undefined)
const archiveItem = (id: string, title: string) => () => {
  props.onAnnounce(`Archived ${title}`)
  void props.store.archive([id]).then((applied) => applied || props.onAnnounce(`Couldn't archive ${title}`))
}
</script>

<template>
  <NotificationSkeletons v-if="state.status === 'loading'" />
  <NotificationError
    v-else-if="state.status === 'error'"
    :message="state.error ?? ''"
    :retryable="state.retryable"
    :on-retry="() => void store.retry()"
  />
  <NotificationEmpty
    v-else-if="state.items.length === 0"
    :icon="BellRing"
    title="You're all caught up"
    description="New notifications will appear here."
  />
  <div v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
    <ul :aria-busy="state.loadingMore" class="flex flex-col gap-0.5 p-1">
      <NotificationItem
        v-for="item in state.items"
        :key="item.id"
        :item="item"
        action="archive"
        :on-open="openItem(item.id)"
        :on-action="archiveItem(item.id, item.title)"
      />
    </ul>
    <template v-if="state.next !== null">
      <div :key="state.items.length" :ref="watchSentinel" class="h-px" />
      <div class="flex justify-center p-2">
        <button
          type="button"
          :disabled="state.loadingMore"
          :class="cn(GHOST_BUTTON_SMALL, 'pointer-coarse:min-h-11', state.loadMoreFailed && 'text-destructive')"
          @click="() => void store.loadMore()"
        >
          <LoaderCircle v-if="state.loadingMore" aria-hidden="true" class="size-4 animate-spin" />
          {{ state.loadMoreFailed ? "Couldn't load more. Try again" : 'Load more' }}
        </button>
      </div>
    </template>
  </div>
</template>
