<script setup lang="ts">
import type { InboxStore } from '@last-notifications-widgets/client'
import { ArrowLeft } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import { TOUCH_ICON_BUTTON } from '../lib/classes'

defineProps<{ store: InboxStore }>()

// Focus moves to the heading when the archive opens, and not again on later renders.
const heading = ref<HTMLHeadingElement | null>(null)
onMounted(() => heading.value?.focus())
</script>

<template>
  <header class="flex items-center gap-2 border-b px-2 py-3">
    <button type="button" aria-label="Back to notifications" :class="TOUCH_ICON_BUTTON" @click="store.closeArchive()">
      <ArrowLeft aria-hidden="true" class="size-4" />
    </button>
    <div class="min-w-0">
      <h2 ref="heading" tabindex="-1" class="text-base font-semibold outline-none">Archived</h2>
      <p class="text-xs text-muted-foreground">Archived notifications are deleted after 30 days.</p>
    </div>
  </header>
</template>
