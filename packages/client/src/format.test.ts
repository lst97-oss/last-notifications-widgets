import { describe, expect, test } from 'bun:test'

import { formatRelativeTime, safeUrl } from './format'
import { themeVarsToStyle } from './theme'

describe('safeUrl', () => {
  test('keeps web and relative links', () => {
    expect(safeUrl('https://example.com/orders/1')).toBe('https://example.com/orders/1')
    expect(safeUrl('http://example.com')).toBe('http://example.com')
    expect(safeUrl('/orders/1')).toBe('/orders/1')
  })

  test('rejects script, data and empty targets', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl(' javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>x</script>')).toBeNull()
    expect(safeUrl('')).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
  })
})

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-29T12:00:00.000Z')

  test('reads a past timestamp as relative time', () => {
    expect(formatRelativeTime('2026-10-29T09:00:00.000Z', now)).toContain('hour')
  })

  test('reads a timestamp under a minute as now', () => {
    expect(formatRelativeTime('2026-10-29T12:00:00.000Z', now)).toBe('now')
  })
})

describe('themeVarsToStyle', () => {
  const theme = { vars: { primary: 'red', fontSize: '14px' }, dark: { primary: 'blue' } }

  test('maps keys to their custom properties in light mode', () => {
    expect(themeVarsToStyle(theme, false)).toEqual({ '--primary': 'red', '--ln-font-size': '14px' })
  })

  test('merges dark overrides over the base values', () => {
    expect(themeVarsToStyle(theme, true)).toEqual({ '--primary': 'blue', '--ln-font-size': '14px' })
  })

  test('ignores keys that are not theme knobs', () => {
    const style = themeVarsToStyle({ vars: { notAKnob: 'x' } as never })
    expect(style).toEqual({})
  })
})
