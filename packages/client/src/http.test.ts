import { describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

import { ApiError, callApi, type FetchLike, isRetryableStatus, parseRetryAfter } from './http'

const URL = 'https://notify.test/api/v1/apps/app-1/inbox'

// Resolves the rejection, so the test sees the ApiError the caller would see.
const failureOf = (fetcher: FetchLike) =>
  callApi(fetcher, URL).then(
    () => {
      throw new Error('expected the call to fail')
    },
    (error: unknown) => error as ApiError,
  )

describe('callApi', () => {
  test('a fetch that never reaches the server becomes NETWORK_ERROR, with status 0 and the cause kept', async () => {
    const cause = new TypeError('fetch failed')
    const error = await failureOf(async () => {
      throw cause
    })
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
    expect(error.cause).toBe(cause)
  })

  test('a fetch that times out becomes TIMEOUT, not NETWORK_ERROR', async () => {
    const error = await failureOf(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    })
    expect(error).toMatchObject({ code: 'TIMEOUT', status: 0 })
  })

  test('a server failure keeps the code and status the server sent', async () => {
    const error = await failureOf(async () =>
      Response.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } },
        { status: HttpStatus.INTERNAL_SERVER_ERROR.code },
      ),
    )
    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: HttpStatus.INTERNAL_SERVER_ERROR.code })
  })

  test('a success returns the data envelope', async () => {
    const data = await callApi<{ ok: boolean }>(async () => Response.json({ data: { ok: true } }), URL)
    expect(data).toEqual({ ok: true })
  })

  test('a failure carries Retry-After and the request id, so the store can wait and the host can trace', async () => {
    const error = await failureOf(async () =>
      Response.json(
        { error: { code: 'INTERNAL_ERROR', message: 'busy' } },
        { status: HttpStatus.SERVICE_UNAVAILABLE.code, headers: { 'retry-after': '3', 'x-request-id': 'req-42' } },
      ),
    )
    expect(error).toMatchObject({ retryable: true, retryAfterMs: 3000, requestId: 'req-42' })
  })
})

describe('retry classification', () => {
  test('transient statuses and a missing response are retryable; permanent answers are not', () => {
    const transient = [
      0,
      HttpStatus.REQUEST_TIMEOUT.code,
      HttpStatus.TOO_MANY_REQUESTS.code,
      HttpStatus.INTERNAL_SERVER_ERROR.code,
      HttpStatus.SERVICE_UNAVAILABLE.code,
    ]
    const permanent = [
      HttpStatus.BAD_REQUEST.code,
      HttpStatus.UNAUTHORIZED.code,
      HttpStatus.FORBIDDEN.code,
      HttpStatus.NOT_FOUND.code,
      HttpStatus.NOT_IMPLEMENTED.code,
    ]
    expect(transient.map(isRetryableStatus)).toEqual([true, true, true, true, true])
    expect(permanent.map(isRetryableStatus)).toEqual([false, false, false, false, false])
  })

  test('a permanent ApiError is marked not retryable', () => {
    expect(new ApiError('APP_NOT_FOUND', 'missing', HttpStatus.NOT_FOUND.code).retryable).toBe(false)
  })

  test('Retry-After reads delta-seconds and HTTP dates, and ignores anything else', () => {
    expect(parseRetryAfter('7')).toBe(7000)
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter('not a date')).toBeUndefined()
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT', Date.parse('Wed, 21 Oct 2026 07:27:00 GMT'))).toBe(60_000)
  })
})
