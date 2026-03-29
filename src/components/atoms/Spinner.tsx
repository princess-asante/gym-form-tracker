type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]',
}

export default function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full border-zinc-300 border-t-zinc-800 animate-spin dark:border-zinc-600 dark:border-t-zinc-200 ${sizes[size]}`}
    />
  )
}