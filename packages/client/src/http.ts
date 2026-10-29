// Shared request core for the browser inbox client and the server SDK: one envelope rule, one error type.

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

type Envelope<T> = { data?: T; error?: { code: string; message: string } }

// The server answers `{data}` on success and `{error:{code,message}}` on failure; anything else is a failure.
export async function callApi<T>(fetcher: FetchLike, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetcher(url, init)
  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null
  if (!response.ok || envelope === null || envelope.data === undefined) {
    throw new ApiError(
      envelope?.error?.code ?? 'REQUEST_FAILED',
      envelope?.error?.message ?? response.statusText,
      response.status,
    )
  }
  return envelope.data
}
