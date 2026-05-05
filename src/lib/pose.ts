export type Angles = {
  lKnee: number | null; rKnee: number | null;
  lHip:  number | null; rHip:  number | null;
  lElbow: number | null; rElbow: number | null;
};

export const INITIAL_ANGLES: Angles = {
  lKnee: null, rKnee: null,
  lHip:  null, rHip:  null,
  lElbow: null, rElbow: null,
};

// Visibility confidence threshold — landmarks below this are skipped for
// both drawing and angle calculation to avoid acting on unreliable data.
export const VISIBILITY_THRESHOLD = 0.8;

// Pairs of landmark indices that form the skeleton lines.
// Each pair [a, b] draws a line between landmark a and landmark b.
// Full landmark map: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
export const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // upper body
  [11, 23], [12, 24], [23, 24],                      // torso
  [23, 25], [24, 26], [25, 27], [26, 28],            // legs
  [27, 29], [28, 30], [29, 31], [30, 32],            // feet
  [15, 17], [15, 19], [16, 18], [16, 20],            // hands
];

// Landmarks rendered as larger, highlighted dots — the key joints for gym exercise analysis.
export const KEY_LANDMARKS = new Set([11, 12, 13, 14, 23, 24, 25, 26, 27, 28]);

// a, b, c are MediaPipe landmark objects: { x, y, visibility } normalised 0–1.
// b is the joint we're measuring (the middle point of the three).
// Returns null if any landmark has low confidence — callers show "—" instead of a bad number.
export const calcAngle = (
  a: { x: number; y: number; visibility: number },
  b: { x: number; y: number; visibility: number },
  c: { x: number; y: number; visibility: number },
): number | null => {
  // Bail early if any of the three points isn't reliably detected.
  if (a.visibility < VISIBILITY_THRESHOLD || b.visibility < VISIBILITY_THRESHOLD || c.visibility < VISIBILITY_THRESHOLD) return null;

  // atan2(dy, dx) gives the angle between the horizontal axis and the line
  // drawn from b toward that point. We compute it for both bones meeting at b.
  const angleToC = Math.atan2(c.y - b.y, c.x - b.x);
  const angleToA = Math.atan2(a.y - b.y, a.x - b.x);

  // Subtract: the shared horizontal reference cancels out,
  // leaving only the angle between the two bones.
  const radians = angleToC - angleToA;

  // Convert radians → degrees.
  let degrees = Math.abs((radians * 180) / Math.PI);

  // The subtraction can produce values > 180 when the result wraps around.
  // We always want the interior angle (0–180°), so we reflect it back.
  if (degrees > 180) degrees = 360 - degrees;

  return Math.round(degrees);
};
