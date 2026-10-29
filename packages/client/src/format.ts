// Notification links become anchors, so only web URLs (absolute or relative) may pass.
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    const { protocol } = new URL(value, 'https://relative.invalid/')
    return protocol === 'https:' || protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
  }
  return format.format(seconds, 'second')
}
