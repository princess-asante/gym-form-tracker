"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import Swal from "sweetalert2";
import { VideoFormFeedbackSchema } from "@/lib/schemas";
import FeedbackPanel from "@/components/organisms/FeedbackPanel";
import Button from "@/components/atoms/Button";
import VideoDropzone from "../molecules/VideoDropzone";

type Phase = "uploading" | "analyzing" | "idle";

export default function AnalyzeVideoForm() {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

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
      if (!fileContent) {
        throw new Error("No file to upload");
      }

      try {
        setPhase("uploading");

        // Step 1: Upload directly to Vercel Blob — bypasses the serverless payload limit entirely
        const { url: blobUrl } = await upload(fileContent.name, fileContent, {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
          contentType: fileContent.type,
        });

        // Step 2: Kick off analysis — return the streaming response for useObject to consume
        setPhase("analyzing");
        return fetch(input, {
          ...init,
          body: JSON.stringify({ blobUrl, mediaType: fileContent.type }),
        });
      } catch (err) {
        setPhase("idle");
        Swal.fire({
          icon: "error",
          title: "Upload failed",
          text: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        });
        throw err;
      }
    },
  });

  const isLoading = phase !== "idle";
  const canSubmit = file !== null && phase === "idle";
  const hasResult = object !== undefined;

  function handleAnalyze() {
    submit({});
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-4">
        <VideoDropzone
          file={file}
          onVideoChange={handleVideoChange}
          disabled={phase !== "idle"}
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
      </div>

      {(hasResult || isLoading) && (
        <FeedbackPanel feedback={object ?? {}} isLoading={isLoading} />
      )}
    </div>
  );
}
