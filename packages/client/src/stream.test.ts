import { describe, expect, test } from 'bun:test'

import { openSseStream, type StreamEvent } from './stream'

const encoder = new TextEncoder()
const settle = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms))
const STREAM_URL = 'https://notify.test/api/v1/apps/app-1/stream?lastEventId=c0'

// A body that yields the given chunks, then ends, as a server that closes the stream does.
function bodyOf(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

describe('openSseStream', () => {
  test('sends the token in the Authorization header and reads frames split across chunks', async () => {
    const sent: { url: string; auth: string | null }[] = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') })
      return new Response(
        bodyOf([
          ': ping\n\nevent: notif',
          'ication\ndata: {"id":"n1"}\nid: cur-1\n\n',
          'event: notification\ndata: {"id":"n2"}\n',
          'id: cur-2\n\n',
        ]),
      )
    }) as typeof fetch

    const events: StreamEvent[] = []
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_1')
    stream.addEventListener('notification', (event) => events.push(event))
    await settle()

    expect(sent).toEqual([{ url: STREAM_URL, auth: 'Bearer lrt_1' }])
    // The token never reaches the URL, and a keepalive comment dispatches nothing.
    expect(sent[0].url).not.toContain('lrt_1')
    expect(events).toEqual([
      { data: '{"id":"n1"}', lastEventId: 'cur-1' },
      { data: '{"id":"n2"}', lastEventId: 'cur-2' },
    ])
  })

  test('a refused connection reports an error and never opens', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 401 })) as typeof fetch
    let opened = 0
    let errors = 0
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_old')
    stream.addEventListener('open', () => {
      opened += 1
    })
    stream.addEventListener('error', () => {
      errors += 1
    })
    await settle()
    expect(opened).toBe(0)
    expect(errors).toBe(1)
  })

  test('the error says why the connection failed, for the host to log', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 500 })) as typeof fetch
    const errors: StreamEvent[] = []
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_old')
    stream.addEventListener('error', (event) => {
      errors.push(event)
    })
    await settle()
    expect(errors.map((event) => event.data)).toEqual(['stream answered 500'])
  })

  test('a connection the server ends reports an error, so the store reconnects', async () => {
    const fetchImpl = (async () => new Response(bodyOf(['event: notification\ndata: {}\nid: c1\n\n']))) as typeof fetch
    let opened = 0
    let errors = 0
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_1')
    stream.addEventListener('open', () => {
      opened += 1
    })
    stream.addEventListener('error', () => {
      errors += 1
    })
    await settle()
    expect(opened).toBe(1)
    expect(errors).toBe(1)
  })

  test('closing aborts the request and reports no error', async () => {
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      // A live stream that stays open until the request is aborted, as a real connection does.
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body)
    }) as typeof fetch

    let errors = 0
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_1')
    stream.addEventListener('error', () => {
      errors += 1
    })
    await settle()
    stream.close()
    await settle()
    expect(errors).toBe(0)
  })
})
