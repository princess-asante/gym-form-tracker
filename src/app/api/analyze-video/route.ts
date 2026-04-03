import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import { VideoFormFeedbackSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const ACCEPTED_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("video");

  if (!(file instanceof File)) {
    return Response.json({ error: "No video file provided" }, { status: 400 });
  }

  if (
    !ACCEPTED_MIME_TYPES.includes(
      file.type as (typeof ACCEPTED_MIME_TYPES)[number],
    )
  ) {
    return Response.json(
      {
        error: `Unsupported file type. Accepted: ${ACCEPTED_MIME_TYPES.join(", ")}`,
      },
      { status: 415 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File exceeds the 50 MB limit" },
      { status: 413 },
    );
  }

  const videoBuffer = Buffer.from(await file.arrayBuffer());
  const mediaType = file.type;

  const apiKey = process.env.GEMINI_API_KEY
  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mediaType,
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Header-Content-Length": String(videoBuffer.byteLength),
        "X-Goog-Upload-Header-Content-Type": mediaType,
      },
      body: videoBuffer,
    },
  )

  if (!uploadRes.ok) {
    const error = await uploadRes.text()
    return Response.json({ error: `File upload failed: ${error}` }, { status: 502 })
  }

  const { file: uploadedFile } = await uploadRes.json() as {
    file: { uri: string; name: string; state: string }
  }

  let activeFile = uploadedFile
  while (activeFile.state !== "ACTIVE") {
    if (activeFile.state === "FAILED") {
      return Response.json({ error: "File processing failed" }, { status: 500 })
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${activeFile.name}?key=${apiKey}`,
    )
    if (!pollRes.ok) {
      return Response.json({ error: "File poll failed" }, { status: 502 })
    }
    activeFile = (await pollRes.json()) as { uri: string; name: string; state: string }
  }

  const result = streamText({
    model: google("gemini-2.0-flash"),
    output: Output.object({ schema: VideoFormFeedbackSchema }),
    system: `You are an expert strength and conditioning coach with deep knowledge
of biomechanics and injury prevention. Analyse the exercise form shown in the video clip.

Rules:
- Be specific: name joints, angles, and muscle groups rather than speaking in generalities
- Keep it concise: limit your feedback to the most critical points that will have the biggest impact on performance and injury prevention. No more than 25 words per point.
- For issues: state what is wrong, why it creates risk or inefficiency, and the exact cue to fix it
- For positives: state what is correct and the biomechanical reason it matters
- Severity guide: high = acute injury risk, medium = chronic overuse risk or power leak, low = minor refinement
- If you cannot clearly see enough of the body to assess a point, omit it rather than guessing
- Where a specific moment in the video illustrates a point, include a timestamp in m:ss format (e.g. "0:03")`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: new URL(activeFile.uri),
            mediaType,
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
