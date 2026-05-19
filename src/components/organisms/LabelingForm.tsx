"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Button from "@/components/atoms/Button";
import {
  CONNECTIONS,
  KEY_LANDMARKS,
  calcAngle,
  INITIAL_ANGLES,
  type Angles,
} from "@/lib/pose";
import { EXERCISES, MUSCLES, type Exercise, type Muscle } from "@/lib/constants";

// Lower than the live-stream threshold — still frames lack temporal tracking,
// so visibility scores are generally lower. We want to show what the model found.
const DRAW_THRESHOLD = 0.5;

const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js",
];

// One video frame extracted from the uploaded clip, with skeleton overlay already drawn in.
type ExtractedFrame = {
  dataUrl: string;
  angles: Angles;
  timestampMs: number;
};

type Label = "good" | "bad";
type Phase =
  | "idle"
  | "extracting"
  | "labeling"
  | "reviewed"
  | "uploading"
  | "done"
  | "error";

// Draws skeleton connections and landmark dots onto a canvas context.
// Identical to the drawing logic in LiveForm — applied here to still frames.
const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  lm: any[],
  w: number,
  h: number,
) => {
  ctx.strokeStyle = "#00ffaa";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#00ffaa";
  ctx.shadowBlur = 6;

  for (const [a, b] of CONNECTIONS) {
    const ptA = lm[a];
    const ptB = lm[b];
    if (ptA.visibility < DRAW_THRESHOLD || ptB.visibility < DRAW_THRESHOLD)
      continue;
    ctx.beginPath();
    ctx.moveTo(ptA.x * w, ptA.y * h);
    ctx.lineTo(ptB.x * w, ptB.y * h);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  for (let i = 0; i < lm.length; i++) {
    const pt = lm[i];
    if (pt.visibility < DRAW_THRESHOLD) continue;
    const isKey = KEY_LANDMARKS.has(i);
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, isKey ? 6 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isKey ? "#ff3366" : "#00ffaa";
    ctx.fill();
    if (isKey) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
};

// Use DRAW_THRESHOLD instead of the global VISIBILITY_THRESHOLD —
// still frames have lower per-landmark confidence than a live stream.
const computeAngles = (lm: any[]): Angles => ({
  lKnee:  calcAngle(lm[23], lm[25], lm[27], DRAW_THRESHOLD),
  rKnee:  calcAngle(lm[24], lm[26], lm[28], DRAW_THRESHOLD),
  lHip:   calcAngle(lm[11], lm[23], lm[25], DRAW_THRESHOLD),
  rHip:   calcAngle(lm[12], lm[24], lm[26], DRAW_THRESHOLD),
  lElbow: calcAngle(lm[11], lm[13], lm[15], DRAW_THRESHOLD),
  rElbow: calcAngle(lm[12], lm[14], lm[16], DRAW_THRESHOLD),
});

// Skipped frames (null labels) are excluded — they contribute no training signal.
// exercise and muscles travel in every row so concatenated CSVs stay self-contained.
// Muscles are pipe-separated ("Quads|Glutes") to avoid clashing with the CSV comma delimiter.
const buildCsv = (
  frames: ExtractedFrame[],
  labels: (Label | null)[],
  exercise: string,
  muscles: Muscle[],
  name: string,
): string => {
  const header = "name,exercise,muscles,label,timestamp_ms,lKnee,rKnee,lHip,rHip,lElbow,rElbow";
  const rows = frames
    .map((f, i) => ({ frame: f, label: labels[i] }))
    .filter(({ label }) => label !== null)
    .map(({ frame, label }) =>
      [
        name,
        exercise,
        Array.isArray(muscles) ? muscles.join("|") : "",
        label,
        frame.timestampMs,
        frame.angles.lKnee  ?? "",
        frame.angles.rKnee  ?? "",
        frame.angles.lHip   ?? "",
        frame.angles.rHip   ?? "",
        frame.angles.lElbow ?? "",
        frame.angles.rElbow ?? "",
      ].join(","),
    );
  return [header, ...rows].join("\n");
};

const ANGLE_CARDS = [
  { key: "lKnee" as const, label: "L Knee" },
  { key: "rKnee" as const, label: "R Knee" },
  { key: "lHip" as const, label: "L Hip" },
  { key: "rHip" as const, label: "R Hip" },
  { key: "lElbow" as const, label: "L Elbow" },
  { key: "rElbow" as const, label: "R Elbow" },
];

const LabelingForm = () => {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [name, setName] = useState("");
  const [exercise, setExercise] = useState<Exercise | "">("");
  const [muscles, setMuscles] = useState<Muscle[]>([]);

  const toggleMuscle = (muscle: Muscle) =>
    setMuscles((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(muscle) ? arr.filter((m) => m !== muscle) : [...arr, muscle];
    });
  const [phase, setPhase] = useState<Phase>("idle");
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [labels, setLabels] = useState<(Label | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadedCount = useRef(0);
  const poseRef = useRef<any>(null);
  // Holds the resolve function for whichever frame is currently being processed.
  // onResults fires, calls it, then nulls it — one-to-one with each pose.send().
  const resolveResultsRef = useRef<((results: any) => void) | null>(null);
  const sessionId = useRef(crypto.randomUUID());

  const handleScriptLoad = () => {
    loadedCount.current += 1;
    if (loadedCount.current === MEDIAPIPE_SCRIPTS.length)
      setScriptsLoaded(true);
  };

  // Initialise MediaPipe once all three scripts have loaded.
  // smoothLandmarks is off — we're processing isolated still frames, not a stream.
  useEffect(() => {
    if (!scriptsLoaded) return;
    const pose = new (window as any).Pose({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: false,
      enableSegmentation: false,
      minDetectionConfidence: 0.4,
      minTrackingConfidence: 0.4,
    });
    pose.onResults((results: any) => {
      resolveResultsRef.current?.(results);
      resolveResultsRef.current = null;
    });
    pose.initialize().then(() => {
      poseRef.current = pose;
    });
  }, [scriptsLoaded]);

  // Wraps pose.send() in a Promise so frame extraction can be written sequentially.
  // Converts to ImageBitmap first — a cleaner pixel representation that MediaPipe
  // handles more reliably than a raw canvas on isolated still frames.
  const getPoseResults = async (canvas: HTMLCanvasElement): Promise<any> => {
    const bitmap = await createImageBitmap(canvas);
    return new Promise((resolve) => {
      resolveResultsRef.current = resolve;
      poseRef.current.send({ image: bitmap });
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !poseRef.current) return;

    setPhase("extracting");
    setProgress(0);

    // Create a temporary video element for scrubbing — not attached to the DOM.
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.muted = true;
    await new Promise<void>((resolve) =>
      video.addEventListener("loadedmetadata", () => resolve(), { once: true }),
    );

    const canvas = document.createElement("canvas");
    const timestamps: number[] = [];
    for (let t = 0; t < video.duration; t += 2) timestamps.push(t);

    const extracted: ExtractedFrame[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      // Seeking is async — we must wait for 'seeked' before reading the frame.
      video.currentTime = timestamps[i];
      await new Promise<void>((resolve) =>
        video.addEventListener("seeked", () => resolve(), { once: true }),
      );

      // Re-acquire context after each resize — setting canvas.width resets
      // the canvas state and can leave a previously obtained ctx stale.
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);

      const results = await getPoseResults(canvas);

      if (results.poseLandmarks) {
        drawOverlay(ctx, results.poseLandmarks, canvas.width, canvas.height);
      }

      extracted.push({
        dataUrl: canvas.toDataURL("image/jpeg", 0.85),
        angles: results.poseLandmarks
          ? computeAngles(results.poseLandmarks)
          : INITIAL_ANGLES,
        timestampMs: Math.round(timestamps[i] * 1000),
      });

      setProgress(Math.round(((i + 1) / timestamps.length) * 100));
    }

    URL.revokeObjectURL(video.src);
    setFrames(extracted);
    setLabels(extracted.map(() => null));
    setCurrentIndex(0);
    setPhase("labeling");
  };

  const handleLabel = (label: Label) => {
    const updated = [...labels];
    updated[currentIndex] = label;
    setLabels(updated);

    if (currentIndex < frames.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setPhase("reviewed");
    }
  };

  const handleSkip = () => {
    if (currentIndex < frames.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setPhase("reviewed");
    }
  };

  const uploadCsv = async () => {
    setPhase("uploading");
    try {
      const res = await fetch("/api/upload-angles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId.current,
        },
        body: JSON.stringify({
          csv: buildCsv(frames, labels, exercise, muscles, name),
          label: "mixed",
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        throw new Error(error);
      }
      setPhase("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  };

  const downloadCsv = () => {
    const csv = buildCsv(frames, labels, exercise, muscles, name);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `labeled_${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFrames([]);
    setLabels([]);
    setCurrentIndex(0);
    setPhase("idle");
    setErrorMessage(null);
  };

  const currentFrame = frames[currentIndex];
  const goodCount = labels.filter((l) => l === "good").length;
  const badCount = labels.filter((l) => l === "bad").length;
  const skippedCount = labels.filter((l) => l === null).length;

  return (
    <>
      {MEDIAPIPE_SCRIPTS.map((src) => (
        <Script
          key={src}
          src={src}
          strategy="afterInteractive"
          onLoad={handleScriptLoad}
        />
      ))}

      <div className="flex flex-col gap-6 w-full">
        {phase === "idle" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-400">
              Select a workout video. Frames are extracted every 2 seconds and
              shown one by one for labeling.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Exercise
                </label>
                <select
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value as Exercise | "")}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                >
                  <option value="">Select exercise…</option>
                  {EXERCISES.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Muscles targeted{" "}
                  <span className="normal-case tracking-normal text-zinc-600">
                    (optional)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {MUSCLES.map((muscle) => (
                    <button
                      key={muscle}
                      type="button"
                      onClick={() => toggleMuscle(muscle)}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        muscles.includes(muscle)
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                          : "border-zinc-700 text-zinc-500 hover:text-zinc-300",
                      ].join(" ")}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label
              className={[
                "flex items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 py-10 cursor-pointer transition-colors",
                scriptsLoaded && exercise.trim()
                  ? "hover:border-zinc-500"
                  : "opacity-50 cursor-not-allowed",
              ].join(" ")}
            >
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={!scriptsLoaded || !exercise.trim()}
                onChange={handleFileChange}
              />
              <span className="text-sm text-zinc-500">
                {!scriptsLoaded
                  ? "Loading model…"
                  : !exercise.trim()
                    ? "Enter exercise name first"
                    : "Choose video"}
              </span>
            </label>
          </div>
        )}

        {phase === "extracting" && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Extracting frames
            </p>
            <div className="h-2 w-full rounded-full bg-zinc-800">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm tabular-nums text-zinc-400">{progress}%</p>
              <button
                onClick={reset}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {phase === "labeling" && currentFrame && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Label frames
              </p>
              <span className="text-xs tabular-nums text-zinc-500">
                {currentIndex + 1} / {frames.length}
              </span>
            </div>

            <div className="relative rounded-2xl border border-zinc-800 overflow-hidden aspect-video bg-zinc-900">
              <img
                src={currentFrame.dataUrl}
                alt={`Frame at ${currentFrame.timestampMs}ms`}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs text-zinc-400">
                {(currentFrame.timestampMs / 1000).toFixed(1)}s
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ANGLE_CARDS.map(({ key, label }) => {
                const value = currentFrame.angles[key];
                return (
                  <div
                    key={key}
                    className="flex flex-col items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 py-3"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                      {label}
                    </span>
                    <span
                      className={`font-mono text-lg font-semibold tabular-nums ${
                        value === null
                          ? "text-zinc-600"
                          : value < 90
                            ? "text-red-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {value === null ? "—" : `${value}°`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleLabel("good")}
                className="rounded-xl border border-emerald-500 bg-emerald-500/10 py-4 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Good form
              </button>
              <button
                onClick={() => handleLabel("bad")}
                className="rounded-xl border border-red-500 bg-red-500/10 py-4 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
              >
                Bad form
              </button>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip this frame
              </button>
              <button
                onClick={reset}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {phase === "reviewed" && (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Labeling complete
            </p>
            <div className="flex gap-3 text-sm flex-wrap">
              <span className="text-emerald-400">{goodCount} good</span>
              <span className="text-zinc-600">·</span>
              <span className="text-red-400">{badCount} bad</span>
              {skippedCount > 0 && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-500">{skippedCount} skipped</span>
                </>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={uploadCsv}>Upload</Button>
              <Button onClick={downloadCsv}>Download CSV</Button>
              <Button onClick={reset}>Start over</Button>
            </div>
          </div>
        )}

        {phase === "uploading" && (
          <p className="text-sm text-zinc-400">Uploading…</p>
        )}

        {phase === "done" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-emerald-400">Uploaded — thank you!</p>
            <Button onClick={reset}>Label another video</Button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-red-400">
              {errorMessage ?? "Something went wrong."}
            </p>
            <div className="flex gap-3">
              <Button onClick={uploadCsv}>Retry upload</Button>
              <Button onClick={downloadCsv}>Download CSV instead</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

LabelingForm.displayName = "LabelingForm";

export default LabelingForm;
