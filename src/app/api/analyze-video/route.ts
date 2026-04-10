import { google } from "@ai-sdk/google";
import { Output, streamText } from "ai";
import { del } from "@vercel/blob";
import { after } from "next/server";
import { VideoFormFeedbackSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const GEMINI_UPLOAD_URL =
  "https://generativelanguage.googleapis.com/upload/v1beta/files";

export async function POST(request: Request) {
  const { blobUrl, mediaType } = (await request.json()) as {
    blobUrl: string;
    mediaType: string;
  };

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Fetch the video from Vercel Blob — outgoing requests have no payload cap,
  // so file size is no longer constrained by Vercel's 4.5 MB function limit.
  let blobRes: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    blobRes = await fetch(blobUrl);
    if (blobRes.ok) break;
    if (blobRes.status !== 404) {
      console.error("[analyze-video] blob fetch failed", {
        blobUrl,
        status: blobRes.status,
      });
      return Response.json(
        { error: "Failed to fetch video from storage" },
        { status: 502 },
      );
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  if (!blobRes || !blobRes.ok || !blobRes.body) {
    console.error("[analyze-video] blob fetch failed after retries", {
      blobUrl,
      status: blobRes?.status,
    });
    return Response.json(
      { error: "Failed to fetch video from storage" },
      { status: 502 },
    );
  }

  const contentLength = blobRes.headers.get("content-length");
  if (!contentLength) {
    console.error("[analyze-video] blob response missing content-length", {
      blobUrl,
    });
    return Response.json(
      { error: "Blob response missing content-length" },
      { status: 502 },
    );
  }

  // Open a Gemini resumable upload session.
  const initiateRes = await fetch(`${GEMINI_UPLOAD_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": contentLength,
      "X-Goog-Upload-Header-Content-Type": mediaType,
    },
    body: JSON.stringify({ file: { display_name: "gym-form-video" } }),
  });

  if (!initiateRes.ok) {
    const error = await initiateRes.text();
    console.error("[analyze-video] Gemini upload initiation failed", {
      status: initiateRes.status,
      error,
    });
    return Response.json(
      { error: `Failed to initiate Gemini upload: ${error}` },
      { status: 502 },
    );
  }

  const uploadUrl = initiateRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    console.error("[analyze-video] Gemini did not return an upload URL");
    return Response.json(
      { error: "Gemini did not return an upload URL" },
      { status: 502 },
    );
  }

  // Stream blob bytes directly to Gemini — no buffering in memory.
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": contentLength,
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    // @ts-expect-error — duplex required for streaming request bodies, not yet in TS lib.dom
    duplex: "half",
    body: blobRes.body,
  });

  if (!uploadRes.ok) {
    const error = await uploadRes.text();
    console.error("[analyze-video] Gemini byte upload failed", {
      status: uploadRes.status,
      error,
    });
    return Response.json(
      { error: `Gemini upload failed: ${error}` },
      { status: 502 },
    );
  }

  const { file } = (await uploadRes.json()) as {
    file: { name: string; uri: string; state: string };
  };

  // Poll until Gemini finishes transcoding.
  let activeFile = file;
  while (activeFile.state !== "ACTIVE") {
    if (activeFile.state === "FAILED") {
      console.error("[analyze-video] Gemini file processing failed", {
        fileName: activeFile.name,
      });
      return Response.json(
        { error: "File processing failed" },
        { status: 500 },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${activeFile.name}?key=${apiKey}`,
    );
    if (!pollRes.ok) {
      console.error("[analyze-video] Gemini file poll failed", {
        status: pollRes.status,
        fileName: activeFile.name,
      });
      return Response.json({ error: "File poll failed" }, { status: 502 });
    }
    activeFile = (await pollRes.json()) as {
      name: string;
      uri: string;
      state: string;
    };
  }

  // Schedule blob deletion after the response stream is fully sent.
  // after() runs post-response so it doesn't block streaming.
  after(async () => {
    await del(blobUrl);
  });

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
