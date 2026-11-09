// The live stream, read over fetch so the token travels in the Authorization header. EventSource cannot set
// headers, and a token in the URL lands in server and proxy logs. The server sends LF-only frames: `event:`,
// `id:` and `data:` lines, with `:` comment lines as keepalives.
import type { FetchLike } from './http'

export type StreamEvent = { data: string; lastEventId: string }

// The slice of EventSource the store uses; tests pass a fake through `openStream`.
export type Stream = {
  addEventListener(type: 'open' | 'error' | 'notification', listener: (event: StreamEvent) => void): void
  close(): void
}

// How long a connection may take to answer, and how long it may stay silent before it is cut and reported.
// Keepalive comments count as data, so a healthy quiet stream is never cut.
export type StreamTimeouts = { connectMs?: number; idleMs?: number }

const EMPTY: StreamEvent = { data: '', lastEventId: '' }

export function openSseStream(fetchImpl: FetchLike, url: string, token: string, timeouts: StreamTimeouts = {}): Stream {
  const connectMs = timeouts.connectMs ?? 10_000
  const idleMs = timeouts.idleMs ?? 90_000
  const listeners = new Map<string, (event: StreamEvent) => void>()
  const controller = new AbortController()
  const emit = (type: string, event: StreamEvent) => listeners.get(type)?.(event)
  let closed = false
  // What went wrong, for the host's logs. It travels in the error event's `data`.
  let failure = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  // Gives the connection `ms` to make progress, then cuts it. Each call restarts the clock.
  function expectProgress(ms: number, reason: string) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      failure = reason
      controller.abort()
    }, ms)
  }

  // One frame. Keepalives and blank lines carry no data, so they dispatch nothing.
  function dispatch(frame: string) {
    let type = 'message'
    let lastEventId = ''
    const data: string[] = []
    for (const line of frame.split('\n')) {
      const colon = line.indexOf(':')
      if (line === '' || colon === 0) continue
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') type = value
      else if (field === 'id') lastEventId = value
      else if (field === 'data') data.push(value)
    }
    if (data.length > 0) emit(type, { data: data.join('\n'), lastEventId })
  }

  async function read(body: ReadableStream<string>) {
    const reader = body.getReader()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return
      // Any chunk, keepalive comments included, proves the connection is still alive.
      expectProgress(idleMs, `no data for ${idleMs} ms`)
      buffer += value
      for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
        dispatch(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
      }
    }
  }

  void (async () => {
    expectProgress(connectMs, `no answer for ${connectMs} ms`)
    try {
      const response = await fetchImpl(url, {
        headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
        signal: controller.signal,
      })
      if (!response.ok || response.body === null) throw new Error(`stream answered ${response.status}`)
      expectProgress(idleMs, `no data for ${idleMs} ms`)
      emit('open', EMPTY)
      await read(response.body.pipeThrough(new TextDecoderStream()))
    } catch (error) {
      // A cut we made set `failure` first, so the abort it causes does not overwrite the reason.
      if (failure === '') failure = error instanceof Error ? error.message : ''
    } finally {
      clearTimeout(timer)
    }
    // A stream we closed on purpose is not an outage. Anything else is, including a clean end from the server.
    if (!closed) emit('error', { data: failure, lastEventId: '' })
  })()

  return {
    addEventListener: (type, listener) => {
      listeners.set(type, listener)
    },
    close: () => {
      closed = true
      clearTimeout(timer)
      controller.abort()
    },
  }
}
