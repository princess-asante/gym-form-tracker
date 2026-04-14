import { DeepPartial } from 'ai'
import { FormFeedback } from '@/lib/schemas'

type FeedbackPanelProps = {
  feedback: DeepPartial<FormFeedback>
  isLoading: boolean
  onClose?: () => void
}

function sectionLabel(text: string) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
      {text}
    </p>
  )
}

function scoreRingColor(score: number): string {
  if (score >= 8) return 'ring-emerald-400 text-emerald-400'
  if (score >= 5) return 'ring-amber-400 text-amber-400'
  return 'ring-red-400 text-red-400'
}

export default function FeedbackPanel({ feedback, isLoading, onClose }: FeedbackPanelProps) {
  const positives = feedback.positives ?? []
  const issues = feedback.issues ?? []

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
        <span className="size-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold text-zinc-100">Your Feedback</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-zinc-800">

        {/* Form Score */}
        <section className="px-5 py-4 flex flex-col gap-3">
          {sectionLabel('Form Score')}
          <div className="flex items-center gap-4">
            {/* Score ring */}
            {feedback.score !== undefined ? (
              <div className={`shrink-0 flex size-16 items-center justify-center rounded-full ring-2 ${scoreRingColor(feedback.score)}`}>
                <span className="text-2xl font-bold">{feedback.score}</span>
              </div>
            ) : (
              <div className="shrink-0 size-16 rounded-full ring-2 ring-zinc-700 animate-pulse bg-zinc-800" />
            )}

            {/* Overall assessment */}
            {feedback.overallAssessment ? (
              <p className="text-sm text-zinc-300 leading-relaxed">
                {feedback.overallAssessment}
              </p>
            ) : (
              <div className="flex-1 flex flex-col gap-1.5 animate-pulse">
                <div className="h-3 w-full rounded bg-zinc-800" />
                <div className="h-3 w-4/5 rounded bg-zinc-800" />
              </div>
            )}
          </div>
        </section>

        {/* Breakdown */}
        {(positives.length > 0 || issues.length > 0 || isLoading) && (
          <section className="px-5 py-4 flex flex-col gap-3">
            {sectionLabel('Breakdown')}
            <ul className="flex flex-col gap-2.5">
              {positives.map((item, i) => (
                <li key={`pos-${i}`} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {item?.description ?? (
                      <span className="inline-block h-3 w-48 rounded bg-zinc-800 animate-pulse" />
                    )}
                  </p>
                </li>
              ))}
              {issues.map((item, i) => (
                <li key={`iss-${i}`} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {item?.description ?? (
                      <span className="inline-block h-3 w-48 rounded bg-zinc-800 animate-pulse" />
                    )}
                  </p>
                </li>
              ))}
              {isLoading && positives.length === 0 && issues.length === 0 && (
                <>
                  {[1, 2].map((n) => (
                    <li key={n} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-zinc-700 animate-pulse" aria-hidden="true" />
                      <div className="flex-1 h-3 rounded bg-zinc-800 animate-pulse" />
                    </li>
                  ))}
                </>
              )}
            </ul>
          </section>
        )}

        {/* Top cue */}
        {(feedback.topCue || isLoading) && (
          <section className="px-5 py-4 flex flex-col gap-3">
            {sectionLabel('One cue to fix right now')}
            <div className="rounded-xl bg-zinc-800 px-4 py-3 flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Coaching Cue
              </p>
              {feedback.topCue ? (
                <p className="text-sm text-zinc-200 leading-relaxed">{feedback.topCue}</p>
              ) : (
                <div className="flex flex-col gap-1.5 animate-pulse">
                  <div className="h-3 w-full rounded bg-zinc-700" />
                  <div className="h-3 w-4/5 rounded bg-zinc-700" />
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
