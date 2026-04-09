export const dynamic = "force-dynamic";

const ACCEPTED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: Request) {
  // The browser sends the mime type and file size as custom headers
  // so we can validate them before touching the body.
  const mimeType = request.headers.get("x-video-mime-type");
  const sizeHeader = request.headers.get("x-video-size");

  if (!mimeType || !sizeHeader) {
    return Response.json(
      { error: "Missing x-video-mime-type or x-video-size header" },
      { status: 400 },
    );
  }

  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    return Response.json(
      { error: `Unsupported file type. Accepted: ${ACCEPTED_MIME_TYPES.join(", ")}` },
      { status: 415 },
    );
  }

  const size = Number(sizeHeader);
  if (size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "File exceeds the 50 MB limit" },
      { status: 413 },
    );
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Ask Gemini to open an upload session. No video bytes here — just metadata.
  // Gemini responds with a one-time upload URL in the X-Goog-Upload-URL header.
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

  // Forward the video bytes from the browser straight to Gemini.
  // request.body is a stream — bytes flow through our server without
  // being held in memory, so file size doesn't affect memory usage.
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(size),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    // @ts-expect-error — duplex is required by the Fetch spec when streaming
    // a request body, but is not yet in TypeScript's lib.dom types.
    duplex: "half",
    body: request.body,
  });

  if (!uploadRes.ok) {
    const error = await uploadRes.text();
    return Response.json(
      { error: `Upload to Gemini failed: ${error}` },
      { status: 502 },
    );
  }

  const { name: fileName } = (await uploadRes.json()) as {
    name: string;
    uri: string;
    state: string;
  };

  return Response.json({ fileName });
}
