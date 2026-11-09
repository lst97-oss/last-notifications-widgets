<script setup lang="ts">
import { themeVarsToStyle, type WidgetTheme } from '@last-notifications-widgets/client'
import { computed, ref } from 'vue'

import { cn } from '../lib/cn'
import { useTheme } from '../lib/useTheme'
import { provideWidgetRoot } from '../lib/widgetRoot'
import type { Theme } from '../types'

// The scoped root: owns the .ln-bell scope, dark mode, themeVars, and the portal container.
const props = withDefaults(defineProps<{ theme?: Theme; themeVars?: WidgetTheme; className?: string }>(), {
  theme: 'system',
})
const root = ref<HTMLElement | null>(null)
provideWidgetRoot(root)
const dark = useTheme(() => props.theme)
const style = computed(() => themeVarsToStyle(props.themeVars, dark.value))
</script>

<template>
  <div ref="root" :class="cn('ln-bell', dark && 'dark', className)" :style="style">
    <slot />
  </div>
</template>
