import { describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

import { ApiError, callApi, type FetchLike } from './http'

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
})
