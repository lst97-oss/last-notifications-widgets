import { Bell, TriangleAlert } from 'lucide-react'

import { Badge } from '@/ui/badge'
import { PopoverTrigger } from '@/ui/popover'

// The bell's classes live here so the live bell and the unavailable fallback cannot drift apart.
const TRIGGER_CLASS =
  'ln-trigger relative inline-flex size-(--ln-trigger-size) items-center justify-center rounded-lg text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11 motion-safe:transition-colors'
export const POPUP_CLASS =
  'ln-popup flex max-h-[min(var(--ln-popover-max-height),calc(100dvh-6rem))] w-[min(var(--ln-popover-width),calc(100vw-1rem))] flex-col gap-0 overflow-hidden p-0'

const BADGE_CLASS =
  'ln-badge absolute -end-1 -top-1 min-w-4 bg-(--ln-badge-background) px-1 text-(--ln-badge-foreground)'
const PLACEHOLDER_CLASS = 'absolute -end-1 -top-1 size-5 rounded-full bg-muted-foreground/20 motion-safe:animate-pulse'
const ERROR_ICON_CLASS = 'absolute -end-1 -top-1 flex size-5 items-center justify-center text-destructive'

// The bell button. A failure swaps the count for a warning triangle; the triangle, not only the colour, carries it.
export function BellTrigger({
  label,
  unread,
  loading,
  failed,
}: {
  label: string
  unread: number
  loading: boolean
  failed: boolean
}) {
  return (
    <PopoverTrigger aria-label={label} className={TRIGGER_CLASS}>
      <Bell aria-hidden="true" className="size-4" />
      {failed ? (
        <span aria-hidden="true" data-ln-error-icon className={ERROR_ICON_CLASS}>
          <TriangleAlert aria-hidden="true" className="size-3" />
        </span>
      ) : loading ? (
        // The count is unknown until the first page lands; a placeholder keeps it from reading as zero.
        <span aria-hidden="true" data-ln-placeholder className={PLACEHOLDER_CLASS} />
      ) : (
        unread > 0 && (
          <Badge aria-hidden="true" className={BADGE_CLASS}>
            {unread > 99 ? '99+' : unread}
          </Badge>
        )
      )}
    </PopoverTrigger>
  )
}
