import { cn } from './cn'

// Class strings copied from the React ui/ wrappers (shadcn base-nova), so every port paints the same. A change in
// packages/react/src/ui or NotificationBellParts.tsx belongs here too.

const BUTTON_BASE =
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
const GHOST =
  'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50'
const OUTLINE =
  'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50'
const SMALL =
  "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5"

export const ICON_BUTTON = cn(BUTTON_BASE, GHOST, 'size-8')
export const TOUCH_ICON_BUTTON = cn(ICON_BUTTON, 'pointer-coarse:size-11')
export const GHOST_BUTTON_SMALL = cn(BUTTON_BASE, GHOST, SMALL)
export const OUTLINE_BUTTON_SMALL = cn(BUTTON_BASE, OUTLINE, SMALL)

const BADGE_BASE =
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!'

export const BELL_BADGE = cn(
  BADGE_BASE,
  'bg-primary text-primary-foreground',
  'ln-badge absolute -end-1 -top-1 min-w-4 bg-(--ln-badge-background) px-1 text-(--ln-badge-foreground)',
)
export const HEADER_BADGE = cn(BADGE_BASE, 'bg-secondary text-secondary-foreground', 'tabular-nums')

export const TRIGGER =
  'ln-trigger relative inline-flex size-(--ln-trigger-size) items-center justify-center rounded-lg text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11 motion-safe:transition-colors'
export const PLACEHOLDER = 'absolute -end-1 -top-1 size-5 rounded-full bg-muted-foreground/20 motion-safe:animate-pulse'
export const ERROR_ICON = 'absolute -end-1 -top-1 flex size-5 items-center justify-center text-destructive'

const POPOVER_BASE =
  'z-50 flex w-72 origin-(--reka-popover-content-transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
export const POPUP =
  'ln-popup flex max-h-[min(var(--ln-popover-max-height),calc(100dvh-6rem))] w-[min(var(--ln-popover-width),calc(100vw-1rem))] flex-col gap-0 overflow-hidden p-0'
export const POPOVER_CONTENT = cn(POPOVER_BASE, POPUP)

export const MENU_CONTENT =
  'z-50 min-w-32 origin-(--reka-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
export const MENU_ITEM =
  'relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0'

export const TOOLTIP_CONTENT =
  'z-50 inline-flex w-fit max-w-xs origin-(--reka-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
export const TOOLTIP_ARROW =
  'z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=top]:-bottom-2.5'
