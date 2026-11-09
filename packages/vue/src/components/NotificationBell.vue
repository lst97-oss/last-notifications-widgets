<script setup lang="ts">
import { computed } from 'vue'

import type { NotificationBellProps } from '../types'
import InboxBell from './InboxBell.vue'

const props = defineProps<NotificationBellProps>()

// Renders nothing without a session. The inner bell is keyed by app, user and session, so each one gets a fresh
// store and a change drops the previous user's list.
const instanceKey = computed(() => JSON.stringify([props.baseUrl, props.appKey, props.session, props.tokenUrl]))
</script>

<template>
  <InboxBell v-if="props.session != null" :key="instanceKey" v-bind="props" />
</template>
