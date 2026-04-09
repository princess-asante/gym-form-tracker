const ACCEPTED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const GEMINI_UPLOAD_HOST = "https://generativelanguage.googleapis.com";

export async function POST(request: Request) {
  const action = request.headers.get("x-upload-action");
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (action === "initiate") {
    const mimeType = request.headers.get("x-mime-type");
    const fileSize = request.headers.get("x-file-size");

    if (!mimeType || !fileSize) {
      return Response.json(
        { error: "Missing x-video-mime-type or x-video-size header" },
        { status: 400 },
      );
    }

    if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
      return Response.json(
        {
          error: `Unsupported file type. Accepted: ${ACCEPTED_MIME_TYPES.join(", ")}`,
        },
        { status: 415 },
      );
    }

    console.log("[upload-route] initiating upload session", {
      mimeType,
      fileSize,
    });

    const initiateUpload = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(fileSize),
          "X-Goog-Upload-Header-Content-Type": mimeType,
        },
        body: JSON.stringify({ file: { display_name: "gym-form-video" } }),
      },
    );

    if (!initiateUpload.ok) {
      const error = await initiateUpload.text();
      return Response.json(
        { error: `Failed to initiate upload: ${error}` },
        { status: 502 },
      );
    }

    const uploadUrl = initiateUpload.headers.get("X-Goog-Upload-URL");

    if (!uploadUrl) {
      return Response.json(
        { error: "Gemini did not return an upload URL" },
        { status: 502 },
      );
    }

    console.log("[upload-route] session initiated, upload URL received");
    return Response.json({ uploadUrl });
  } else if (action === "chunk") {
    const uploadUrl = request.headers.get("x-upload-url");
    const fileSize = request.headers.get("x-file-size");
    const offset = request.headers.get("x-upload-offset");
    const finalChunk = request.headers.get("x-final-chunk") === "true";

    if (!uploadUrl || !fileSize || !offset) {
      return Response.json(
        {
          error: "Missing x-upload-url, x-file-size, or x-upload-offset header",
        },
        { status: 400 },
      );
    }

    if (!uploadUrl.startsWith(GEMINI_UPLOAD_HOST)) {
      return Response.json({ error: "Invalid upload URL" }, { status: 400 });
    }

    const command = finalChunk ? "upload, finalize" : "upload";
    console.log("[upload-route] sending chunk", {
      offset,
      fileSize,
      finalChunk,
    });

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(fileSize),
        "X-Goog-Upload-Offset": String(offset),
        "X-Goog-Upload-Command": command,
      },
      // @ts-expect-error — duplex is required by the Fetch spec when streaming
      // a request body, but is not yet in TypeScript's lib.dom types.
      // https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests#half_duplex
      duplex: "half",
      body: request.body,
    });

    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      return Response.json(
        { error: `Failed to upload chunk: ${error}` },
        { status: 502 },
      );
    }

    if (finalChunk) {
      const { file } = (await uploadRes.json()) as {
        file: { name: string; uri: string; state: string };
      };
      console.log("[upload-route] final chunk accepted, fileName:", file.name);
      return Response.json({ fileName: file.name });
    }

    return new Response(null, { status: 200 });
  } else {
    return Response.json({ error: "Invalid upload action" }, { status: 400 });
  }
}
