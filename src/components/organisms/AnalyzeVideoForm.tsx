"use client";

import { useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import Swal from "sweetalert2";
import { VideoFormFeedbackSchema } from "@/lib/schemas";
import VideoDropzone from "@/components/molecules/VideoDropzone";
import FeedbackPanel from "@/components/organisms/FeedbackPanel";
import Button from "@/components/atoms/Button";

type Phase = "idle" | "uploading" | "analysing";

export default function AnalyzeVideoForm() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  // Ref so the custom fetch closure always sees the latest file without
  // becoming a stale capture from the render where submit() was called.
  const fileRef = useRef<File | null>(null);

  const { object, submit } = useObject({
    api: "/api/analyze-video",
    schema: VideoFormFeedbackSchema,
    // Override the default JSON fetch so we can send multipart/form-data
    // and track the two-phase loading state.
    fetch: async (input) => {
      setPhase("uploading");
      const formData = new FormData();
      formData.append("video", fileRef.current!);
      const res = await fetch(input as string, {
        method: "POST",
        body: formData,
      });
      setPhase("analysing");
      return res;
    },
    onFinish: () => setPhase("idle"),
    onError: (error) => {
      setPhase("idle");
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text:
          error.message ||
          "Something went wrong during analysis. Please try again.",
      });
    },
  });

  function handleVideoChange(f: File) {
    setFile(f);
    fileRef.current = f;
  }

  function handleAnalyze() {
    if (!file) return;
    submit({});
  }

  function handleClear() {
    setFile(null);
    fileRef.current = null;
  }

  const isLoading = phase !== "idle";
  const hasResult = !!object;
  const canSubmit = !!file && !isLoading;

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-4">
        <VideoDropzone
          file={file}
          onVideoChange={handleVideoChange}
          disabled={isLoading}
        />

        <div className="flex items-center gap-3">
          <Button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            loading={isLoading}
            className="w-full"
          >
            {phase === "uploading"
              ? "Uploading…"
              : phase === "analysing"
                ? "Analysing…"
                : "Analyse form"}
          </Button>

          {file && !isLoading && (
            <Button
              variant="ghost"
              onClick={handleClear}
              aria-label="Remove video"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {(hasResult || isLoading) && (
        <FeedbackPanel
          feedback={object ?? {}}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
