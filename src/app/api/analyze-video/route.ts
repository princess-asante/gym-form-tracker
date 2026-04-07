import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import { VideoFormFeedbackSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { fileName, mediaType } = (await request.json()) as {
    fileName: string;
    mediaType: string;
  };

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Poll until Gemini has finished processing the video (state = ACTIVE).
  // The browser already uploaded the bytes; we just need to wait for Gemini
  // to transcode and index them before we can reference the file in a prompt.
  let activeFile = { name: fileName, uri: "", state: "PROCESSING" } as {
    name: string;
    uri: string;
    state: string;
  };

  while (activeFile.state !== "ACTIVE") {
    if (activeFile.state === "FAILED") {
      return Response.json(
        { error: "File processing failed" },
        { status: 500 },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
    );
    if (!pollRes.ok) {
      return Response.json({ error: "File poll failed" }, { status: 502 });
    }
    activeFile = (await pollRes.json()) as {
      name: string;
      uri: string;
      state: string;
    };
  }

  const result = streamText({
    model: google("gemini-2.5-flash-lite"),
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
