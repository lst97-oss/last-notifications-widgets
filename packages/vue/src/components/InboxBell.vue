<script setup lang="ts">
import { type BellNote, bellAnnouncement, bellLabel } from '@last-notifications-widgets/client'
import { TooltipProvider } from 'reka-ui'
import { computed, shallowRef } from 'vue'

import { useInbox } from '../lib/useInbox'
import type { NotificationBellProps } from '../types'
import BellPopover from './BellPopover.vue'
import NotificationArchive from './NotificationArchive.vue'
import NotificationArchiveHeader from './NotificationArchiveHeader.vue'
import NotificationBellTheme from './NotificationBellTheme.vue'
import NotificationHeader from './NotificationHeader.vue'
import NotificationList from './NotificationList.vue'

const props = defineProps<NotificationBellProps>()
const { store, state } = useInbox(props)

// A message from an action. It is tied to the newest live arrival at the time it was set (see bellAnnouncement).
const note = shallowRef<BellNote>({ text: '', after: null })
const announce = (text: string) => {
  note.value = { text, after: state.value.announced }
}
const announcement = computed(() => bellAnnouncement(state.value, note.value))
</script>

<template>
  <NotificationBellTheme
    v-if="state.status !== 'anonymous'"
    :theme="theme"
    :theme-vars="themeVars"
    :class-name="className"
  >
    <TooltipProvider :delay-duration="300">
      <BellPopover
        :label="bellLabel(state)"
        :unread="state.unread"
        :loading="state.status === 'loading'"
        :failed="state.status === 'error'"
      >
        <template v-if="state.view === 'archive'">
          <NotificationArchiveHeader :store="store" />
          <NotificationArchive :state="state" :store="store" :on-announce="announce" />
        </template>
        <template v-else>
          <NotificationHeader :state="state" :store="store" :on-announce="announce" />
          <NotificationList :state="state" :store="store" :on-announce="announce" />
        </template>
      </BellPopover>
    </TooltipProvider>
    <div role="status" aria-live="polite" class="sr-only">{{ announcement }}</div>
  </NotificationBellTheme>
</template>
