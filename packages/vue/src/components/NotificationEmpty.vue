<script setup lang="ts">
import type { Component } from 'vue'

// An empty state: a muted icon tile, a title and a description, as in the React ui/empty wrapper.
defineProps<{ icon: Component; title: string; description: string }>()
</script>

<template>
  <div
    class="flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance"
  >
    <div class="flex max-w-sm flex-col items-center gap-2">
      <div
        class="mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
      >
        <component :is="icon" aria-hidden="true" />
      </div>
      <div class="font-heading text-sm font-medium tracking-tight">{{ title }}</div>
      <div class="text-sm/relaxed text-muted-foreground">{{ description }}</div>
    </div>
  </div>
</template>
