export type ApiErrorResponse = { error: string };

export const errorResponse = (message: string, status: number, headers?: HeadersInit): Response =>
  Response.json({ error: message } satisfies ApiErrorResponse, { status, headers });
