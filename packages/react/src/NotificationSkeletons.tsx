import { Skeleton } from '@/ui/skeleton'

// Mirrors a NotificationItem row (58px with padding, plus the hidden action slot) so the list keeps its height.
const TITLE_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/3']

export function NotificationSkeletons() {
  return (
    <div role="status" className="flex flex-col gap-0.5 p-1">
      <span className="sr-only">Loading notifications</span>
      {TITLE_WIDTHS.map((width) => (
        <div key={width} className="flex items-center gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5">
            <Skeleton className={`my-[3px] h-3.5 ${width} motion-reduce:animate-none`} />
            <Skeleton className="my-0.5 h-3 w-16 motion-reduce:animate-none" />
          </div>
          <div className="me-1 size-8 shrink-0" />
        </div>
      ))}
    </div>
  )
}
