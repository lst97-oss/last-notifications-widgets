<script setup lang="ts">
import type { InboxState, InboxStore } from '@last-notifications-widgets/client'
import { Archive, CheckCheck, Ellipsis } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { computed } from 'vue'

import {
  HEADER_BADGE,
  MENU_CONTENT,
  MENU_ITEM,
  TOOLTIP_ARROW,
  TOOLTIP_CONTENT,
  TOUCH_ICON_BUTTON,
} from '../lib/classes'
import { useWidgetRoot } from '../lib/widgetRoot'

const props = defineProps<{ state: InboxState; store: InboxStore; onAnnounce: (note: string) => void }>()
const widgetRoot = useWidgetRoot()
// Read rows are every inbox row the unread count does not cover, including rows past the loaded page.
const hasRead = computed(() => props.state.total > props.state.unread)

const markAll = () =>
  void props.store.markAllRead().then((applied) => applied || props.onAnnounce("Couldn't mark all as read"))
const openArchive = () => void props.store.openArchive()
const archiveRead = () =>
  void props.store
    .archiveRead()
    .then((applied) =>
      props.onAnnounce(applied ? 'Archived read notifications' : "Couldn't archive read notifications"),
    )
</script>

<template>
  <header class="flex items-center justify-between gap-2 border-b px-4 py-3">
    <h2 data-slot="popover-title" class="flex items-center gap-2 text-base font-semibold">
      Notifications
      <span
        v-if="state.status === 'loading'"
        aria-hidden="true"
        data-ln-placeholder
        class="h-5 w-6 rounded-full bg-muted-foreground/20 motion-safe:animate-pulse"
      />
      <span v-else-if="state.total > 0" :class="HEADER_BADGE">{{ state.total > 99 ? '99+' : state.total }}</span>
    </h2>
    <div class="flex items-center gap-1">
      <TooltipRoot>
        <TooltipTrigger
          aria-label="Mark all as read"
          :disabled="state.unread === 0"
          :class="TOUCH_ICON_BUTTON"
          @click="markAll"
        >
          <CheckCheck aria-hidden="true" class="size-4" />
        </TooltipTrigger>
        <TooltipPortal :to="widgetRoot ?? undefined">
          <TooltipContent :side-offset="4" :class="TOOLTIP_CONTENT">
            Mark all as read
            <TooltipArrow :class="TOOLTIP_ARROW" />
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
      <TooltipRoot>
        <TooltipTrigger aria-label="Open archive" :class="TOUCH_ICON_BUTTON" @click="openArchive">
          <Archive aria-hidden="true" class="size-4" />
        </TooltipTrigger>
        <TooltipPortal :to="widgetRoot ?? undefined">
          <TooltipContent :side-offset="4" :class="TOOLTIP_CONTENT">
            Archive
            <TooltipArrow :class="TOOLTIP_ARROW" />
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
      <DropdownMenuRoot>
        <DropdownMenuTrigger aria-label="More actions" :class="TOUCH_ICON_BUTTON">
          <Ellipsis aria-hidden="true" class="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal :to="widgetRoot ?? undefined">
          <DropdownMenuContent align="end" :side-offset="4" :class="MENU_CONTENT">
            <DropdownMenuItem :disabled="!hasRead" :class="MENU_ITEM" @select="archiveRead">
              Archive all read
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </header>
</template>
