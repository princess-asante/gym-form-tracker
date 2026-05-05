"use client";

import { useRef, useState } from "react";
import Script from "next/script";
import Button from "@/components/atoms/Button";
import { VISIBILITY_THRESHOLD, CONNECTIONS, KEY_LANDMARKS, calcAngle, INITIAL_ANGLES, type Angles } from "@/lib/pose";

const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js",
];

const LiveForm = () => {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [angles, setAngles] = useState<Angles>(INITIAL_ANGLES);

  const loadedCount = useRef(0);
  const angleFrameCount = useRef(0);
  const frameCount = useRef(0);
  const lastFpsTime = useRef(performance.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const onResults = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas resolution to the incoming frame
    canvas.width = results.image.width;
    canvas.height = results.image.height;

    // 1. Draw the raw video frame as the background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0);

    if (!results.poseLandmarks) return;

    const lm = results.poseLandmarks;
    const w = canvas.width;
    const h = canvas.height;

    // 2. Draw skeleton connections
    ctx.strokeStyle = "#00ffaa";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ffaa";
    ctx.shadowBlur = 6;

    for (const [a, b] of CONNECTIONS) {
      const ptA = lm[a];
      const ptB = lm[b];
      if (ptA.visibility < VISIBILITY_THRESHOLD || ptB.visibility < VISIBILITY_THRESHOLD) continue;

      ctx.beginPath();
      ctx.moveTo(ptA.x * w, ptA.y * h);
      ctx.lineTo(ptB.x * w, ptB.y * h);
      ctx.stroke();
    }

    // 3. Draw landmark dots
    ctx.shadowBlur = 0;

    for (let i = 0; i < lm.length; i++) {
      const pt = lm[i];
      if (pt.visibility < VISIBILITY_THRESHOLD) continue;

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

    // 4. FPS counter — increment every frame, push to state once per second.
    frameCount.current += 1;
    const now = performance.now();
    if (now - lastFpsTime.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsTime.current = now;
    }

    // 5. Calculate joint angles every frame, but only push to React state
    // every 4 frames (~8fps). The math runs at full speed; the UI doesn't
    // need to re-render 30 times a second for numbers to feel live.
    angleFrameCount.current += 1;
    if (angleFrameCount.current % 4 === 0) {
      setAngles({
        // knee: shoulder → knee → ankle
        lKnee: calcAngle(lm[23], lm[25], lm[27]),
        rKnee: calcAngle(lm[24], lm[26], lm[28]),
        // hip: shoulder → hip → knee
        lHip:  calcAngle(lm[11], lm[23], lm[25]),
        rHip:  calcAngle(lm[12], lm[24], lm[26]),
        // elbow: shoulder → elbow → wrist
        lElbow: calcAngle(lm[11], lm[13], lm[15]),
        rElbow: calcAngle(lm[12], lm[14], lm[16]),
      });
    }
  };

  const initPose = async () => {
    const pose = new (window as any).Pose({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResults);
    await pose.initialize();
    poseRef.current = pose;
  };

  const startSession = async () => {
    await initPose();

    const camera = new (window as any).Camera(videoRef.current, {
      onFrame: async () => {
        if (poseRef.current && videoRef.current) {
          await poseRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    cameraRef.current = camera;
    await camera.start();
    setIsActive(true);
  };

  const stopSession = () => {
    cameraRef.current?.stop();
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    poseRef.current = null;
    cameraRef.current = null;
    setIsActive(false);
  };

  const handleScriptLoad = () => {
    loadedCount.current += 1;
    if (loadedCount.current === MEDIAPIPE_SCRIPTS.length) {
      setScriptsLoaded(true);
    }
  };

  const buttonLabel = !scriptsLoaded
    ? "Loading SDK…"
    : isActive
      ? "Stop session"
      : "Start session";

  const angleCards: { label: string; value: number | null }[] = [
    { label: "L Knee",  value: angles.lKnee },
    { label: "R Knee",  value: angles.rKnee },
    { label: "L Hip",   value: angles.lHip },
    { label: "R Hip",   value: angles.rHip },
    { label: "L Elbow", value: angles.lElbow },
    { label: "R Elbow", value: angles.rElbow },
  ];

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

      <div className="flex flex-col gap-8 w-full">
        {/* Camera viewport */}
        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden aspect-video">
          {/* Hidden video — source of raw webcam frames */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Visible canvas — where we draw the annotated feed */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Idle placeholder shown before session starts */}
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Camera inactive
              </p>
            </div>
          )}

          {/* FPS badge — top-right corner of the canvas */}
          {isActive && (
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-medium text-white">
              <span
                className={
                  fps > 20
                    ? "text-emerald-400"
                    : fps > 10
                      ? "text-amber-400"
                      : "text-red-400"
                }
              >
                {fps}
              </span>
              {" fps"}
            </div>
          )}
        </div>

        <Button
          className="w-full"
          disabled={!scriptsLoaded}
          onClick={isActive ? stopSession : startSession}
        >
          {buttonLabel}
        </Button>

        {/* Angle readouts — only visible during an active session */}
        {isActive && (
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Joint angles
            </p>
            <div className="grid grid-cols-3 gap-2">
              {angleCards.map(({ label, value }) => (
                <div
                  key={label}
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
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

LiveForm.displayName = "LiveForm";

export default LiveForm;
