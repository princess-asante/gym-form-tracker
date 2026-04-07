"use client";

import { useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import Swal from "sweetalert2";
import { VideoFormFeedbackSchema } from "@/lib/schemas";
import VideoDropzone from "@/components/molecules/VideoDropzone";
import FeedbackPanel from "@/components/organisms/FeedbackPanel";
import Button from "@/components/atoms/Button";

type Phase = "idle" | "initiating" | "uploading" | "analysing";

export default function AnalyzeVideoForm() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  // Refs so the useObject fetch closure always reads the latest values
  // without going stale from the render where submit() was called.
  const fileRef = useRef<File | null>(null);
  const fileNameRef = useRef<string | null>(null);

  const { object, submit } = useObject({
    api: "/api/analyze-video",
    schema: VideoFormFeedbackSchema,
    // useObject normally sends its argument as a JSON body to the api URL.
    // We override fetch so we can run the upload steps first, then pass
    // the resulting fileName in the body instead of the raw file.
    fetch: async (input, init) => {
      const currentFile = fileRef.current!;

      // --- Phase 1: ask our server to open a Gemini upload session ---
      // Sends only {mimeType, size} — a tiny JSON request.
      // Our server calls Gemini with the API key (never exposed to the browser)
      // and returns a one-time upload URL.
      setPhase("initiating");
      const initiateRes = await fetch("/api/video-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mimeType: currentFile.type,
          size: currentFile.size,
        }),
      });

      if (!initiateRes.ok) {
        throw new Error("Failed to initiate upload");
      }

      const { uploadUrl } = (await initiateRes.json()) as {
        uploadUrl: string;
      };

      // --- Phase 2: upload the video bytes directly to Gemini ---
      // The upload URL already contains an embedded token — no API key needed.
      // The large video goes straight from the browser to Gemini, bypassing
      // our Next.js server entirely, so no FUNCTION_PAYLOAD_TOO_LARGE.
      setPhase("uploading");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(currentFile.size),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: currentFile,
      });

      if (!uploadRes.ok) {
        throw new Error("Video upload to Gemini failed");
      }

      // Gemini returns the file metadata once the upload is finalised.
      // We need the `name` (e.g. "files/abc123") so the analyse route can
      // poll for ACTIVE state and reference the file in the prompt.
      const { name: fileName } = (await uploadRes.json()) as {
        name: string;
        uri: string;
        state: string;
      };
      fileNameRef.current = fileName;

      // --- Phase 3: call the analyse route with just the file name ---
      // This request is tiny JSON — no payload problem.
      setPhase("analysing");
      return fetch(input as string, {
        ...init,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, mediaType: currentFile.type }),
      });
    },
    onFinish: () => setPhase("idle"),
    onError: (error) => {
      setPhase("idle");
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: error.message || "Something went wrong during analysis. Please try again.",
      });
      console.error("Analysis error:", error);
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
    fileNameRef.current = null;
  }

  const isLoading = phase !== "idle";
  const hasResult = !!object;
  const canSubmit = !!file && !isLoading;

  const buttonLabel =
    phase === "initiating"
      ? "Preparing…"
      : phase === "uploading"
        ? "Uploading…"
        : phase === "analysing"
          ? "Analysing…"
          : "Analyse form";

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
            {buttonLabel}
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
        <FeedbackPanel feedback={object ?? {}} isLoading={isLoading} />
      )}
    </div>
  );
}
