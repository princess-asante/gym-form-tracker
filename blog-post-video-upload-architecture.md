# Hitting Vercel's Walls: What I Learned Trying to Upload Videos Through a Serverless Function

While building a gym form tracker that analyses exercise videos with Gemini, I ran into a cascade of architectural constraints that taught me a lot about the limits of serverless infrastructure. Here's the full journey.

---

## The Problem

Users upload a video. The app sends it to Gemini's Files API, which transcodes and indexes it, then streams back AI-generated form feedback. Simple enough — until I deployed to Vercel.

The first error looked like this in the Vercel dashboard:

```
Error: FUNCTION_PAYLOAD_TOO_LARGE
Status: 413
Path: /api/video-upload-route
```

### What's actually happening

Vercel serverless functions have a hard **4.5 MB incoming request body limit**, enforced at the infrastructure layer — before your Next.js route handler executes. There's no `next.config.js` setting to raise it. The original architecture was routing the full video through the function as a request body, which failed immediately for any real-world video.

---

## Attempt 1: Chunked Upload (Seemed Reasonable)

The obvious workaround: split the file into chunks smaller than 4.5 MB and send them sequentially, proxying each chunk through the serverless function to Gemini's resumable upload API.

The implementation used Gemini's `X-Goog-Upload-Protocol: resumable` flow:

1. `POST /api/video-upload-route` with `X-Upload-Action: initiate` — opens a Gemini upload session, returns a one-time upload URL
2. `POST /api/video-upload-route` with `X-Upload-Action: chunk` — forwards each chunk to Gemini via `request.body` streaming

### The bug in the chunking loop

The first implementation had a subtle logic error that made it always send the entire file as a single "chunk":

```ts
// Buggy version
while (offset < fileContent.size) {
  const isFinalChunk = offset + fileContent.size >= fileContent.size; // always true when offset = 0
  
  body: fileContent.slice(offset, offset + fileContent.size) // always the full file
  
  offset += fileContent.size; // jumps past end in one step
}
```

`isFinalChunk` was always `true` on the first iteration because `0 + fileContent.size >= fileContent.size` is a tautology. The file was never actually chunked — it sent the full payload every time, hitting the same 413.

The fix introduces a proper `CHUNK_SIZE` constant and correctly advances the offset:

```ts
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB
let offset = 0;

while (offset < fileContent.size) {
  const chunkEnd = Math.min(offset + CHUNK_SIZE, fileContent.size);
  const isFinalChunk = chunkEnd >= fileContent.size;

  await fetch("/api/video-upload-route", {
    headers: {
      "X-File-Size": String(chunkEnd - offset), // actual chunk byte count, not total
      "X-Upload-Offset": String(offset),
      "X-Final-Chunk": String(isFinalChunk),
    },
    body: fileContent.slice(offset, chunkEnd),
  });

  offset = chunkEnd;
}
```

Note: `X-File-Size` needed to be the chunk byte count, not the total file size — the server forwards it as `Content-Length` on the outgoing PUT to Gemini.

### The wall: Gemini's chunk granularity

With the loop fixed, a new error appeared:

```
Failed to upload chunk: The client sent 4194304 bytes,
which is not a multiple of the 8388608 byte chunk granularity.
```

Gemini's resumable upload API requires non-final chunks to be **multiples of 8 MB** (8388608 bytes). Our 4 MB chunks are exactly half that.

This creates a fundamental constraint conflict:

| Constraint | Requirement |
|---|---|
| Vercel incoming payload limit | < 4.5 MB per request |
| Gemini non-final chunk granularity | ≥ 8 MB (multiples of 8388608 bytes) |

No single chunk size satisfies both. Any value large enough for Gemini will be rejected by Vercel. **The proxy chunking approach is architecturally unworkable.**

---

## The Correct Architecture: Vercel Blob as a Staging Layer

The root issue is that video bytes are passing through a serverless function at all. The fix decouples the upload path from the serverless compute layer entirely.

```
Old:  Client → POST /api/video-upload (body: video bytes) → Vercel → Gemini
              ↑ hits 4.5 MB limit here

New:  Client → upload() → Vercel Blob CDN        (no serverless involved)
      Client → POST /api/analyze-video { blobUrl }
      Server → fetch(blobUrl) → Gemini Files API  (outgoing, no payload cap)
      Server → poll until ACTIVE
      Server → streamText() → Client
      Server → del(blobUrl)                       (cleanup)
```

### Why this works

- **Client → Vercel Blob**: `@vercel/blob/client` handles a direct upload to Vercel's CDN. The bytes never touch your serverless function as a request body.
- **Server → Gemini**: Your function makes an *outgoing* fetch to Gemini. Vercel's 4.5 MB cap only applies to *incoming* request bodies — outgoing requests have no equivalent constraint.
- **Cleanup**: Vercel Blob doesn't auto-expire files. The serverless function owns deletion via `del(blobUrl)` in a `finally` block (or `after()` from `next/server` for post-stream cleanup).

### Key trade-offs vs. chunked proxy

| | Chunked proxy | Vercel Blob staging |
|---|---|---|
| Works within Vercel limits | No (Gemini granularity conflict) | Yes |
| Extra storage cost | No | Yes (small, temporary) |
| File transfer hops | Client → Vercel → Gemini | Client → Blob → Gemini |
| Cleanup responsibility | None | Must `del()` explicitly |
| Dependencies added | None | `@vercel/blob` |

---

## Lessons

**Serverless payload limits aren't just a "make it bigger" problem.** They're enforced below your application layer, which means you can't abstract around them in application code. The constraint has to be eliminated at the architecture level — either by removing the payload from the serverless path entirely, or by finding an infrastructure primitive that doesn't have the limit (e.g. edge streaming, or a long-running server).

**When two external systems' constraints conflict, you need a buffer layer.** Vercel's 4.5 MB request limit and Gemini's 8 MB chunk granularity are both fixed. The only resolution is to stop making them interact directly — Vercel Blob acts as that buffer.

**Proxy architectures hide constraints until they hit production.** The chunking approach looked valid locally (small test files fit in one chunk below both limits), but the Gemini granularity error only surfaced with real-world file sizes. Designing around external API constraints requires reading their docs, not just testing the happy path.
