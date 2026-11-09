import { describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

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

// A fetch that never answers, but honours the abort signal the way the real fetch does.
const neverAnswers = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })

describe('openSseStream', () => {
  test('sends the token in the Authorization header and reads frames split across chunks', async () => {
    const sent: { url: string; auth: string | null }[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') })
      return new Response(
        bodyOf([
          ': ping\n\nevent: notif',
          'ication\ndata: {"id":"n1"}\nid: cur-1\n\n',
          'event: notification\ndata: {"id":"n2"}\n',
          'id: cur-2\n\n',
        ]),
      )
    }

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
    const fetchImpl = async () => new Response('nope', { status: HttpStatus.UNAUTHORIZED.code })
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
    const fetchImpl = async () => new Response('nope', { status: HttpStatus.INTERNAL_SERVER_ERROR.code })
    const errors: StreamEvent[] = []
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_old')
    stream.addEventListener('error', (event) => {
      errors.push(event)
    })
    await settle()
    expect(errors.map((event) => event.data)).toEqual([`stream answered ${HttpStatus.INTERNAL_SERVER_ERROR.code}`])
  })

  test('a connection the server ends reports an error, so the store reconnects', async () => {
    const fetchImpl = async () => new Response(bodyOf(['event: notification\ndata: {}\nid: c1\n\n']))
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
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      // A live stream that stays open until the request is aborted, as a real connection does.
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body)
    }

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

  test('a connection that never answers is cut after the connect limit and reported', async () => {
    const errors: StreamEvent[] = []
    const stream = openSseStream(neverAnswers, STREAM_URL, 'lrt_1', { connectMs: 20 })
    stream.addEventListener('error', (event) => errors.push(event))
    await settle(80)
    expect(errors.map((event) => event.data)).toEqual(['no answer for 20 ms'])
  })

  test('a stream that goes silent after it opened is cut after the idle limit and reported', async () => {
    let opened = 0
    const errors: StreamEvent[] = []
    // One keepalive, then nothing, and the body never closes: the connection is alive on paper only.
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(': ping\n\n'))
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body)
    }
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_1', { idleMs: 30 })
    stream.addEventListener('open', () => {
      opened += 1
    })
    stream.addEventListener('error', (event) => errors.push(event))
    await settle(120)
    expect(opened).toBe(1)
    expect(errors.map((event) => event.data)).toEqual(['no data for 30 ms'])
  })

  test('keepalive comments keep a quiet stream alive past the idle limit', async () => {
    const errors: StreamEvent[] = []
    // Pings every 10 ms against an idle limit of 40 ms: the stream must not be cut while they keep coming.
    const fetchImpl = async () => {
      const chunks = Array.from({ length: 8 }, () => ': ping\n\n')
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const chunk of chunks) {
            await settle(10)
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })
      return new Response(body)
    }
    const stream = openSseStream(fetchImpl, STREAM_URL, 'lrt_1', { idleMs: 40 })
    stream.addEventListener('error', (event) => errors.push(event))
    await settle(150)
    // The server closed the body after its pings, so the one error is a clean end (no reason), not an idle cut.
    expect(errors.map((event) => event.data)).toEqual([''])
  })
})
