"use client";

import { useRef, useState, useEffect, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_VIDEOS = ["video/mp4", "video/quicktime"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGES, ...ACCEPTED_VIDEOS];

export type UploadDropzoneProps = {
  /** Data URL (images) or object URL (videos) — used only for the preview. */
  fileUrl: string | null;
  /** Fires with the base64 data URL and the raw File. Parent decides how to use each. */
  onFileChange: (dataUrl: string, file: File) => void;
  disabled?: boolean;
};

export default function UploadDropzone({
  fileUrl,
  onFileChange,
  disabled = false,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset video flag when parent clears the value
  useEffect(() => {
    if (!fileUrl) setIsVideo(false);
  }, [fileUrl]);

  const VIDEO_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB — Vercel Blob hard cap

  function processFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) return;

    // Derive synchronously — don't read isVideo state, it's stale here
    const asVideo = ACCEPTED_VIDEOS.includes(file.type);
    if (asVideo && file.size > VIDEO_SIZE_LIMIT) {
      setError(
        `Video is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum is 50 MB.`,
      );
      return;
    }

    setError(null);
    setIsVideo(asVideo);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onFileChange(e.target.result as string, file);
    };
    reader.readAsDataURL(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
      setError(null);
    }
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      className={[
        "relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed transition-colors overflow-hidden min-h-52",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-default",
        isDragging
          ? "border-zinc-500 bg-zinc-800"
          : "border-zinc-700 bg-zinc-900",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />

      {fileUrl ? (
        isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={fileUrl}
            controls
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <Image
            src={fileUrl}
            alt="Uploaded exercise footage"
            fill
            className="object-contain"
            unoptimized
          />
        )
      ) : (
        <div className="flex flex-col items-center gap-4 p-8 text-center pointer-events-none select-none">
          <div className="flex size-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
            <svg
              className="size-5 text-zinc-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-zinc-200">
              Drop your photo or video
            </p>
            <p className="text-xs text-zinc-500">
              JPEG · PNG · WebP · MP4 · MOV
            </p>
          </div>

          {error ? (
            <p className="pointer-events-none text-xs text-red-400 text-center">
              {error}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => !disabled && inputRef.current?.click()}
              disabled={disabled}
              className="pointer-events-auto rounded-full border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:border-zinc-600 disabled:cursor-not-allowed"
            >
              Browse files
            </button>
          )}
        </div>
      )}
    </div>
  );
}
