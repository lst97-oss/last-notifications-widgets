<script setup lang="ts">
// Mirrors a NotificationItem row (58px with padding, plus the hidden action slot) so the list keeps its height.
const TITLE_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/3']
const SKELETON = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'
</script>

<template>
  <div role="status" class="flex flex-col gap-0.5 p-1">
    <span class="sr-only">Loading notifications</span>
    <div v-for="width in TITLE_WIDTHS" :key="width" class="flex items-center gap-1">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5">
        <div :class="[SKELETON, 'my-[3px] h-3.5', width]" />
        <div :class="[SKELETON, 'my-0.5 h-3 w-16']" />
      </div>
      <div class="me-1 size-8 shrink-0" />
    </div>
  </div>
</template>
