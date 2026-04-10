"use client";

import { useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import Swal from "sweetalert2";
import { FormFeedbackSchema } from "@/lib/schemas";
import ImageDropzone from "@/components/molecules/ImageDropzone";
import FeedbackPanel from "@/components/organisms/FeedbackPanel";
import Button from "@/components/atoms/Button";
import WorkoutSelector, { type Exercise, type Muscle } from "@/components/molecules/WorkoutSelector";

export default function AnalyzeForm() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [exercise, setExercise] = useState<Exercise | "">("");
  const [targetMuscles, setTargetMuscles] = useState<Muscle[]>([]);

  const { object, isLoading, submit } = useObject({
    api: "/api/analyze-photo",
    schema: FormFeedbackSchema,
    onError: (error) => {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text:
          error.message ||
          "Something went wrong during analysis. Please try again.",
      });
    },
  });

  const handleAnalyze = () => {
    if (!imageUrl) return;
    submit({
      image: imageUrl,
      exercise: exercise || undefined,
      targetMuscles: targetMuscles.length ? targetMuscles : undefined,
    });
  };

  const hasResult = !!object;
  const canSubmit = !!imageUrl && !isLoading;

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-4">
        <ImageDropzone
          imageUrl={imageUrl}
          onImageChange={setImageUrl}
          disabled={isLoading}
        />

        <WorkoutSelector
          exercise={exercise}
          targetMuscles={targetMuscles}
          onExerciseChange={setExercise}
          onMusclesChange={setTargetMuscles}
          disabled={isLoading}
        />

        <div className="flex items-center gap-3">
          <Button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            loading={isLoading}
            className="w-full"
          >
            {isLoading ? "Analysing…" : "Analyse form"}
          </Button>

          {imageUrl && !isLoading && (
            <Button
              variant="ghost"
              onClick={() => setImageUrl(null)}
              aria-label="Remove image"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {(hasResult || isLoading) && (
        <FeedbackPanel feedback={object ?? {}} isLoading={isLoading} />
      )}
    </div>
  );
}
