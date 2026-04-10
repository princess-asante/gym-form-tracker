import { anthropic } from "@ai-sdk/anthropic";
import { Output, streamText } from "ai";
import sharp from "sharp";
import { LiveFeedbackSchema } from "@/lib/schemas";
import { buildSystemPrompt } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { image, exercise, targetMuscles } = (await request.json()) as {
    image: string;
    exercise?: string;
    targetMuscles?: string[];
  };

  const [header, base64Data] = image.split(",");
  const mediaType = header.match(/:(.*?);/)?.[1];

  if (!base64Data || !mediaType) {
    return Response.json({ error: "Invalid image format" }, { status: 400 });
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    return Response.json({ error: "Unsupported image type" }, { status: 415 });
  }

  const imageBuffer = await sharp(Buffer.from(base64Data, "base64")).toBuffer();

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
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
