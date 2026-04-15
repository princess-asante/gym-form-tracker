"use client";

import { FIELD_MAX_LENGTHS } from "@/lib/constants";

interface Props {
  exercise: string;
  targetMuscles: string;
  trainingGoal: string;
  onExerciseChange: (v: string) => void;
  onMusclesChange: (v: string) => void;
  onTrainingGoalChange: (v: string) => void;
  disabled?: boolean;
}

function StepLabel({ step, title }: { step?: number; title: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
      {step !== undefined ? `Step ${step} — ` : ""}
      {title}
    </p>
  );
}

function FieldInput({
  placeholder,
  value,
  onChange,
  disabled,
  maxLength,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  maxLength?: number;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
    />
  );
}

export default function WorkoutSelector({
  exercise,
  targetMuscles,
  trainingGoal,
  onExerciseChange,
  onMusclesChange,
  onTrainingGoalChange,
  disabled,
}: Props) {
  return (
    <div className="flex flex-col divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="flex flex-col gap-1.5 px-4 py-3">
        <StepLabel step={2} title="What are you doing?" />
        <FieldInput
          placeholder="e.g. Bulgarian split squat, cable pull-through, sumo deadlift…"
          value={exercise}
          onChange={onExerciseChange}
          disabled={disabled}
          maxLength={FIELD_MAX_LENGTHS.exercise}
        />
      </div>

      <div className="flex flex-col gap-1.5 px-4 py-3">
        <StepLabel title="Target muscles" />
        <FieldInput
          placeholder="e.g. Glutes and hamstrings, rear delts, long head of the tricep…"
          value={targetMuscles}
          onChange={onMusclesChange}
          disabled={disabled}
          maxLength={FIELD_MAX_LENGTHS.targetMuscles}
        />
      </div>

      <div className="flex flex-col gap-1.5 px-4 py-3">
        <StepLabel title="Training goal" />
        <FieldInput
          placeholder="What are you training for?"
          value={trainingGoal}
          onChange={onTrainingGoalChange}
          disabled={disabled}
          maxLength={FIELD_MAX_LENGTHS.trainingGoal}
        />
      </div>
    </div>
  );
}

export type { Props as WorkoutSelectorProps };
