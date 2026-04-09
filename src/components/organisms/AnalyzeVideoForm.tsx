"use client";

import { useRef, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
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

      setPhase("uploading");

      // Step 1: Get upload URL from our API
      const initiateRes = await fetch("/api/video-upload-route", {
        method: "POST",
        headers: {
          "X-Upload-Action": "initiate",
          "X-Mime-Type": fileContent?.type,
          "X-File-Size": String(fileContent?.size),
        },
      });

      if (!initiateRes.ok) {
        const error = await initiateRes.text();
        throw new Error(`Failed to initiate upload: ${error}`);
      }

      const { uploadUrl } = await initiateRes.json();

      // Step 2: Upload the file in a single chunk (for simplicity; ideally should handle chunking for large files)
      let offset = 0;
      let fileName: string | undefined;
      while (offset < fileContent.size) {
        const isFinalChunk = offset + fileContent.size >= fileContent.size;
        const chunkingRes = await fetch("/api/video-upload-route", {
          method: "POST",
          headers: {
            "X-Upload-Action": "chunk",
            "X-File-Size": String(fileContent.size),
            "X-Upload-URL": uploadUrl,
            "X-Upload-Offset": String(offset),
            "X-Final-Chunk": String(isFinalChunk),
          },
          body: fileContent.slice(offset, offset + fileContent.size),
        });

        if (!chunkingRes.ok) {
          const error = await chunkingRes.text();
          throw new Error(`Failed to upload chunk: ${error}`);
        }

        if (isFinalChunk) {
          const data = await chunkingRes.json();
          fileName = data.fileName;
        }

        offset += fileContent.size;
      }

      if (!fileName) {
        throw new Error("Upload completed but no fileName returned");
      }

      // Step 3: Kick off analysis — return the streaming response for useObject to consume
      setPhase("analyzing");
      return fetch(input, {
        ...init,
        body: JSON.stringify({ fileName, mediaType: fileContent.type }),
      });
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
