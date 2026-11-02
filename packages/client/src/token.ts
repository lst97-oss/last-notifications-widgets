import { ApiError, parseRetryAfter } from './http'

// A token endpoint failed. Its status decides `retryable` (inherited from ApiError), so a 503 retries and a 501 does not.
export class TokenError extends ApiError {
  constructor(
    code: string,
    message: string,
    status: number,
    options?: { cause?: unknown; retryAfterMs?: number | undefined; requestId?: string | undefined },
  ) {
    super(code, message, status, options)
    this.name = 'TokenError'
  }
}

export type TokenProviderOptions = {
  // The host's token endpoint. It must answer {data:{token}} for a signed-in visitor and {data:{token:null}} for a
  // signed-out one; any other answer is a failure.
  url: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

// The widget's own token call, so a host only has to expose an endpoint, not write fetch and envelope parsing.
export function createTokenProvider(options: TokenProviderOptions): () => Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? 10_000
  return async () => {
    let response: Response
    try {
      response = await (options.fetchImpl ?? fetch)(options.url, {
        credentials: 'same-origin',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError'
      throw new TokenError(
        timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        timedOut ? 'The token endpoint did not answer in time.' : "Couldn't reach the token endpoint.",
        0,
        { cause },
      )
    }
    const requestId = response.headers.get('x-request-id') ?? undefined
    const body = (await response.json().catch(() => null)) as {
      data?: { token?: unknown }
      error?: { code?: string; message?: string }
    } | null
    if (!response.ok) {
      throw new TokenError(
        body?.error?.code ?? 'REQUEST_FAILED',
        body?.error?.message ?? response.statusText,
        response.status,
        { retryAfterMs: parseRetryAfter(response.headers.get('retry-after')), requestId },
      )
    }
    const token = body?.data?.token
    if (token === null) return null
    if (typeof token !== 'string' || token === '') {
      throw new TokenError('INVALID_RESPONSE', 'The token endpoint sent no token.', response.status, { requestId })
    }
    return token
  }
}
