export const FIELD_MAX_LENGTHS = {
  exercise: 100,
  targetMuscles: 100,
  trainingGoal: 150,
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