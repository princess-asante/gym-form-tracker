import Badge from '@/components/atoms/Badge'

type FeedbackItemProps = {
  title?: string
  description?: string
  severity?: 'low' | 'medium' | 'high'
  // When true renders a skeleton pulse — used while the stream is still filling this item
  loading?: boolean
}

export default function FeedbackItem({
  title,
  description,
  severity,
  loading = false,
}: FeedbackItemProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 animate-pulse">
        <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-3 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        {title && (
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {title}
          </p>
        )}
        {severity && <Badge severity={severity} />}
      </div>
      {description && (
        <p className="text-sm text-zinc-600 leading-relaxed dark:text-zinc-400">
          {description}
        </p>
      )}
    </div>
  )
}