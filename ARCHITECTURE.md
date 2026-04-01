# Gym Form Tracker — Architecture

A single-page Next.js app that analyzes exercise form from images using Claude's vision API, streaming structured AI feedback in real time.

---

## High-Level Overview

```
Browser                         Server (Next.js API Route)         External
──────────────────────────────  ─────────────────────────────────  ─────────────
ImageDropzone (base64 encode)
       │
       ▼
AnalyzeForm ──── POST /api/analyze ────────────────────────────► Claude Sonnet 4.6
  (useObject)       { image: base64 }                              (vision model)
       │                                                                │
       │◄────────────── Server-Sent Events (streaming JSON) ───────────┘
       │
       ▼
FeedbackPanel (renders partial data as it streams)
```

---

## Project Structure

```
src/
├── app/
│   ├── api/analyze/route.ts     ← only API endpoint
│   ├── layout.tsx               ← root layout, fonts, metadata
│   ├── page.tsx                 ← single page (renders AnalyzeForm)
│   └── globals.css              ← Tailwind v4 + theme vars
├── components/
│   ├── atoms/
│   │   ├── Badge.tsx            ← severity chip (low/medium/high)
│   │   ├── Button.tsx           ← primary + ghost variants, loading state
│   │   └── Spinner.tsx          ← animated ring, three sizes
│   ├── molecules/
│   │   ├── ImageDropzone.tsx    ← drag-and-drop image picker
│   │   └── FeedbackItem.tsx     ← title + badge + description row
│   └── organisms/
│       ├── AnalyzeForm.tsx      ← top-level client component, owns state
│       └── FeedbackPanel.tsx    ← renders streaming feedback object
└── lib/
    └── schemas.ts               ← Zod schema for AI response shape
```

---

## Component Tree

```
page.tsx  (server component)
└── AnalyzeForm  [client — "use client"]
    │   state: imageUrl, { object, isLoading } from useObject
    │
    ├── ImageDropzone
    │       reads file → base64 → calls onImageChange(dataUrl)
    │
    ├── Button  ("Analyse form" — triggers submit())
    ├── Button  ("Clear" — resets state)
    │
    └── FeedbackPanel  (only rendered when object exists)
        ├── overallAssessment  (plain text)
        ├── positives[]
        │   └── FeedbackItem (title, description)
        └── issues[]
            └── FeedbackItem (title, description, severity)
                                └── Badge (low | medium | high)
```

---

## Data Flow

### 1. Image Upload

```
User selects / drops file
        │
        ▼
ImageDropzone: FileReader.readAsDataURL()
        │
        ▼
base64 data URL stored in AnalyzeForm.imageUrl state
```

### 2. Analysis Request

```
User clicks "Analyse form"
        │
        ▼
useObject.submit({ image: imageUrl })
        │   (from @ai-sdk/react)
        ▼
POST /api/analyze
  body: { image: "data:image/jpeg;base64,..." }
        │
        ▼  (route.ts)
Validate format — extract MIME type from data URL header
Check size   — reject if > 5 MB (6.8 MB base64 threshold)
Decode base64 → Buffer  (avoids SDK URL-fetch path)
        │
        ▼
streamText({
  model: anthropic("claude-sonnet-4-6"),
  system: <biomechanics expert prompt>,
  messages: [{ role: "user", content: [image, text] }],
  output: Output.object({ schema: FormFeedbackSchema })
})
        │
        ▼
Server-Sent Events streamed back to client
```

### 3. Streaming Render

```
useObject receives partial JSON chunks
        │
        ▼
object is typed as DeepPartial<FormFeedback>
        │
        ▼
FeedbackPanel renders:
  • overallAssessment — appears as text streams in
  • positives[]       — each item shows skeleton while title/description stream
  • issues[]          — same, plus severity Badge when severity field arrives
```

---

## API Route: `POST /api/analyze`

| Property | Value |
|---|---|
| Path | `/api/analyze` |
| Method | `POST` |
| Request body | `{ image: string }` — base64 data URL |
| Response | Server-Sent Events (text/event-stream) |
| Model | `claude-sonnet-4-6` |
| Max image size | 5 MB (decoded) |
| Accepted types | `image/jpeg`, `image/png`, `image/webp` |
| Caching | `force-dynamic` (never cached) |

**System prompt instructs the model to:**
- Act as a biomechanics expert
- Be specific about joint angles, posture, and muscle engagement
- Only provide feedback when confident about what is visible
- Return a valid `FormFeedback` JSON object

---

## Data Schema

Defined with Zod in [src/lib/schemas.ts](src/lib/schemas.ts), used both for runtime validation in the API route and as the type source for client components.

```
FormFeedback
├── overallAssessment: string          // 1–2 sentence summary
├── positives: Array<{
│     title: string                    // e.g. "Neutral spine"
│     description: string             // what's good and why
│   }>
└── issues: Array<{
      title: string                    // e.g. "Knee cave"
      description: string             // what's wrong, why it matters, how to fix
      severity: "low" | "medium" | "high"
    }>
```

The AI SDK's `Output.object({ schema })` enforces this shape during streaming. On the client, `useObject` types the partial response as `DeepPartial<FormFeedback>`, so every field is treated as potentially undefined while streaming.

---

## Key Dependencies

| Package | Role |
|---|---|
| `next` 16.2.1 | Framework — App Router, API routes, SSR |
| `react` 19.2.4 | UI rendering |
| `ai` (Vercel AI SDK) | `streamText`, `Output.object` for structured streaming |
| `@ai-sdk/anthropic` | Anthropic provider for the AI SDK |
| `@ai-sdk/react` | `useObject` hook — manages streaming + partial state |
| `zod` v4 | Schema definition and runtime validation |
| `tailwindcss` v4 | Utility-first CSS |
| `sweetalert2` | Error modals |
| `@upstash/ratelimit` + `@upstash/redis` | Installed, not yet wired up |

---

## Rendering Strategy

| Layer | Strategy | Reason |
|---|---|---|
| `page.tsx` | Server Component | No interactivity needed at page level |
| `AnalyzeForm` | Client Component | Owns state + event handlers |
| `FeedbackPanel` | Client Component (via parent) | Receives streaming partial data as props |
| `atoms/molecules` | No directive | Render wherever parent renders |
| `/api/analyze` | Edge-compatible Route Handler | Streaming response via SSE |

---

## What Is Not Yet Implemented

- **Rate limiting** — `@upstash/ratelimit` is installed but not applied to the route
- **Persistence** — no database; every analysis is ephemeral
- **Authentication** — the `/api/analyze` endpoint is public
- **Error recovery** — network failures show a generic SweetAlert, no retry logic
- **Image pre-validation** — client does not verify image dimensions or content before upload
