import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { logger } from "@/lib/logger";
import { blobLimiter } from "@/lib/ratelimit";
import { errorResponse } from "@/lib/api";

const ACCEPTED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: Request): Promise<Response> {
  const sessionId = request.headers.get("x-session-id");
  if (!sessionId) {
    return errorResponse("Missing session", 400);
  }

  const { success, reset } = await blobLimiter.limit(sessionId);
  if (!success) {
    const retryAfter = Math.floor((reset - Date.now()) / 1000);
    return errorResponse("Too many requests", 429, { "Retry-After": String(retryAfter) });
  }

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
    logger.error("[blob-upload] handleUpload failed", { err });
    return Response.json({ error: "Upload failed" }, { status: 400 });
  }
}
