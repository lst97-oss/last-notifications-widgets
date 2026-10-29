import { createContext, type RefObject } from 'react'

// Portals stay inside their owning root to inherit the scoped theme and themeVars.
export const WidgetRootContext = createContext<RefObject<HTMLElement | null> | undefined>(undefined)
