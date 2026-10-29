import { CircleAlert } from 'lucide-react'

import { Button } from '@/ui/button'

export function NotificationError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" data-ln-error className="flex flex-col items-start gap-2 p-4 text-sm">
      <p className="flex items-center gap-2 text-destructive">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="pointer-coarse:min-h-11">
        Try again
      </Button>
    </div>
  )
}
