// Server-side SDK: publish notifications, mint recipient tokens, manage recipients and the app's
// delivery settings with the app's `lnk_` key. It ships as its own entry
// (`@…/last-notifications-widgets/server`) so the key cannot end up in a browser bundle by
// importing the inbox client.
import { callApi, type FetchLike } from './http'

export { ApiError, type FetchLike } from './http'

// The server validates channel names; this list is the SDK's typed view of them.
export const CHANNELS = ['inapp', 'email', 'webpush', 'webhook'] as const
export type Channel = (typeof CHANNELS)[number]

export const CONTACT_CHANNELS = ['email', 'webhook'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

export type Priority = -2 | -1 | 0 | 1 | 2

export type NotificationData = {
  url?: string
  email?: { theme?: 'default'; accentColor?: string }
  webhook?: { event?: string }
  [key: string]: unknown
}

export type PublishInput = {
  recipientKey: string
  type: string
  title: string
  body?: string
  data?: NotificationData
  priority?: Priority
  // The server needs at least one channel; omit the field to use its defaults.
  channels?: readonly [Channel, ...Channel[]]
  dedupeKey?: string
  // One-shot address for this delivery only (email). Not stored.
  email?: string
}

export type PublishResult = { id: string; duplicate: boolean; channels: Channel[] }
export type RecipientToken = { token: string; expiresAt: string }

// Delivery settings. A secret is returned exactly once, by the call that issues or rotates it.
export type DeliveryChannel = {
  channel: Channel
  enabled: boolean
  endpointUrl: string | null
  secretConfigured: boolean
}
export type DeliverySettings = { channels: DeliveryChannel[] }
export type WebhookSettings = {
  channel: 'webhook'
  endpointUrl: string | null
  secretConfigured: boolean
  secret?: string
}

// A recipient's state with addresses masked (a***@example.com, webhook origin only).
export type RecipientSummary = {
  recipientKey: string
  email: { set: boolean; masked: string | null }
  webhook: { set: boolean; masked: string | null }
  push: { subscriptions: number }
  preferences: Partial<Record<Channel, boolean>>
}
export type RecipientPage = { recipients: string[]; next: string | null }
export type RecipientInput = {
  email?: string
  webhookUrl?: string
  preferences?: Partial<Record<Channel, boolean>>
}

export type NotificationsClientOptions = {
  baseUrl: string
  appKey: string
  apiKey: string
  fetchImpl?: FetchLike
  timeoutMs?: number
  // Sent as x-request-id on every call, so the host's log and the server's log share one id.
  requestId?: string
}

export type NotificationsClient = {
  publish(input: PublishInput): Promise<PublishResult>
  mintRecipientToken(recipientKey: string): Promise<RecipientToken>
  setContact(recipientKey: string, contact: { channel: ContactChannel; address: string }): Promise<unknown>
  setPreference(recipientKey: string, preference: { channel: Channel; enabled: boolean }): Promise<unknown>
  deleteNotification(id: string, options: { recipientKey: string }): Promise<{ deleted: true }>
  delivery: {
    get(): Promise<DeliverySettings>
    // Idempotent: safe to call on every boot. Only the call that issues a secret returns it.
    configure(input: { webhook?: { endpointUrl: string | null } }): Promise<{ webhook?: WebhookSettings }>
    webhook: {
      // Explicit: the previous secret stops signing at once, so redeploy the receiver with the new one.
      rotateSecret(): Promise<WebhookSettings>
    }
  }
  recipients: {
    get(recipientKey: string): Promise<RecipientSummary>
    list(options?: { limit?: number; cursor?: string }): Promise<RecipientPage>
    // Not atomic: each field is its own request. Repeating the call is the way to recover from a failure part-way.
    set(recipientKey: string, input: RecipientInput): Promise<void>
    clear(
      recipientKey: string,
      channels: readonly ContactChannel[],
    ): Promise<{ channel: ContactChannel; cleared: boolean }[]>
  }
}

const DEFAULT_TIMEOUT_MS = 10_000

export function createNotificationsClient(options: NotificationsClientOptions): NotificationsClient {
  // Web Workers have no window, so they are checked by their own global scope.
  if (typeof window !== 'undefined' || 'WorkerGlobalScope' in globalThis) {
    throw new Error('createNotificationsClient is server-side only: the app key must never reach a browser')
  }
  if (!options.apiKey.startsWith('lnk_')) throw new Error('apiKey must be an app API key (lnk_…)')

  const root = `${options.baseUrl.replace(/\/$/, '')}/api/v1/apps/${encodeURIComponent(options.appKey)}`
  const fetcher: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const call = <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
    callApi<T>(fetcher, `${root}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.requestId ? { 'x-request-id': options.requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })

  const recipient = (recipientKey: string) => `/recipients/${encodeURIComponent(recipientKey)}`
  const query = (values: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) if (value !== undefined) params.set(key, String(value))
    return params.size === 0 ? '' : `?${params}`
  }

  const setContact = (recipientKey: string, contact: { channel: ContactChannel; address: string }) =>
    call<unknown>('PUT', `${recipient(recipientKey)}/contact`, contact)
  const setPreference = (recipientKey: string, preference: { channel: Channel; enabled: boolean }) =>
    call<unknown>('PUT', `${recipient(recipientKey)}/preferences`, preference)

  return {
    publish: (input) => call<PublishResult>('POST', '/notifications', input),
    mintRecipientToken: (recipientKey) => call<RecipientToken>('POST', `${recipient(recipientKey)}/token`),
    setContact,
    setPreference,
    deleteNotification: (id, { recipientKey }) =>
      call<{ deleted: true }>(
        'DELETE',
        `/notifications/${encodeURIComponent(id)}${query({ recipient: recipientKey })}`,
      ),
    delivery: {
      get: () => call<DeliverySettings>('GET', '/channels'),
      configure: async (input) => {
        if (input.webhook === undefined) return {}
        const webhook = await call<WebhookSettings>('PUT', '/channels/webhook', {
          endpointUrl: input.webhook.endpointUrl,
        })
        return { webhook }
      },
      webhook: {
        rotateSecret: () => call<WebhookSettings>('POST', '/channels/webhook/secret'),
      },
    },
    recipients: {
      get: (recipientKey) => call<RecipientSummary>('GET', recipient(recipientKey)),
      list: (options = {}) =>
        call<RecipientPage>('GET', `/recipients${query({ limit: options.limit, cursor: options.cursor })}`),
      set: async (recipientKey, input) => {
        if (input.email !== undefined) await setContact(recipientKey, { channel: 'email', address: input.email })
        if (input.webhookUrl !== undefined)
          await setContact(recipientKey, { channel: 'webhook', address: input.webhookUrl })
        for (const [channel, enabled] of Object.entries(input.preferences ?? {})) {
          if (enabled !== undefined) await setPreference(recipientKey, { channel: channel as Channel, enabled })
        }
      },
      clear: async (recipientKey, channels) => {
        const results: { channel: ContactChannel; cleared: boolean }[] = []
        for (const channel of channels) {
          const outcome = await call<{ channel: ContactChannel; cleared: boolean }>(
            'DELETE',
            `${recipient(recipientKey)}/contact${query({ channel })}`,
          )
          results.push(outcome)
        }
        return results
      },
    },
  }
}
