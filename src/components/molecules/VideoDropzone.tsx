"use client";

import { useRef, useState, useEffect, DragEvent, ChangeEvent } from "react";

type VideoDropzoneProps = {
  file: File | null;
  onVideoChange: (file: File) => void;
  disabled?: boolean;
};

export default function VideoDropzone({
  file,
  onVideoChange,
  disabled = false,
}: VideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onVideoChange(f);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (
      f &&
      (f.type === "video/mp4" ||
        f.type === "video/webm" ||
        f.type === "video/quicktime")
    ) {
      onVideoChange(f);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload a video"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) =>
        e.key === "Enter" && !disabled && inputRef.current?.click()
      }
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      className={[
        "relative flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed transition-colors overflow-hidden",
        "min-h-72",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isDragging
          ? "border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-800"
          : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />

      {previewUrl ? (
        // Clicking the video controls shouldn't bubble up to the dropzone
        // and re-open the file picker.
        <video
          src={previewUrl}
          controls
          className="w-full h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex flex-col items-center gap-3 p-8 text-center pointer-events-none select-none">
          <div className="flex size-12 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
            <svg
              className="size-6 text-zinc-500 dark:text-zinc-400"
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
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Drop a video here, or click to browse
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              MP4, WebM, or MOV
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
