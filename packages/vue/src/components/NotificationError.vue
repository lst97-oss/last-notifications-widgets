<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import { OUTLINE_BUTTON_SMALL } from '../lib/classes'

// The same triangle the bell shows on failure, so the popup and the trigger read as one error. A permanent failure
// (retryable false) shows the message alone: a retry button would only repeat the same answer.
withDefaults(defineProps<{ message: string; onRetry: () => void; retryable?: boolean }>(), { retryable: true })
</script>

<template>
  <div role="alert" data-ln-error class="flex flex-col items-start gap-2 p-4 text-sm">
    <p class="flex items-center gap-2 text-destructive">
      <TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
      {{ message }}
    </p>
    <button v-if="retryable" type="button" :class="[OUTLINE_BUTTON_SMALL, 'pointer-coarse:min-h-11']" @click="onRetry">
      Try again
    </button>
  </div>
</template>
