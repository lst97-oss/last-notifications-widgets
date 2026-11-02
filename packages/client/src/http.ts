// Shared request core for the browser inbox client and the server SDK: one envelope rule, one error type.
import { HttpStatus } from '@lst97-oss/last-httprism'

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const RETRYABLE_STATUSES = new Set([
  HttpStatus.REQUEST_TIMEOUT.code,
  HttpStatus.TOO_EARLY.code,
  HttpStatus.TOO_MANY_REQUESTS.code,
  HttpStatus.INTERNAL_SERVER_ERROR.code,
  HttpStatus.BAD_GATEWAY.code,
  HttpStatus.SERVICE_UNAVAILABLE.code,
  HttpStatus.GATEWAY_TIMEOUT.code,
])

// Status 0 means no response arrived (a network failure or a timeout). A permanent answer (400, 401, 403, 404,
// 501) will not change on a retry, so it is not retryable.
export function isRetryableStatus(status: number): boolean {
  return status === 0 || RETRYABLE_STATUSES.has(status)
}

// Retry-After is delta-seconds or an HTTP-date. Returns the wait in ms, or undefined when absent or unreadable.
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(trimmed)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

// Every failed call throws this. `status` is 0 when no response arrived (a timeout, or a refused or dropped connection).
// `retryable` is decided here from the status, so a caller never has to re-derive it.
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly retryable: boolean
  // The server's own wait hint (Retry-After), and its request id, for the host's logs.
  readonly retryAfterMs: number | undefined
  readonly requestId: string | undefined

  constructor(
    code: string,
    message: string,
    status: number,
    options?: { cause?: unknown; retryAfterMs?: number | undefined; requestId?: string | undefined },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.retryable = isRetryableStatus(status)
    this.retryAfterMs = options?.retryAfterMs
    this.requestId = options?.requestId
  }
}

type Envelope<T> = { data?: T; error?: { code: string; message: string } }

// The server answers `{data}` on success and `{error:{code,message}}` on failure; anything else is a failure.
export async function callApi<T>(fetcher: FetchLike, url: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetcher(url, init)
  } catch (cause) {
    // A fetch that rejects never reached the server. Without this, the caller would see a raw TypeError or DOMException.
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError'
    throw new ApiError(
      timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      timedOut ? 'The notifications server did not answer in time.' : "Couldn't reach the notifications server.",
      0,
      { cause },
    )
  }
  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null
  if (!response.ok || envelope === null || envelope.data === undefined) {
    throw new ApiError(
      envelope?.error?.code ?? 'REQUEST_FAILED',
      envelope?.error?.message ?? response.statusText,
      response.status,
      {
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
        requestId: response.headers.get('x-request-id') ?? undefined,
      },
    )
  }
  return envelope.data
}
