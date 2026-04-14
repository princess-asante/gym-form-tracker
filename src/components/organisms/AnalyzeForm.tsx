"use client";

import { useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { upload } from "@vercel/blob/client";
import { FormFeedbackSchema, VideoFormFeedbackSchema } from "@/lib/schemas";
import UploadDropzone from "@/components/molecules/UploadDropzone";
import FeedbackPanel from "@/components/organisms/FeedbackPanel";
import Button from "@/components/atoms/Button";
import WorkoutSelector from "@/components/molecules/WorkoutSelector";
import { logger } from "@/lib/logger";

// ─── local atoms ─────────────────────────────────────────────────────────────

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
      Step {step} — {title}
    </p>
  );
}

function FeedbackPreview() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="size-1.5 rounded-full bg-zinc-500 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-sm text-zinc-400">See what feedback looks like</span>
        <span className="text-xs font-medium text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <div className="rounded-lg bg-zinc-800 px-3 py-2.5 flex flex-col gap-1">
            <p className="text-xs font-semibold text-emerald-400">Good: Hip hinge depth</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your hip hinge depth is correct — hips are tracking behind your heels at the bottom.
            </p>
          </div>
          <div className="rounded-lg bg-zinc-800 px-3 py-2.5 flex flex-col gap-1">
            <p className="text-xs font-semibold text-amber-400">Fix: Knee cave on left side</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Your left knee is collapsing inward during the concentric. Cue: drive your knee out over your pinky toe.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main form ───────────────────────────────────────────────────────────────

type UploadPhase = "idle" | "uploading" | "analyzing";

export default function AnalyzeForm() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  // Ref keeps the video fetch closure from capturing a stale file value
  const fileRef = useRef<File | null>(null);

  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [showFeedback, setShowFeedback] = useState(false);
  const [exercise, setExercise] = useState("");
  const [targetMuscles, setTargetMuscles] = useState("");
  const [trainingGoal, setTrainingGoal] = useState("");

  const isVideo = file?.type.startsWith("video/") ?? false;

  // ── photo path ──────────────────────────────────────────────────────────
  const {
    object: photoObject,
    isLoading: photoLoading,
    submit: submitPhoto,
  } = useObject({
    api: "/api/analyze-photo",
    schema: FormFeedbackSchema,
    onError: (err) => logger.error("photo analysis failed", { message: err.message }),
  });

  // ── video path ──────────────────────────────────────────────────────────
  const { object: videoObject, submit: submitVideo } = useObject({
    api: "/api/analyze-video",
    schema: VideoFormFeedbackSchema,
    onFinish: () => setUploadPhase("idle"),
    onError: (err) => {
      setUploadPhase("idle");
      logger.error("video analysis failed", { message: err.message });
    },
    fetch: async (input, init) => {
      const f = fileRef.current;
      if (!f) throw new Error("No file queued for upload");

      setUploadPhase("uploading");
      const { url: blobUrl } = await upload(`${Date.now()}-${f.name}`, f, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        contentType: f.type,
      });

      setUploadPhase("analyzing");
      const res = await fetch(input, {
        ...init,
        body: JSON.stringify({
          blobUrl,
          mediaType: f.type,
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
    },
  });

  // ── derived state ────────────────────────────────────────────────────────
  const isLoading = photoLoading || uploadPhase !== "idle";
  const activeObject = isVideo ? videoObject : photoObject;
  const hasResult = !!activeObject;

  const ctaLabel = isLoading
    ? uploadPhase === "uploading"
      ? "Uploading…"
      : "Checking…"
    : "Check my form";

  // ── handlers ─────────────────────────────────────────────────────────────
  function handleFileChange(dataUrl: string, f: File) {
    setFileUrl(dataUrl);
    setFile(f);
    fileRef.current = f;
  }

  function handleClear() {
    setFileUrl(null);
    setFile(null);
    fileRef.current = null;
  }

  function handleAnalyze() {
    if (!fileUrl || !file) return;
    setShowFeedback(true);

    if (isVideo) {
      submitVideo({});
    } else {
      submitPhoto({
        image: fileUrl,
        exercise: exercise || undefined,
        targetMuscles: targetMuscles
          ? targetMuscles.split(",").map((m) => m.trim()).filter(Boolean)
          : undefined,
        trainingGoal: trainingGoal || undefined,
      });
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 w-full">
      <FeedbackPreview />

      <div className="flex flex-col gap-2">
        <StepLabel step={1} title="Your footage" />
        <UploadDropzone
          fileUrl={fileUrl}
          onFileChange={handleFileChange}
          disabled={isLoading}
        />
      </div>

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
          onClick={handleAnalyze}
          disabled={!fileUrl || isLoading}
          loading={isLoading}
          className="w-full"
        >
          {ctaLabel}
        </Button>

        {fileUrl && !isLoading && (
          <Button variant="ghost" onClick={handleClear} aria-label="Remove file">
            Clear
          </Button>
        )}
      </div>

      {showFeedback && (hasResult || isLoading) && (
        <FeedbackPanel
          feedback={activeObject ?? {}}
          isLoading={isLoading}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}
