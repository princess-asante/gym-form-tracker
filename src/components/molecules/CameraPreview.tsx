"use client";

import { forwardRef, useEffect } from "react";

type CameraPreviewProps = {
  stream: MediaStream | null;
  permissionError: boolean;
};

const CameraPreview = forwardRef<HTMLVideoElement, CameraPreviewProps>(
  ({ stream, permissionError }, ref) => {
    useEffect(() => {
      const video = (ref as React.RefObject<HTMLVideoElement>).current;
      if (!video) return;
      video.srcObject = stream;
      if (stream) video.play().catch(() => {});
    }, [stream, ref]);

    const containerClass =
      "relative flex items-center justify-center w-full min-h-72 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900";

    if (permissionError) {
      return (
        <div className={containerClass}>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="size-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Camera access denied
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Check your browser permissions and try again.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (!stream) {
      return (
        <div className={containerClass}>
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
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M9 12.75l2.25 2.25 4.5-4.5M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375v11.25C1.5 18.66 2.34 19.5 3.375 19.5h17.25c1.035 0 1.875-.84 1.875-1.875V6.375C22.5 5.34 21.66 4.5 20.625 4.5H3.375z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Camera preview will appear here
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={containerClass}>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-medium text-white">Live</span>
        </div>

        {/* CSS mirror so the user sees themselves as in a mirror.
            canvas.drawImage is unaffected by CSS transforms — the raw
            unmirrored frame is what gets sent to the model. */}
        <video
          ref={ref}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>
    );
  },
);

CameraPreview.displayName = "CameraPreview";

export default CameraPreview;
