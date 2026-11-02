import { describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

import { createBackoff, failureOf } from './failure'
import { ApiError } from './http'

describe('failureOf', () => {
  test('an ApiError keeps its code, its retryable flag and the server hints', () => {
    const error = new ApiError('INTERNAL_ERROR', 'x', HttpStatus.SERVICE_UNAVAILABLE.code, {
      retryAfterMs: 2000,
      requestId: 'req-1',
    })
    expect(failureOf(error, 'UNKNOWN')).toEqual({
      code: 'INTERNAL_ERROR',
      retryable: true,
      retryAfterMs: 2000,
      requestId: 'req-1',
    })
  })

  test('a permanent ApiError is not retryable', () => {
    expect(failureOf(new ApiError('APP_NOT_FOUND', 'x', HttpStatus.NOT_FOUND.code), 'UNKNOWN').retryable).toBe(false)
  })

  test('a throw that is not an ApiError gets the fallback code and counts as retryable', () => {
    expect(failureOf(new Error('host down'), 'TOKEN_UNAVAILABLE')).toEqual({
      code: 'TOKEN_UNAVAILABLE',
      retryable: true,
    })
  })
})

describe('createBackoff', () => {
  test('doubles up to the cap', () => {
    const backoff = createBackoff({ minMs: 10, maxMs: 40, random: () => 0.5 })
    expect([backoff.next(), backoff.next(), backoff.next(), backoff.next()]).toEqual([10, 20, 40, 40])
  })

  test('jitter keeps each wait between half and one and a half of the schedule', () => {
    const low = createBackoff({ minMs: 100, maxMs: 100, random: () => 0 }).next()
    const high = createBackoff({ minMs: 100, maxMs: 100, random: () => 1 }).next()
    expect([low, high]).toEqual([50, 150])
  })

  test('a server hint replaces the wait once, and the schedule keeps counting', () => {
    const backoff = createBackoff({ minMs: 10, maxMs: 40, random: () => 0.5 })
    expect(backoff.next(3000)).toBe(3000)
    expect(backoff.next()).toBe(20)
  })

  test('reset starts the schedule again', () => {
    const backoff = createBackoff({ minMs: 10, maxMs: 40, random: () => 0.5 })
    backoff.next()
    backoff.next()
    backoff.reset()
    expect(backoff.next()).toBe(10)
  })
})
