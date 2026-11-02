import { TriangleAlert } from 'lucide-react'

import { Button } from '@/ui/button'

// The same triangle the bell shows on failure, so the popup and the trigger read as one error. A permanent failure
// (retryable false) shows the message alone: a retry button would only repeat the same answer.
export function NotificationError({
  message,
  onRetry,
  retryable = true,
}: {
  message: string
  onRetry: () => void
  retryable?: boolean
}) {
  return (
    <div role="alert" data-ln-error className="flex flex-col items-start gap-2 p-4 text-sm">
      <p className="flex items-center gap-2 text-destructive">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        {message}
      </p>
      {retryable && (
        <Button variant="outline" size="sm" onClick={onRetry} className="pointer-coarse:min-h-11">
          Try again
        </Button>
      )}
    </div>
  )
}
