export const FIELD_MAX_LENGTHS = {
  exercise: 10,
  targetMuscles: 10,
  trainingGoal: 10,
} as const;

export const EXERCISES = [
  "Squat",
  "Deadlift",
  "Bench Press",
  "Overhead Press",
  "Barbell Row",
  "Romanian Deadlift",
  "Pull-up",
  "Hip Thrust",
  "Lunge",
] as const;

export const MUSCLES = [
  "Quads",
  "Hamstrings",
  "Glutes",
  "Lower back",
  "Upper back",
  "Chest",
  "Shoulders",
  "Triceps",
  "Biceps",
  "Core",
  "Calves",
] as const;

export type Exercise = (typeof EXERCISES)[number];
export type Muscle = (typeof MUSCLES)[number];
