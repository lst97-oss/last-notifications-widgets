<script setup lang="ts">
import { Bell, TriangleAlert } from '@lucide/vue'
import { PopoverTrigger } from 'reka-ui'

import { BELL_BADGE, ERROR_ICON, PLACEHOLDER, TRIGGER } from '../lib/classes'

// The bell button. A failure swaps the count for a warning triangle; the triangle, not only the colour, carries it.
defineProps<{ label: string; unread: number; loading: boolean; failed: boolean }>()
</script>

<template>
  <PopoverTrigger :aria-label="label" :class="TRIGGER">
    <Bell aria-hidden="true" class="size-4" />
    <span v-if="failed" aria-hidden="true" data-ln-error-icon :class="ERROR_ICON">
      <TriangleAlert aria-hidden="true" class="size-3" />
    </span>
    <!-- The count is unknown until the first page lands; a placeholder keeps it from reading as zero. -->
    <span v-else-if="loading" aria-hidden="true" data-ln-placeholder :class="PLACEHOLDER" />
    <span v-else-if="unread > 0" aria-hidden="true" :class="BELL_BADGE">{{ unread > 99 ? '99+' : unread }}</span>
  </PopoverTrigger>
</template>
