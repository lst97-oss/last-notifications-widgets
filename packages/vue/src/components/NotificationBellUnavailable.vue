<script setup lang="ts">
import { LOAD_ERROR_MESSAGE, type WidgetTheme } from '@last-notifications-widgets/client'

import type { Theme } from '../types'
import BellPopover from './BellPopover.vue'
import NotificationBellTheme from './NotificationBellTheme.vue'
import NotificationError from './NotificationError.vue'

// The bell's error state, for a host that cannot mount the live bell (it has no baseUrl or appKey yet).
// It takes no token, key or URL, so the host's fallback looks exactly like the real bell in its failure state.
defineProps<{ onRetry: () => void; theme?: Theme; themeVars?: WidgetTheme; className?: string }>()
</script>

<template>
  <NotificationBellTheme :theme="theme" :theme-vars="themeVars" :class-name="className">
    <BellPopover label="Notifications, couldn't load" :unread="0" :loading="false" :failed="true">
      <NotificationError :message="LOAD_ERROR_MESSAGE" :on-retry="onRetry" />
    </BellPopover>
  </NotificationBellTheme>
</template>
