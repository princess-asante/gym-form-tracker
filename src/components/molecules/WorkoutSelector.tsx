"use client";

import { EXERCISES, MUSCLES, type Exercise, type Muscle } from "@/lib/constants";
export type { Exercise, Muscle } from "@/lib/constants";

interface Props {
  exercise: Exercise | "";
  targetMuscles: Muscle[];
  onExerciseChange: (value: Exercise | "") => void;
  onMusclesChange: (muscles: Muscle[]) => void;
  disabled?: boolean;
}

export default function WorkoutSelector({
  exercise,
  targetMuscles,
  onExerciseChange,
  onMusclesChange,
  disabled,
}: Props) {
  const toggleMuscle = (muscle: Muscle) => {
    onMusclesChange(
      targetMuscles.includes(muscle)
        ? targetMuscles.filter((m) => m !== muscle)
        : [...targetMuscles, muscle],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700" htmlFor="exercise">
          Exercise <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <select
          id="exercise"
          value={exercise}
          onChange={(e) => onExerciseChange(e.target.value as Exercise | "")}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
        >
          <option value="">Select an exercise…</option>
          {EXERCISES.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-gray-700">
          Target muscles <span className="text-gray-400 font-normal">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.map((muscle) => {
            const selected = targetMuscles.includes(muscle);
            return (
              <button
                key={muscle}
                type="button"
                onClick={() => toggleMuscle(muscle)}
                disabled={disabled}
                className={`rounded-full px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                  selected
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {muscle}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
