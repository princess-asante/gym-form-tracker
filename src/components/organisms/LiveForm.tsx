"use client";

import { useRef, useState, useEffect } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { LiveFeedbackSchema, type LiveFeedback } from "@/lib/schemas";
import CameraPreview from "@/components/molecules/CameraPreview";
import LiveFeedbackDisplay from "@/components/molecules/LiveFeedbackDisplay";
import WorkoutSelector, {
  type Exercise,
  type Muscle,
} from "@/components/molecules/WorkoutSelector";
import Button from "@/components/atoms/Button";

const CAPTURE_INTERVAL_MS = 5000;

const LiveForm = () => {
  // --- state ---
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [displayFeedback, setDisplayFeedback] = useState<
    LiveFeedback | undefined
  >(undefined);
  const [exercise, setExercise] = useState<Exercise | "">("");
  const [targetMuscles, setTargetMuscles] = useState<Muscle[]>([]);
  const [stopReason, setStopReason] = useState<string | null>(null);

  // --- refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const isAnalysingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unrecognisedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- AI ---
  const { submit } = useObject({
    api: "/api/analyze-stream",
    schema: LiveFeedbackSchema,
    onFinish: ({ object }) => {
      if (object) {
        setDisplayFeedback(object);
        if (object.recognised) {
          // Exercise detected — cancel any pending unrecognised timeout
          if (unrecognisedTimeoutRef.current) {
            clearTimeout(unrecognisedTimeoutRef.current);
            unrecognisedTimeoutRef.current = null;
          }
        } else if (!unrecognisedTimeoutRef.current) {
          // Start the 30s clock only if one isn't already running
          unrecognisedTimeoutRef.current = setTimeout(() => {
            setStopReason("We couldn't recognise a workout. Stopping live session.");
            stopSession();
          }, 30_000);
        }
      }
      isAnalysingRef.current = false;
    },
    onError: () => {
      isAnalysingRef.current = false;
    },
  });

  // --- session control ---
  const startSession = async () => {
    setPermissionError(false);
    setStopReason(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      setStream(mediaStream);
      setIsSessionActive(true);
    } catch {
      setPermissionError(true);
    }
  };

  const stopSession = () => {
    setIsSessionActive(false);
    setStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (unrecognisedTimeoutRef.current) {
      clearTimeout(unrecognisedTimeoutRef.current);
      unrecognisedTimeoutRef.current = null;
    }
    isAnalysingRef.current = false;
    setDisplayFeedback(undefined);
  };

  // --- effects ---

  // Starts and clears the capture interval when the session state flips.
  useEffect(() => {
    if (!isSessionActive) return;

    intervalRef.current = setInterval(() => {
      if (isAnalysingRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);

      const image = canvas.toDataURL("image/jpeg", 0.8);
      isAnalysingRef.current = true;
      submit({
        image,
        exercise: exercise || undefined,
        targetMuscles: targetMuscles.length ? targetMuscles : undefined,
      });
    }, CAPTURE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSessionActive, exercise, targetMuscles, submit]);

  // Releases the camera tracks if the component unmounts mid-session,
  // so the browser camera indicator light turns off.
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-4">
        <CameraPreview
          ref={videoRef}
          stream={stream}
          permissionError={permissionError}
        />

        <WorkoutSelector
          exercise={exercise}
          targetMuscles={targetMuscles}
          onExerciseChange={setExercise}
          onMusclesChange={setTargetMuscles}
          disabled={isSessionActive}
        />

        <Button onClick={isSessionActive ? stopSession : startSession} className="w-full">
          {isSessionActive ? "Stop session" : "Start session"}
        </Button>
      </div>

      {isSessionActive && <LiveFeedbackDisplay feedback={displayFeedback} />}

      {stopReason && (
        <p className="text-sm text-red-500 text-center">
          {stopReason}
        </p>
      )}
    </div>
  );
};

LiveForm.displayName = "LiveForm";

export default LiveForm;
