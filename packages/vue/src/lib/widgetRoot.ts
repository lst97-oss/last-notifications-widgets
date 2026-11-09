import { type InjectionKey, inject, provide, type Ref } from 'vue'

// Popups portal into the .ln-bell root, so they inherit its scoped theme and per-instance themeVars.
const WidgetRootKey: InjectionKey<Ref<HTMLElement | null>> = Symbol('ln-widget-root')

export function provideWidgetRoot(root: Ref<HTMLElement | null>): void {
  provide(WidgetRootKey, root)
}

// Null outside a bell; a portal given null falls back to <body>.
export function useWidgetRoot(): Ref<HTMLElement | null> | null {
  return inject(WidgetRootKey, null)
}
