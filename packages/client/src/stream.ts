// The live stream, read over fetch so the token travels in the Authorization header. EventSource cannot set
// headers, and a token in the URL lands in server and proxy logs. The server sends LF-only frames: `event:`,
// `id:` and `data:` lines, with `:` comment lines as keepalives.
export type StreamEvent = { data: string; lastEventId: string }

// The slice of EventSource the store uses; tests pass a fake through `openStream`.
export type Stream = {
  addEventListener(type: 'open' | 'error' | 'notification', listener: (event: StreamEvent) => void): void
  close(): void
}

const EMPTY: StreamEvent = { data: '', lastEventId: '' }

export function openSseStream(fetchImpl: typeof fetch, url: string, token: string): Stream {
  const listeners = new Map<string, (event: StreamEvent) => void>()
  const controller = new AbortController()
  const emit = (type: string, event: StreamEvent) => listeners.get(type)?.(event)

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
      buffer += value
      for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
        dispatch(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
      }
    }
  }

  void (async () => {
    // What went wrong, for the host's logs. It travels in the error event's `data`.
    let failure = ''
    try {
      const response = await fetchImpl(url, {
        headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
        signal: controller.signal,
      })
      if (!response.ok || response.body === null) throw new Error(`stream answered ${response.status}`)
      emit('open', EMPTY)
      await read(response.body.pipeThrough(new TextDecoderStream()))
    } catch (error) {
      // A refused or dropped connection is reported below. An aborted one is our own close, so it is not.
      failure = error instanceof Error ? error.message : ''
    }
    if (!controller.signal.aborted) emit('error', { data: failure, lastEventId: '' })
  })()

  return {
    addEventListener: (type, listener) => {
      listeners.set(type, listener)
    },
    close: () => controller.abort(),
  }
}
