import { anthropic } from "@ai-sdk/anthropic";
import { Output, streamText } from "ai";
import sharp from "sharp";
import { FormFeedbackSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { image, exercise, targetMuscles } = (await request.json()) as {
    image: string;
    exercise?: string;
    targetMuscles?: string[];
  };

  const [header, base64Data] = (image as string).split(",");
  const mediaType = header.match(/:(.*?);/)?.[1];

  if (!base64Data || !mediaType) {
    return new Response(JSON.stringify({ error: "Invalid image format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    return new Response(JSON.stringify({ error: "Unsupported image type. Only JPEG, PNG, and WEBP are allowed." }), {
      status: 415,
      headers: { "Content-Type": "application/json" },
    });
  }

  // base64 inflates size by ~33%, so a 5MB decoded image is ~6.8MB encoded.
  // Reject before decoding to avoid unnecessary memory allocation.
  const MAX_BASE64_LENGTH = 6.8 * 1024 * 1024;
  if (base64Data.length > MAX_BASE64_LENGTH) {
    return new Response(JSON.stringify({ error: "Image too large. Maximum size is 5MB." }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // The SDK treats strings as URLs and tries to fetch them — including data:
  // URLs, which causes a DownloadError. Passing a Buffer tells the SDK this
  // is already binary data and bypasses the URL fetching path entirely.
  const imageBuffer = await sharp(Buffer.from(base64Data, "base64")).toBuffer();

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.object({ schema: FormFeedbackSchema }),
    system: `You are a friendly but expert strength and conditioning coach. You understand how the body moves and how to keep people safe while they train. Analyse the exercise form shown in the image and give feedback that is clear enough for a complete beginner to understand and act on.
${exercise ? `The exercise being performed is: ${exercise}.` : ""}${targetMuscles?.length ? ` The user is focusing on targeting: ${targetMuscles.join(", ")}.` : ""}

Rules:
- Be specific: name the body part, joint, or muscle you are referring to — avoid vague phrases like "your form looks off"
- Keep each point short: no more than 25 words. Focus on the most important things that will make the biggest difference to safety and results.
- For issues: clearly explain what is wrong, why it matters (e.g. it puts strain on the knee, it wastes energy), and give one simple cue to fix it
- For positives: explain what the person is doing well and why it is beneficial — this helps reinforce good habits
- Severity guide: high = risk of immediate injury, medium = risk of long-term injury or wasted effort over time, low = a small improvement that would help
- Use plain, everyday language: say "lower back" not "lumbar spine", "kneecap" not "patella", "thigh muscles" not "posterior chain". Avoid anatomical Latin terms entirely unless there is no simpler alternative
- If you cannot clearly see enough of the body to assess a point, leave it out rather than guessing`
,

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
