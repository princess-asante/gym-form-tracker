type Severity = "low" | "medium" | "high";

type BadgeProps = {
  severity: Severity;
};

const styles: Record<Severity, string> = {
  low: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300",
  medium:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-300",
};

const labels: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export default function Badge({ severity }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[severity]}`}
    >
      {labels[severity]}
    </span>
  );
}
