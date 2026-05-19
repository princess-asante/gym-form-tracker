"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/atoms/Button";
import { type Angles } from "@/lib/pose";

type Label = "good" | "bad";
type Phase = "idle" | "recording" | "recorded" | "uploading" | "done" | "error";
type BufferRow = Angles & { timestamp: number };

type Props = {
  angles: Angles;
  isSessionActive: boolean;
};

// Serialises the buffer into a CSV string.
// The label column is included in every row so concatenated CSVs stay self-contained.
const buildCsv = (rows: BufferRow[], label: Label): string => {
  const header = "label,timestamp_ms,lKnee,rKnee,lHip,rHip,lElbow,rElbow";
  const body = rows.map((row) =>
    [
      label,
      row.timestamp,
      row.lKnee  ?? "",
      row.rKnee  ?? "",
      row.lHip   ?? "",
      row.rHip   ?? "",
      row.lElbow ?? "",
      row.rElbow ?? "",
    ].join(","),
  );
  return [header, ...body].join("\n");
};

const AngleRecorder = ({ angles, isSessionActive }: Props) => {
  const [label, setLabel] = useState<Label | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [recordedFrames, setRecordedFrames] = useState(0);

  // Raw angle snapshots — a ref so appending never triggers re-renders.
  const buffer = useRef<BufferRow[]>([]);
  const startTime = useRef(0);
  // Generated once per mount — used as the rate-limit key on the server.
  const sessionId = useRef(crypto.randomUUID());

  // Append a snapshot every time angles updates while recording.
  useEffect(() => {
    if (phase !== "recording") return;
    buffer.current.push({
      timestamp: Math.round(performance.now() - startTime.current),
      ...angles,
    });
    setRecordedFrames(buffer.current.length);
  }, [angles, phase]);

  // If the session ends mid-recording, move to 'recorded' so data isn't silently lost.
  useEffect(() => {
    if (!isSessionActive && phase === "recording") setPhase("recorded");
  }, [isSessionActive, phase]);

  const startRecording = () => {
    buffer.current = [];
    startTime.current = performance.now();
    setRecordedFrames(0);
    setPhase("recording");
  };

  const stopRecording = () => setPhase("recorded");

  const discard = () => {
    buffer.current = [];
    setRecordedFrames(0);
    setLabel(null);
    setPhase("idle");
  };

  const downloadCsv = () => {
    if (!label) return;
    const csv = buildCsv(buffer.current, label);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `angles_${label}_${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadCsv = async () => {
    if (!label) return;
    setPhase("uploading");
    try {
      const res = await fetch("/api/upload-angles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId.current,
        },
        body: JSON.stringify({ csv: buildCsv(buffer.current, label), label }),
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        throw new Error(error);
      }

      setPhase("done");
    } catch {
      setPhase("error");
    }
  };

  const recordAnother = () => {
    buffer.current = [];
    setRecordedFrames(0);
    setLabel(null);
    setPhase("idle");
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Collect training data
      </p>

      {/* Label selector — shown in idle and after recording */}
      {(phase === "idle" || phase === "recorded") && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-400">How is your form?</p>
          <div className="flex gap-2">
            {(["good", "bad"] as Label[]).map((option) => (
              <button
                key={option}
                onClick={() => setLabel(option)}
                className={[
                  "flex-1 rounded-xl border py-2 text-sm font-medium capitalize transition-colors",
                  label === option
                    ? option === "good"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500 bg-red-500/10 text-red-400"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300",
                ].join(" ")}
              >
                {option === "good" ? "Good form" : "Bad form"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {phase === "idle" && (
          <Button
            disabled={!isSessionActive || !label}
            onClick={startRecording}
          >
            Record
          </Button>
        )}

        {phase === "recording" && (
          <>
            <Button onClick={stopRecording}>Stop recording</Button>
            <span className="text-sm tabular-nums text-zinc-400">
              {recordedFrames} frames
            </span>
          </>
        )}

        {phase === "recorded" && (
          <>
            <Button
              disabled={!label}
              onClick={uploadCsv}
            >
              Upload
            </Button>
            <Button onClick={downloadCsv}>
              Download
            </Button>
            <Button onClick={discard}>
              Discard
            </Button>
            <span className="text-sm tabular-nums text-zinc-400">
              {recordedFrames} frames
            </span>
          </>
        )}

        {phase === "uploading" && (
          <p className="text-sm text-zinc-400">Uploading…</p>
        )}

        {phase === "done" && (
          <>
            <p className="text-sm text-emerald-400">Uploaded — thank you!</p>
            <Button onClick={recordAnother}>Record another</Button>
          </>
        )}

        {phase === "error" && (
          <>
            <p className="text-sm text-red-400">Upload failed.</p>
            <Button onClick={uploadCsv}>Retry</Button>
            <Button onClick={discard}>Discard</Button>
          </>
        )}
      </div>
    </div>
  );
};

AngleRecorder.displayName = "AngleRecorder";

export default AngleRecorder;
