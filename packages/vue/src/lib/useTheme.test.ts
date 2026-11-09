import { describe, expect, test } from 'bun:test'

import { resolveDark } from './useTheme'

describe('resolveDark', () => {
  test('an explicit theme ignores the OS', () => {
    expect(resolveDark('dark', false)).toBe(true)
    expect(resolveDark('light', true)).toBe(false)
  })

  test('system follows the OS preference', () => {
    expect(resolveDark('system', true)).toBe(true)
    expect(resolveDark('system', false)).toBe(false)
  })
})
