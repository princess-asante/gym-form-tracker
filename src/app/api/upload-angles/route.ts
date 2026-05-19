import { put } from "@vercel/blob";
import { anglesLimiter } from "@/lib/ratelimit";
import { errorResponse } from "@/lib/api";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const LABELS = ["good", "bad", "mixed"] as const;
type Label = (typeof LABELS)[number];

const MAX_BODY_BYTES = 500 * 1024; // 500 KB — well above any realistic CSV size

export async function POST(request: Request): Promise<Response> {
  const sessionId = request.headers.get("x-session-id");
  if (!sessionId) return errorResponse("Missing session", 400);

  const { success, reset } = await anglesLimiter.limit(sessionId);
  if (!success) {
    const retryAfter = Math.floor((reset - Date.now()) / 1000);
    return errorResponse("Too many uploads", 429, {
      "Retry-After": String(retryAfter),
    });
  }

  const { csv, label } = (await request.json()) as {
    csv: unknown;
    label: unknown;
  };

  if (!label || !LABELS.includes(label as Label))
    return errorResponse("label must be 'good' or 'bad'", 400);

  if (!csv || typeof csv !== "string" || csv.trim().length === 0)
    return errorResponse("csv must be a non-empty string", 400);

  if (Buffer.byteLength(csv, "utf8") > MAX_BODY_BYTES)
    return errorResponse("csv exceeds maximum size", 413);

  const filename = `angles/${label}_${Date.now()}.csv`;

  const blob = await put(filename, csv, {
    access: "public",
    contentType: "text/csv",
  });

  logger.info("[upload-angles] stored", {
    url: blob.url,
    label,
    rows: csv.split("\n").length - 1, // subtract header row
  });

  return Response.json({ url: blob.url });
}
