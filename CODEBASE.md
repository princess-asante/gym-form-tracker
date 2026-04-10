# Gym Form Tracker — Codebase Overview

## What this app does
Users upload a photo or video of themselves exercising. The app sends it to an AI model, which returns structured form feedback (positives, issues with severity, optional timestamps). They can optionally specify the exercise and target muscles for more tailored advice.

---

## Tech stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| AI SDK | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/google`, `@ai-sdk/anthropic`) |
| Image model | Claude Sonnet 4.6 (Anthropic) |
| Video model | Gemini 2.5 Flash Lite (Google) |
| File storage | Vercel Blob |
| Image processing | `sharp` (server-side resize/buffer normalisation) |
| Schema validation | Zod |
| UI alerts | SweetAlert2 |
| Styling | Tailwind CSS |

---

## Key files

### API routes
| File | Purpose |
|---|---|
| `src/app/api/analyze-photo/route.ts` | Accepts base64 image, decodes via sharp, sends to Claude Sonnet, streams `FormFeedbackSchema` back |
| `src/app/api/analyze-video/route.ts` | Accepts a Vercel Blob URL, re-streams bytes to Gemini Files API (resumable upload), polls until ACTIVE, then streams `VideoFormFeedbackSchema` back |
| `src/app/api/blob-upload/route.ts` | Token endpoint for Vercel Blob client-side uploads — avoids hitting the 4.5 MB serverless payload limit |

### Schemas (`src/lib/schemas.ts`)
- `FormFeedbackSchema` — `{ overallAssessment, positives[], issues[] }` — used for photos
- `VideoFormFeedbackSchema` — extends the above, adds optional `timestamp` (m:ss) to each positive/issue — used for videos

### Prompts (`src/lib/prompts.ts`)
- `buildSystemPrompt(mediaLabel, { exercise, targetMuscles })` — single function that generates the system prompt for both routes. Injects exercise/muscle context if provided. Instructs the model to use plain language and avoid anatomical jargon.

### UI components
| File | Role |
|---|---|
| `src/app/page.tsx` | Root page — tab switcher between "image" and "video" modes |
| `src/components/organisms/AnalyzeForm.tsx` | Image upload form — uses `useObject` from AI SDK to consume the stream |
| `src/components/organisms/AnalyzeVideoForm.tsx` | Video form — two-phase: client uploads to Blob, then kicks off analysis. Uses a custom `fetch` override inside `useObject` |
| `src/components/organisms/FeedbackPanel.tsx` | Renders streaming feedback — handles partial/in-flight state gracefully |
| `src/components/molecules/WorkoutSelector.tsx` | Shared exercise + muscle selector used by both forms |
| `src/components/molecules/VideoDropzone.tsx` | Drag-and-drop / file picker for video |
| `src/components/molecules/ImageDropzone.tsx` | Same for images |

---

## Data flow — video (the more complex path)

```
Client
  1. user picks video file
  2. upload() → /api/blob-upload (token) → Vercel Blob (direct, bypasses 4.5MB limit)
  3. POST /api/analyze-video { blobUrl, mediaType, exercise?, targetMuscles? }

Server (/api/analyze-video)
  4. fetch(blobUrl) — pulls file out of Blob storage
  5. POST Gemini Upload API (resumable session) — streams bytes directly, no memory buffering
  6. poll GET until file.state === "ACTIVE" (server blocks here while Gemini transcodes)
  7. streamText() with gemini-2.5-flash-lite — file referenced by URI
  8. after() schedules del(blobUrl) post-response (non-blocking cleanup)
  9. toTextStreamResponse() — NDJSON stream back to client

Client
  10. useObject() consumes stream, progressively builds the object
  11. FeedbackPanel renders as fields arrive
```

---

## Streaming pattern
Both routes use `streamText` with `Output.object({ schema })` from the AI SDK. This produces a structured object stream (NDJSON). On the client, `useObject` from `@ai-sdk/react` deserialises it — the `object` it exposes is a partial/incomplete version of the schema while streaming, and complete on finish. `FeedbackPanel` is written to render gracefully at any stage of completeness.

---

## What's not built yet (as of April 2026)
- **Live camera feedback** — the logical next feature. Planned approach: periodic frame capture from `getUserMedia` → canvas snapshot → POST to `/api/analyze-photo` (reuses existing route). A third "live" tab would be added to `page.tsx`, with a new `LiveForm` organism owning the camera stream and capture interval.
