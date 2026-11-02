import { ApiError } from './http'

// What the store needs to decide: the code, whether another try can help, and the server's hints.
export type Failure = {
  code: string
  retryable: boolean
  retryAfterMs?: number | undefined
  requestId?: string | undefined
}

// A throw that is not an ApiError (a host's own getToken, say) gets the fallback code and counts as retryable:
// a host that cannot reach its backend is the likeliest cause, and it usually recovers.
export function failureOf(cause: unknown, fallbackCode: string): Failure {
  if (cause instanceof ApiError) {
    return {
      code: cause.code,
      retryable: cause.retryable,
      retryAfterMs: cause.retryAfterMs,
      requestId: cause.requestId,
    }
  }
  return { code: fallbackCode, retryable: true }
}

// Exponential backoff with jitter. A server's Retry-After replaces the schedule for that one wait.
export function createBackoff(options: { minMs: number; maxMs: number; random?: () => number }) {
  const random = options.random ?? Math.random
  let attempts = 0
  return {
    next(hintMs?: number | undefined): number {
      const attempt = attempts
      attempts += 1
      if (hintMs !== undefined) return hintMs
      return Math.min(options.maxMs, options.minMs * 2 ** attempt) * (0.5 + random())
    },
    reset() {
      attempts = 0
    },
  }
}
