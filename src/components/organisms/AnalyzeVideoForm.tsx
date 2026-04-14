"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { VideoFormFeedbackSchema } from "@/lib/schemas";
import FeedbackPanel from "@/components/organisms/FeedbackPanel";
import Button from "@/components/atoms/Button";
import VideoDropzone from "../molecules/VideoDropzone";
import WorkoutSelector from "@/components/molecules/WorkoutSelector";

type Phase = "uploading" | "analyzing" | "idle";

export default function AnalyzeVideoForm() {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [exercise, setExercise] = useState("");
  const [targetMuscles, setTargetMuscles] = useState("");
  const [trainingGoal, setTrainingGoal] = useState("");

  function handleVideoChange(f: File) {
    setFile(f);
    fileRef.current = f;
  }

  const { object, submit } = useObject({
    api: "/api/analyze-video",
    schema: VideoFormFeedbackSchema,
    onFinish: () => setPhase("idle"),
    onError: () => setPhase("idle"),
    fetch: async (input, init) => {
      const fileContent = fileRef.current;
      if (!fileContent) throw new Error("No file to upload");

      try {
        setPhase("uploading");
        const { url: blobUrl } = await upload(
          `${Date.now()}-${fileContent.name}`,
          fileContent,
          {
            access: "public",
            handleUploadUrl: "/api/blob-upload",
            contentType: fileContent.type,
          }
        );

        setPhase("analyzing");
        const res = await fetch(input, {
          ...init,
          body: JSON.stringify({
            blobUrl,
            mediaType: fileContent.type,
            exercise: exercise || undefined,
            targetMuscles: targetMuscles
              ? targetMuscles.split(",").map((m) => m.trim()).filter(Boolean)
              : undefined,
            trainingGoal: trainingGoal || undefined,
          }),
        });

        if (!res.ok) {
          const { error } = (await res.json()) as { error: string };
          throw new Error(error);
        }
        return res;
      } catch (err) {
        setPhase("idle");
        setFile(null);
        fileRef.current = null;
        throw err;
      }
    },
  });

  const isLoading = phase !== "idle";
  const canSubmit = file !== null && phase === "idle";
  const hasResult = object !== undefined;

  return (
    <div className="flex flex-col gap-5 w-full">
      <VideoDropzone
        file={file}
        onVideoChange={handleVideoChange}
        disabled={phase !== "idle"}
      />

      <WorkoutSelector
        exercise={exercise}
        targetMuscles={targetMuscles}
        trainingGoal={trainingGoal}
        onExerciseChange={setExercise}
        onMusclesChange={setTargetMuscles}
        onTrainingGoalChange={setTrainingGoal}
        disabled={isLoading}
      />

      <div className="flex items-center gap-3">
        <Button
          variant="indigo"
          onClick={() => submit({})}
          disabled={!canSubmit}
          loading={isLoading}
          className="w-full"
        >
          {isLoading
            ? phase === "uploading"
              ? "Uploading…"
              : "Checking…"
            : "Check my form"}
        </Button>

        {file && phase === "idle" && (
          <Button
            variant="ghost"
            onClick={() => {
              setFile(null);
              fileRef.current = null;
            }}
            aria-label="Remove video"
          >
            Clear
          </Button>
        )}
      </div>

      {(hasResult || isLoading) && (
        <FeedbackPanel feedback={object ?? {}} isLoading={isLoading} />
      )}
    </div>
  );
}
