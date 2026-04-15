import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import sharp from "sharp";
import { LiveFeedbackSchema } from "@/lib/schemas";
import { buildSystemPrompt } from "@/lib/prompts";
import { logger } from "@/lib/logger";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { checkLifetimeLimit, streamLimiter } from "@/lib/ratelimit";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sessionId = request.headers.get("x-session-id");
  if (!sessionId) {
    return errorResponse("Missing session", 400);
  }

  const lifetime = await checkLifetimeLimit(sessionId);
  if (!lifetime.allowed) {
    return errorResponse("Session analysis limit reached. Try again in 48 hours.", 429);
  }

  const { success, reset } = await streamLimiter.limit(sessionId);
  if (!success) {
    const retryAfter = Math.floor((reset - Date.now()) / 1000);
    return errorResponse("Too many requests", 429, { "Retry-After": String(retryAfter) });
  }

  const { image, exercise, targetMuscles } = (await request.json()) as {
    image: string;
    exercise?: string;
    targetMuscles?: string[];
  };

  if (exercise && exercise.length > FIELD_MAX_LENGTHS.exercise)
    return Response.json({ error: "exercise field exceeds maximum length" }, { status: 400 });
  if (targetMuscles?.some((m) => m.length > FIELD_MAX_LENGTHS.targetMuscles))
    return Response.json({ error: "targetMuscles field exceeds maximum length" }, { status: 400 });

  const [header, base64Data] = image.split(",");
  const mediaType = header.match(/:(.*?);/)?.[1];

  if (!base64Data || !mediaType) {
    logger.error("[analyze-stream] invalid image format — missing base64 data or media type");
    return Response.json({ error: "Invalid image format" }, { status: 400 });
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    logger.error("[analyze-stream] unsupported media type", { mediaType });
    return Response.json({ error: "Unsupported image type" }, { status: 415 });
  }

  const imageBuffer = await sharp(Buffer.from(base64Data, "base64")).toBuffer();
  logger.info("[analyze-stream] dispatching frame", {
    mediaType,
    exercise: exercise ?? null,
    targetMuscles: targetMuscles ?? null,
    imageSizeKb: Math.round(imageBuffer.byteLength / 1024),
  });

  const result = streamText({
    model: google("gemini-2.5-flash-lite"),
    output: Output.object({ schema: LiveFeedbackSchema }),
    system: buildSystemPrompt("live frame", { exercise, targetMuscles }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: imageBuffer,
            mediaType: mediaType as "image/jpeg" | "image/png" | "image/webp",
          },
          {
            type: "text",
            text: "Analyse my form right now.",
          },
        ],
      },
    ],
  });

  return result.toTextStreamResponse();
}
