import type { WidgetTheme } from '@last-notifications-widgets/client'
import { themeVarsToStyle } from '@last-notifications-widgets/client'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Theme } from './types'
import { useTheme } from './useTheme'
import { WidgetRootContext } from './WidgetRootContext'

// The scoped root: owns the .ln-bell scope, dark mode, themeVars, and the portal container.
export function NotificationBellTheme({
  theme = 'system',
  themeVars,
  className,
  children,
}: {
  theme?: Theme
  themeVars?: WidgetTheme
  className?: string
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const dark = useTheme(theme)
  return (
    <WidgetRootContext value={root}>
      <div ref={root} className={cn('ln-bell', dark && 'dark', className)} style={themeVarsToStyle(themeVars, dark)}>
        {children}
      </div>
    </WidgetRootContext>
  )
}
