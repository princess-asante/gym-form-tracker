import { anthropic } from "@ai-sdk/anthropic";
import { Output, streamText } from "ai";
import sharp from "sharp";
import { FormFeedbackSchema } from "@/lib/schemas";
import { buildSystemPrompt } from "@/lib/prompts";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { image, exercise, targetMuscles, trainingGoal } = (await request.json()) as {
    image: string;
    exercise?: string;
    targetMuscles?: string[];
    trainingGoal?: string;
  };

  const [header, base64Data] = (image as string).split(",");
  const mediaType = header.match(/:(.*?);/)?.[1];

  if (!base64Data || !mediaType) {
    return errorResponse("Invalid image format", 400);
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    return errorResponse("Unsupported image type. Only JPEG, PNG, and WEBP are allowed.", 415);
  }

  // base64 inflates size by ~33%, so a 5MB decoded image is ~6.8MB encoded.
  // Reject before decoding to avoid unnecessary memory allocation.
  const MAX_BASE64_LENGTH = 6.8 * 1024 * 1024;
  if (base64Data.length > MAX_BASE64_LENGTH) {
    return errorResponse("Image too large. Maximum size is 5MB.", 413);
  }

  // The SDK treats strings as URLs and tries to fetch them — including data:
  // URLs, which causes a DownloadError. Passing a Buffer tells the SDK this
  // is already binary data and bypasses the URL fetching path entirely.
  const imageBuffer = await sharp(Buffer.from(base64Data, "base64")).toBuffer();

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.object({ schema: FormFeedbackSchema }),
    system: buildSystemPrompt("image", { exercise, targetMuscles, trainingGoal }),

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
            text: "Please analyse my exercise form.",
          },
        ],
      },
    ],
  });
  return result.toTextStreamResponse();
}
