<script setup lang="ts">
import type { InboxState, InboxStore } from '@last-notifications-widgets/client'
import { ArchiveX } from '@lucide/vue'
import { GHOST_BUTTON_SMALL } from '../lib/classes'
import { cn } from '../lib/cn'
import NotificationEmpty from './NotificationEmpty.vue'
import NotificationError from './NotificationError.vue'
import NotificationItem from './NotificationItem.vue'
import NotificationSkeletons from './NotificationSkeletons.vue'

// The archive list. Its header is NotificationArchiveHeader.
// shortcut: the React port lazy-loads this view; here it ships in the main chunk, which costs bytes, not behaviour.
const props = defineProps<{ state: InboxState; store: InboxStore; onAnnounce: (note: string) => void }>()

const restoreItem = (id: string, title: string) => () => {
  props.onAnnounce(`Restored ${title}`)
  void props.store.restore([id]).then((applied) => applied || props.onAnnounce(`Couldn't restore ${title}`))
}
const retryOpen = () => {
  props.store.closeArchive()
  void props.store.openArchive()
}
</script>

<template>
  <NotificationSkeletons v-if="state.archive.status === 'loading' || state.archive.status === 'idle'" />
  <NotificationError
    v-else-if="state.archive.status === 'error'"
    :message="state.archive.error ?? ''"
    :on-retry="retryOpen"
  />
  <NotificationEmpty
    v-else-if="state.archive.items.length === 0"
    :icon="ArchiveX"
    title="Nothing archived yet"
    description="Archived notifications stay here for 30 days."
  />
  <div v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
    <ul :aria-busy="state.archive.loadingMore" class="flex flex-col gap-0.5 p-1">
      <NotificationItem
        v-for="item in state.archive.items"
        :key="item.id"
        :item="item"
        action="restore"
        :on-action="restoreItem(item.id, item.title)"
      />
    </ul>
    <div v-if="state.archive.next !== null" class="flex justify-center p-2">
      <button
        type="button"
        :disabled="state.archive.loadingMore"
        :class="cn(GHOST_BUTTON_SMALL, 'pointer-coarse:min-h-11', state.archive.loadMoreFailed && 'text-destructive')"
        @click="() => void store.loadMoreArchive()"
      >
        {{ state.archive.loadMoreFailed ? "Couldn't load more. Try again" : 'Load more' }}
      </button>
    </div>
  </div>
</template>
