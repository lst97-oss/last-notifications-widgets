import { createElement, type IconNode } from 'lucide'

export type Attrs = Record<string, string | number | boolean | ((event: Event) => void) | null | undefined>
export type Child = Node | string | false | null | undefined

// A tiny element builder. Notification text is always set as a text node, never as HTML, because titles and bodies
// come from the API. `onClick` and friends attach listeners; boolean attributes follow the DOM (aria-* keeps "true"/"false").
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value)
    else if (typeof value === 'boolean') {
      if (key.startsWith('aria-')) node.setAttribute(key, String(value))
      else if (value) node.setAttribute(key, '')
    } else node.setAttribute(key, String(value))
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child)
  return node
}

// A Lucide icon as an inline SVG, hidden from assistive tech (the control's aria-label names it).
export function icon(node: IconNode, className: string): SVGElement {
  return createElement(node, { class: className, 'aria-hidden': 'true' })
}
