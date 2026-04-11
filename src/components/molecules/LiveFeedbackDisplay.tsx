import { LiveFeedback } from "@/lib/schemas";
import Badge from "@/components/atoms/Badge";

type LiveFeedbackDisplayProps = {
  feedback: LiveFeedback | undefined;
};

const borderBySeverity = {
  high: "border-red-500",
  medium: "border-amber-500",
  low: "border-blue-400",
};

const LiveFeedbackDisplay = ({ feedback }: LiveFeedbackDisplayProps) => {
  if (!feedback) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center">
        No feedback yet
      </p>
    );
  }

  const { recognised, cues, positive } = feedback;

  if (!recognised) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center">
        No exercise detected — get into position to receive feedback
      </p>
    );
  }

  const hasCues = cues.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {hasCues &&
        cues.map((cue, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 border-l-2 pl-3 py-1 ${borderBySeverity[cue.severity]}`}
          >
            <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
              {cue.text}
            </p>
            <Badge severity={cue.severity} />
          </div>
        ))}

      {positive && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {positive}
        </p>
      )}
    </div>
  );
};

LiveFeedbackDisplay.displayName = "LiveFeedbackDisplay";

export default LiveFeedbackDisplay;
