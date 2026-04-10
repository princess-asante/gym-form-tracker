import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const ACCEPTED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          access: "public",
          allowedContentTypes: ACCEPTED_MIME_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
        };
      },
    });

    return Response.json(jsonResponse);
  } catch (err) {
    console.error("[blob-upload] handleUpload failed", err);
    return Response.json({ error: "Upload failed" }, { status: 400 });
  }
}
