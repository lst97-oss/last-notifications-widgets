import { describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

import { createTokenProvider, TokenError } from './token'

const URL = 'https://host.test/api/notifications-token'

// Resolves the rejection, so the test sees the TokenError the store would classify.
const rejected = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected the token call to fail')
    },
    (error: unknown) => error as TokenError,
  )

const providerReturning = (respond: () => Response | Promise<Response>) =>
  createTokenProvider({ url: URL, fetchImpl: async () => respond() })

describe('createTokenProvider', () => {
  test('returns the token from the data envelope', async () => {
    const getToken = providerReturning(() => Response.json({ data: { token: 'lrt_1', expiresAt: 'x' } }))
    expect(await getToken()).toBe('lrt_1')
  })

  test('a signed-out answer is null, not an error', async () => {
    const getToken = providerReturning(() => Response.json({ data: { token: null, expiresAt: null } }))
    expect(await getToken()).toBeNull()
  })

  test('a 503 is a retryable TokenError that keeps the code, Retry-After and the request id', async () => {
    const error = await rejected(
      providerReturning(() =>
        Response.json(
          { error: { code: 'NOTIFICATIONS_UNAVAILABLE', message: 'later' } },
          { status: HttpStatus.SERVICE_UNAVAILABLE.code, headers: { 'retry-after': '7', 'x-request-id': 'req-9' } },
        ),
      )(),
    )
    expect(error).toBeInstanceOf(TokenError)
    expect(error).toMatchObject({
      code: 'NOTIFICATIONS_UNAVAILABLE',
      status: HttpStatus.SERVICE_UNAVAILABLE.code,
      retryable: true,
      retryAfterMs: 7000,
      requestId: 'req-9',
    })
  })

  test('a 501 is a permanent TokenError, so the store will not retry it', async () => {
    const error = await rejected(
      providerReturning(() =>
        Response.json(
          { error: { code: 'NOTIFICATIONS_NOT_CONFIGURED', message: 'not set up' } },
          { status: HttpStatus.NOT_IMPLEMENTED.code },
        ),
      )(),
    )
    expect(error).toMatchObject({
      code: 'NOTIFICATIONS_NOT_CONFIGURED',
      status: HttpStatus.NOT_IMPLEMENTED.code,
      retryable: false,
    })
  })

  test('a network failure is a retryable NETWORK_ERROR with status 0', async () => {
    const getToken = createTokenProvider({
      url: URL,
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      },
    })
    expect(await rejected(getToken())).toMatchObject({ code: 'NETWORK_ERROR', status: 0, retryable: true })
  })

  test('a success without a token is a permanent INVALID_RESPONSE', async () => {
    const error = await rejected(providerReturning(() => Response.json({ data: {} }))())
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', retryable: false })
  })

  test('a proxy page that is not JSON reports the status, never a parser message', async () => {
    const error = await rejected(
      providerReturning(() => new Response('<html>bad gateway</html>', { status: HttpStatus.BAD_GATEWAY.code }))(),
    )
    expect(error).toMatchObject({
      code: 'REQUEST_FAILED',
      status: HttpStatus.BAD_GATEWAY.code,
      retryable: true,
    })
    expect(error.message).not.toContain('JSON')
  })
})
