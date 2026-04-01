import { anthropic } from "@ai-sdk/anthropic";
import { Output, streamText } from "ai";
import { FormFeedbackSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { image } = await request.json();

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
  const imageBuffer = Buffer.from(base64Data, "base64");

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    output: Output.object({ schema: FormFeedbackSchema }),
    system: `You are an expert strength and conditioning coach with deep knowledge
of biomechanics and injury prevention. Analyse the exercise form shown in the image.

Rules:
- Be specific: name joints, angles, and muscle groups rather than speaking in generalities
- Keep it concise: limit your feedback to the most critical points that will have the biggest impact on performance and injury prevention. No more than 25 words per point.
- For issues: state what is wrong, why it creates risk or inefficiency, and the exact cue to fix it
- For positives: state what is correct and the biomechanical reason it matters
- Severity guide: high = acute injury risk, medium = chronic overuse risk or power leak, low = minor refinement
- If you cannot clearly see enough of the body to assess a point, omit it rather than guessing`
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
