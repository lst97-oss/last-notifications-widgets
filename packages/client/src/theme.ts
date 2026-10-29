// Theme keys and their CSS custom properties. The shadcn-named tokens keep the same names as
// last-comments-widgets, so one brand object themes both; everything else is an --ln-* knob.
export const THEME_CSS_VARIABLES = {
  background: '--background',
  foreground: '--foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  border: '--border',
  ring: '--ring',
  radius: '--radius',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  fontFamily: '--ln-font-family',
  fontSize: '--ln-font-size',
  lineHeight: '--ln-line-height',
  spacing: '--ln-spacing',
  triggerSize: '--ln-trigger-size',
  popoverWidth: '--ln-popover-width',
  popoverMaxHeight: '--ln-popover-max-height',
  popoverShadow: '--ln-popover-shadow',
  badgeBackground: '--ln-badge-background',
  badgeForeground: '--ln-badge-foreground',
  unreadIndicator: '--ln-unread-indicator',
} as const

export type ThemeKey = keyof typeof THEME_CSS_VARIABLES
export type ThemeVars = { [K in ThemeKey]?: string }
export type WidgetTheme = { vars?: ThemeVars; dark?: ThemeVars }

// Inline custom properties for the widget root: `dark` is merged over `vars` in dark mode,
// and unset keys fall through to the stylesheet defaults.
export function themeVarsToStyle(theme?: WidgetTheme, dark = false): Record<string, string> {
  const active: ThemeVars | undefined = dark ? { ...theme?.vars, ...theme?.dark } : theme?.vars
  const style: Record<string, string> = {}
  for (const [key, variable] of Object.entries(THEME_CSS_VARIABLES) as [ThemeKey, string][]) {
    const value = active?.[key]
    if (value !== undefined) style[variable] = value
  }
  return style
}
