<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'

import { POPOVER_CONTENT } from '../lib/classes'
import { useWidgetRoot } from '../lib/widgetRoot'
import BellTrigger from './BellTrigger.vue'

// The bell button and its popup. Must render inside NotificationBellTheme, so the portal can find the widget root.
defineProps<{ label: string; unread: number; loading: boolean; failed: boolean }>()
const widgetRoot = useWidgetRoot()
</script>

<template>
  <PopoverRoot>
    <BellTrigger :label="label" :unread="unread" :loading="loading" :failed="failed" />
    <PopoverPortal :to="widgetRoot ?? undefined">
      <PopoverContent align="end" :class="POPOVER_CONTENT">
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
