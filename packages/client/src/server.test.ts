import { afterEach, describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

import { ApiError } from './http'
import { createNotificationsClient } from './server'

const KEY = 'lnk_test_0123456789abcdef'
type Sent = { method: string; url: string; auth?: string; body?: unknown }

function fake(respond: (sent: Sent) => Response) {
  const sent: Sent[] = []
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined
    const record: Sent = {
      method: init?.method ?? 'GET',
      url: String(input),
      auth: headers?.authorization,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    sent.push(record)
    return respond(record)
  }
  return { sent, fetchImpl }
}

const data = (value: unknown) => Response.json({ data: value }, { status: HttpStatus.OK.code })
const client = (fetchImpl: typeof fetch) =>
  createNotificationsClient({ baseUrl: 'https://notify.test/', appKey: 'app-1', apiKey: KEY, fetchImpl })

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
  delete (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope
})

describe('createNotificationsClient', () => {
  test('publish posts the notification with the key as bearer and returns the result', async () => {
    const { sent, fetchImpl } = fake(() => data({ id: 'n-1', duplicate: false, channels: ['inapp', 'webhook'] }))
    const result = await client(fetchImpl).publish({
      recipientKey: 'user-1',
      type: 'comment.reply',
      title: 'New reply',
      channels: ['inapp', 'webhook'],
      data: { url: '/c/1', webhook: { event: 'comment.reply' } },
    })
    expect(result).toEqual({ id: 'n-1', duplicate: false, channels: ['inapp', 'webhook'] })
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://notify.test/api/v1/apps/app-1/notifications',
      auth: `Bearer ${KEY}`,
    })
    expect(sent[0].body).toMatchObject({ recipientKey: 'user-1', channels: ['inapp', 'webhook'] })
  })

  test('mintRecipientToken encodes the recipient key in the path', async () => {
    const { sent, fetchImpl } = fake(() => data({ token: 'lrt_x', expiresAt: '2026-10-29T12:15:00.000Z' }))
    const minted = await client(fetchImpl).mintRecipientToken('user 1/a')
    expect(minted.token).toBe('lrt_x')
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://notify.test/api/v1/apps/app-1/recipients/user%201%2Fa/token',
    })
  })

  test('setContact sends the channel and address as a PUT', async () => {
    const { sent, fetchImpl } = fake(() => data({ channel: 'webhook', address: 'https://hooks.example.com/n' }))
    await client(fetchImpl).setContact('user-1', { channel: 'webhook', address: 'https://hooks.example.com/n' })
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: 'https://notify.test/api/v1/apps/app-1/recipients/user-1/contact',
      body: { channel: 'webhook', address: 'https://hooks.example.com/n' },
    })
  })

  test('setPreference sends the channel toggle as a PUT', async () => {
    const { sent, fetchImpl } = fake(() => data({ channel: 'email', enabled: false }))
    await client(fetchImpl).setPreference('user-1', { channel: 'email', enabled: false })
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: 'https://notify.test/api/v1/apps/app-1/recipients/user-1/preferences',
      body: { channel: 'email', enabled: false },
    })
  })

  test('a server error envelope becomes an ApiError with its code and status', async () => {
    const { fetchImpl } = fake(() =>
      Response.json(
        { error: { code: 'INVALID_API_KEY', message: 'API key is invalid' } },
        { status: HttpStatus.UNAUTHORIZED.code },
      ),
    )
    const failure = await client(fetchImpl)
      .publish({ recipientKey: 'u', type: 't', title: 'x' })
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ code: 'INVALID_API_KEY', status: HttpStatus.UNAUTHORIZED.code })
  })

  test('refuses an apiKey that is not an app key', () => {
    expect(() =>
      createNotificationsClient({ baseUrl: 'https://notify.test', appKey: 'app-1', apiKey: 'rtk_nope' }),
    ).toThrow('lnk_')
  })

  test('refuses to run in a browser, where the app key would leak', () => {
    ;(globalThis as { window?: unknown }).window = {}
    expect(() => createNotificationsClient({ baseUrl: 'https://notify.test', appKey: 'app-1', apiKey: KEY })).toThrow(
      'server-side only',
    )
  })

  test('refuses to run in a web worker, which has no window', () => {
    ;(globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope = class {}
    expect(() => createNotificationsClient({ baseUrl: 'https://notify.test', appKey: 'app-1', apiKey: KEY })).toThrow(
      'server-side only',
    )
  })
})

describe('delivery settings', () => {
  test('get reads the channel list with the key', async () => {
    const { sent, fetchImpl } = fake(() =>
      data({ channels: [{ channel: 'webhook', enabled: true, endpointUrl: null, secretConfigured: false }] }),
    )
    const settings = await client(fetchImpl).delivery.get()
    expect(settings.channels[0]).toMatchObject({ channel: 'webhook', secretConfigured: false })
    expect(sent[0]).toMatchObject({ method: 'GET', url: 'https://notify.test/api/v1/apps/app-1/channels' })
  })

  test('configure sets the webhook endpoint and returns the secret only when one is issued', async () => {
    const { sent, fetchImpl } = fake(() =>
      data({ channel: 'webhook', endpointUrl: 'https://hooks.example.com/n', secretConfigured: true, secret: 'abc' }),
    )
    const result = await client(fetchImpl).delivery.configure({
      webhook: { endpointUrl: 'https://hooks.example.com/n' },
    })
    expect(result.webhook?.secret).toBe('abc')
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: 'https://notify.test/api/v1/apps/app-1/channels/webhook',
      body: { endpointUrl: 'https://hooks.example.com/n' },
    })
  })

  test('configure with nothing to change sends no request', async () => {
    const { sent, fetchImpl } = fake(() => data({}))
    expect(await client(fetchImpl).delivery.configure({})).toEqual({})
    expect(sent).toHaveLength(0)
  })

  test('rotateSecret posts to the secret route and returns the new secret', async () => {
    const { sent, fetchImpl } = fake(() => data({ channel: 'webhook', secretConfigured: true, secret: 'new' }))
    const rotated = await client(fetchImpl).delivery.webhook.rotateSecret()
    expect(rotated.secret).toBe('new')
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://notify.test/api/v1/apps/app-1/channels/webhook/secret',
    })
  })
})

describe('recipients', () => {
  test('get encodes the recipient key and returns the masked summary', async () => {
    const { sent, fetchImpl } = fake(() =>
      data({
        recipientKey: 'user 1',
        email: { set: true, masked: 'a***@example.com' },
        webhook: { set: false, masked: null },
        push: { subscriptions: 0 },
        preferences: { email: false },
      }),
    )
    const summary = await client(fetchImpl).recipients.get('user 1')
    expect(summary.email.masked).toBe('a***@example.com')
    expect(sent[0]).toMatchObject({ method: 'GET', url: 'https://notify.test/api/v1/apps/app-1/recipients/user%201' })
  })

  test('list passes the paging options as query parameters', async () => {
    const { sent, fetchImpl } = fake(() => data({ recipients: ['a'], next: 'YQ' }))
    const page = await client(fetchImpl).recipients.list({ limit: 25, cursor: 'YQ' })
    expect(page).toEqual({ recipients: ['a'], next: 'YQ' })
    expect(sent[0].url).toBe('https://notify.test/api/v1/apps/app-1/recipients?limit=25&cursor=YQ')
  })

  test('list without options sends no query string', async () => {
    const { sent, fetchImpl } = fake(() => data({ recipients: [], next: null }))
    await client(fetchImpl).recipients.list()
    expect(sent[0].url).toBe('https://notify.test/api/v1/apps/app-1/recipients')
  })

  test('set writes each given field as its own request', async () => {
    const { sent, fetchImpl } = fake(() => data({ ok: true }))
    await client(fetchImpl).recipients.set('user-1', {
      email: 'a@example.com',
      webhookUrl: 'https://hooks.example.com/n',
      preferences: { webpush: false },
    })
    expect(sent.map((request) => [request.method, request.url])).toEqual([
      ['PUT', 'https://notify.test/api/v1/apps/app-1/recipients/user-1/contact'],
      ['PUT', 'https://notify.test/api/v1/apps/app-1/recipients/user-1/contact'],
      ['PUT', 'https://notify.test/api/v1/apps/app-1/recipients/user-1/preferences'],
    ])
    expect(sent[0].body).toEqual({ channel: 'email', address: 'a@example.com' })
    expect(sent[2].body).toEqual({ channel: 'webpush', enabled: false })
  })

  test('clear deletes one contact channel per request and reports what was there', async () => {
    const { sent, fetchImpl } = fake((request) =>
      data({ channel: request.url.endsWith('email') ? 'email' : 'webhook', cleared: true }),
    )
    const results = await client(fetchImpl).recipients.clear('user-1', ['email', 'webhook'])
    expect(results).toHaveLength(2)
    expect(sent.map((request) => [request.method, request.url])).toEqual([
      ['DELETE', 'https://notify.test/api/v1/apps/app-1/recipients/user-1/contact?channel=email'],
      ['DELETE', 'https://notify.test/api/v1/apps/app-1/recipients/user-1/contact?channel=webhook'],
    ])
  })
})

describe('deleteNotification', () => {
  test('names the recipient in the query, since a key cannot act without one', async () => {
    const { sent, fetchImpl } = fake(() => data({ deleted: true }))
    expect(await client(fetchImpl).deleteNotification('n-1', { recipientKey: 'user-1' })).toEqual({ deleted: true })
    expect(sent[0]).toMatchObject({
      method: 'DELETE',
      url: 'https://notify.test/api/v1/apps/app-1/notifications/n-1?recipient=user-1',
    })
  })
})
