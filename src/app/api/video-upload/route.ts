export const dynamic = "force-dynamic";

const ACCEPTED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const { mimeType, size } = (await request.json()) as {
    mimeType: string;
    size: number;
  };

  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    return Response.json(
      { error: `Unsupported file type. Accepted: ${ACCEPTED_MIME_TYPES.join(", ")}` },
      { status: 415 },
    );
  }

  if (size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File exceeds the 50 MB limit" },
      { status: 413 },
    );
  }

  // Ask Gemini to open a resumable upload session.
  // We send no video bytes here — just the metadata (size + type).
  // Gemini responds with a session URL in the X-Goog-Upload-URL header.
  // The browser will PUT the actual bytes directly to that URL.
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const initiateRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": mimeType,
      },
      body: JSON.stringify({ file: { display_name: "gym-form-video" } }),
    },
  );

  if (!initiateRes.ok) {
    const error = await initiateRes.text();
    return Response.json(
      { error: `Failed to initiate upload: ${error}` },
      { status: 502 },
    );
  }

  const uploadUrl = initiateRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) {
    return Response.json(
      { error: "Gemini did not return an upload URL" },
      { status: 502 },
    );
  }

  return Response.json({ uploadUrl });
}
