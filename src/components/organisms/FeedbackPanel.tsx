import { DeepPartial } from 'ai'
import { FormFeedback } from '@/lib/schemas'
import FeedbackItem from '@/components/molecules/FeedbackItem'

type FeedbackPanelProps = {
  // DeepPartial because this data streams in — every field may be undefined
  // until the model has produced enough tokens to fill it
  feedback: DeepPartial<FormFeedback>
  isLoading: boolean
}

function SectionHeading({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
      {icon}
      {label}
    </h2>
  )
}

export default function FeedbackPanel({ feedback, isLoading }: FeedbackPanelProps) {
  const hasOverall = !!feedback.overallAssessment
  const positives = feedback.positives ?? []
  const issues = feedback.issues ?? []

  return (
    <div className="flex flex-col gap-8">
      {/* Overall assessment — arrives as a single string so we show it as soon
          as any characters exist, which gives users immediate feedback */}
      {(hasOverall || isLoading) && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <SectionHeading
            icon={
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            }
            label="Overall"
          />
          {hasOverall ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {feedback.overallAssessment}
            </p>
          ) : (
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          )}
        </section>
      )}

      {/* Positives */}
      {(positives.length > 0 || isLoading) && (
        <section>
          <SectionHeading
            icon={
              <svg className="size-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Looking good"
          />
          <ul className="mt-4 flex flex-col gap-5 divide-y divide-zinc-100 dark:divide-zinc-800">
            {positives.map((item, i) => (
              <li key={i} className="pt-4 first:pt-0">
                <FeedbackItem
                  title={item?.title}
                  description={item?.description}
                  // An item exists in the array but its title hasn't streamed in yet
                  loading={!item?.title && isLoading}
                />
              </li>
            ))}
            {/* Show a skeleton for the item currently being streamed */}
            {isLoading && positives.length === 0 && (
              <li>
                <FeedbackItem loading />
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Issues */}
      {(issues.length > 0 || isLoading) && (
        <section>
          <SectionHeading
            icon={
              <svg className="size-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            }
            label="Needs work"
          />
          <ul className="mt-4 flex flex-col gap-5 divide-y divide-zinc-100 dark:divide-zinc-800">
            {issues.map((item, i) => (
              <li key={i} className="pt-4 first:pt-0">
                <FeedbackItem
                  title={item?.title}
                  description={item?.description}
                  severity={item?.severity}
                  loading={!item?.title && isLoading}
                />
              </li>
            ))}
            {isLoading && issues.length === 0 && (
              <li>
                <FeedbackItem loading />
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}
