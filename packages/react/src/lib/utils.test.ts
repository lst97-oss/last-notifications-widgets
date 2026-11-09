import { describe, expect, test } from 'bun:test'

import { cn } from './utils'

describe('cn', () => {
  test('keeps the class names, drops false and empty values, and lets the last conflicting utility win', () => {
    expect(cn('p-2', false, undefined, null, '', 'p-4', 'text-sm')).toBe('p-4 text-sm')
  })

  test('ignores a function className, which Base UI allows, instead of writing its source into the class attribute', () => {
    expect(cn('px-1', () => 'open')).toBe('px-1')
  })
})
