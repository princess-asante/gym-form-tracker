# Gym Form Tracker — Architectural Redesign

> **Note:** The Figma link requires auth and could not be fetched directly. The design system analysis below is derived from token extraction across the existing codebase. Reconcile color tokens, spacing, and any net-new components against the Figma prototype manually.

---

## Step 1: Design System Analysis

### 1.1 Token Extraction from Current Code

The design system is implicit in the Tailwind classes scattered across components. Extracting it makes the contract explicit and prevents drift.

**Color palette** (observed usage):
```
Background surfaces:
  zinc-50 / zinc-100 / zinc-200      (light mode cards, inputs, borders)
  zinc-800 / zinc-900                (dark mode surfaces, primary button)

Semantic colors:
  emerald-500/600/400                (positives, good feedback)
  amber-500/700/300                  (medium severity)
  red-500/700/300                    (high severity, permission errors)
  blue-400/700/300                   (low severity)

Text:
  zinc-900 / zinc-800                (primary)
  zinc-600 / zinc-500 / zinc-400     (secondary, muted)
  zinc-300                           (disabled)
  white                              (on dark surfaces)
```

**Spacing scale used**: 1 / 1.5 / 2 / 3 / 4 / 5 / 6 / 8 (gap/padding)

**Radius tokens**:
```
rounded-full    → pill (buttons, badges, tags)
rounded-2xl     → card/panel surfaces
rounded-xl      → media containers
rounded-lg      → inputs, dropdowns
```

**Typography scale**:
```
text-2xl font-semibold tracking-tight   → page heading
text-sm font-medium                     → labels, buttons
text-sm leading-relaxed                 → body feedback text
text-xs                                 → meta, timestamps, section labels
text-xs font-semibold uppercase tracking-widest → section headings
```

### 1.2 Target Design Token System

These become CSS custom properties in `globals.css`, referenced by Tailwind v4's `@theme` block. Tailwind v4 already supports `@theme inline {}` for this — the missing step is naming things semantically rather than by color scale.

```css
/* src/styles/tokens.css */
@layer base {
  :root {
    /* Surface */
    --surface-0: theme(colors.white);
    --surface-1: theme(colors.zinc.50);
    --surface-2: theme(colors.zinc.100);
    --border:    theme(colors.zinc.200);

    /* Text */
    --text-primary:   theme(colors.zinc.900);
    --text-secondary: theme(colors.zinc.600);
    --text-muted:     theme(colors.zinc.400);
    --text-disabled:  theme(colors.zinc.300);

    /* Feedback semantic */
    --severity-high:   theme(colors.red.500);
    --severity-medium: theme(colors.amber.500);
    --severity-low:    theme(colors.blue.400);
    --positive:        theme(colors.emerald.500);

    /* Radius */
    --radius-pill: 9999px;
    --radius-card: 1rem;       /* 16px */
    --radius-input: 0.5rem;    /* 8px */
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --surface-0: theme(colors.zinc.950);
      --surface-1: theme(colors.zinc.900);
      --surface-2: theme(colors.zinc.800);
      --border:    theme(colors.zinc.800);
      --text-primary:   theme(colors.zinc.50);
      --text-secondary: theme(colors.zinc.400);
      --text-muted:     theme(colors.zinc.500);
    }
  }
}
```

**Why CSS variables over Tailwind config?** They are consumable by plain CSS, Storybook themes, and future design system consumers without coupling them to the Tailwind build pipeline. The token names express intent (`--surface-1`), not value (`--zinc-50`), so a rebrand changes one file.

### 1.3 Component Hierarchy (Atomic Design — Revised)

The current atomic breakdown is correct in intent but incorrectly categorised in one area: `WorkoutSelector` is a molecule pretending to be domain-agnostic but it hard-codes exercise domain knowledge.

**Atoms** (pure, no domain logic):
- `Button` — variants: `primary | ghost | danger`
- `Badge` — severity chip
- `Spinner`
- `Icon` — currently SVGs are inlined everywhere; extract to a typed component
- `SkeletonBlock` — currently inlined as ad-hoc divs in FeedbackItem; should be a reusable primitive

**Molecules** (composed atoms, still UI-pure):
- `FeedbackItem` — title + badge + description, skeleton state
- `Dropzone` — generic drag/drop zone; currently duplicated as `ImageDropzone` and `VideoDropzone`
- `SectionHeading` — currently defined locally inside `FeedbackPanel` but used enough to extract
- `FormField` — label + control wrapper, used in `WorkoutSelector`

**Organisms** (feature-aware, may hold local UI state):
- `WorkoutSelector` — knows about exercise/muscle domain data
- `FeedbackPanel` — composes FeedbackItems into sections
- `LiveFeedbackDisplay` — real-time cue rendering
- `CameraPreview` — manages video element binding

**Feature Views** (own async state, act as containers):
- `PhotoAnalysisView`
- `VideoAnalysisView`
- `LiveAnalysisView`

---

## Step 2: Target Architecture

### 2.1 Folder Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze-photo/route.ts     ← thin handler, delegates to service
│   │   ├── analyze-video/route.ts
│   │   ├── analyze-stream/route.ts
│   │   └── blob-upload/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── components/
│   ├── ui/                            ← design system primitives (atoms + molecules)
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Dropzone.tsx               ← generic; replaces ImageDropzone + VideoDropzone
│   │   ├── FeedbackItem.tsx
│   │   ├── Icon.tsx
│   │   ├── SectionHeading.tsx
│   │   ├── SkeletonBlock.tsx
│   │   ├── Spinner.tsx
│   │   └── index.ts                   ← barrel export
│   │
│   ├── features/
│   │   ├── analysis/                  ← shared across all three modes
│   │   │   ├── FeedbackPanel.tsx
│   │   │   └── WorkoutSelector.tsx
│   │   ├── photo/
│   │   │   └── PhotoAnalysisView.tsx  ← container: owns usePhotoAnalysis
│   │   ├── video/
│   │   │   └── VideoAnalysisView.tsx  ← container: owns useVideoAnalysis
│   │   └── live/
│   │       ├── CameraPreview.tsx
│   │       ├── LiveFeedbackDisplay.tsx
│   │       └── LiveAnalysisView.tsx   ← container: owns useLiveSession
│   │
│   └── layout/
│       ├── TabNav.tsx
│       └── AppShell.tsx
│
├── hooks/
│   ├── useCamera.ts                   ← MediaStream lifecycle, permission state
│   ├── useFrameCapture.ts             ← canvas frame extraction, interval control
│   ├── usePhotoAnalysis.ts            ← wraps useObject for photo mode
│   ├── useVideoAnalysis.ts            ← wraps useObject + blob upload for video mode
│   └── useLiveSession.ts              ← state machine: idle → active → stopped
│
├── server/                            ← server-only; never imported by client code
│   ├── services/
│   │   ├── analyzePhoto.ts            ← business logic extracted from route handler
│   │   ├── analyzeVideo.ts
│   │   └── analyzeFrame.ts
│   └── lib/
│       ├── geminiUpload.ts            ← Gemini resumable upload protocol
│       └── middleware.ts              ← rate limiting wrapper for route handlers
│
├── lib/                               ← shared between client and server
│   ├── schemas.ts
│   ├── constants.ts
│   ├── prompts.ts
│   ├── logger.ts
│   ├── api.ts
│   └── errors.ts                      ← typed error classes
│
└── styles/
    └── tokens.css
```

**Key boundaries:**
- `src/server/` is strictly server-only. Importing it in a Client Component would be a TypeScript/Next.js error via the `server-only` package. Route handlers call into services; services call AI providers.
- `src/hooks/` is client-only.
- `src/lib/` is shared — schemas, constants, and prompts cross the boundary.

### 2.2 Architectural Patterns and Justification

#### Container / Presenter

The three `*View` components are containers: they own async state, orchestrate hooks, and pass derived props down. `FeedbackPanel`, `LiveFeedbackDisplay`, and `CameraPreview` are presenters: they receive data and render it.

This is the highest-leverage change in the codebase. Currently, `LiveForm.tsx` is simultaneously a container (owns camera permission, interval scheduling, streaming state) and a presenter (renders the camera UI, feedback cues, stop button). That coupling makes it untestable and unmaintainable.

After the split: you can test `LiveFeedbackDisplay` by rendering it with mock feedback. You can test `useLiveSession` by asserting on state transitions without touching the DOM.

#### Custom Hooks for Logic Extraction

Each analysis mode has a distinct async lifecycle that doesn't belong in components:

- `useCamera` — wraps `getUserMedia`, cleanup on unmount, permission error state. Currently duplicated across `LiveForm` as inline logic.
- `useFrameCapture` — manages the `setInterval`, reads `videoRef`, draws to `HTMLCanvasElement`, produces a base64 frame. Currently an effect inside `LiveForm`. Extracting it means the interval's correctness is testable in isolation.
- `useLiveSession` — orchestrates `useCamera` + `useFrameCapture` + `useObject` into a coherent state machine (see Step 4).

#### Service Layer on the Server

Each API route currently inlines: input validation, image/video processing, provider SDK call, error handling, and retry logic. A service function extracts the core operation:

```typescript
// src/server/services/analyzePhoto.ts
import 'server-only'
import { anthropic } from '@ai-sdk/anthropic'
import { Output, streamText } from 'ai'
import sharp from 'sharp'
import { FormFeedbackSchema } from '@/lib/schemas'
import { buildSystemPrompt } from '@/lib/prompts'
import { InvalidImageError } from '@/lib/errors'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_BASE64_BYTES = 6.8 * 1024 * 1024

export type AnalyzePhotoInput = {
  image: string       // base64 data URL
  exercise?: string
  targetMuscles?: string[]
}

export async function analyzePhoto({ image, exercise, targetMuscles }: AnalyzePhotoInput) {
  const [header, base64Data] = image.split(',')
  const mediaType = header.match(/:(.*?);/)?.[1]

  if (!base64Data || !mediaType) {
    throw new InvalidImageError('Missing base64 data or media type')
  }
  if (!(ACCEPTED_TYPES as readonly string[]).includes(mediaType)) {
    throw new InvalidImageError(`Unsupported type: ${mediaType}`)
  }
  if (base64Data.length > MAX_BASE64_BYTES) {
    throw new InvalidImageError('Image exceeds 5 MB limit')
  }

  const imageBuffer = await sharp(Buffer.from(base64Data, 'base64')).toBuffer()

  return streamText({
    model: anthropic('claude-sonnet-4-6'),
    output: Output.object({ schema: FormFeedbackSchema }),
    system: buildSystemPrompt('image', { exercise, targetMuscles }),
    messages: [{
      role: 'user',
      content: [
        { type: 'image', image: imageBuffer, mediaType: mediaType as typeof ACCEPTED_TYPES[number] },
        { type: 'text', text: 'Please analyse my exercise form.' },
      ],
    }],
  })
}
```

The route handler becomes a thin transport layer:

```typescript
// src/app/api/analyze-photo/route.ts
import { analyzePhoto } from '@/server/services/analyzePhoto'
import { withRateLimit } from '@/server/lib/middleware'
import { errorResponse } from '@/lib/api'
import { InvalidImageError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export const POST = withRateLimit(async (request: Request) => {
  const body = await request.json()
  try {
    const result = await analyzePhoto(body)
    return result.toTextStreamResponse()
  } catch (err) {
    if (err instanceof InvalidImageError) {
      return errorResponse(err.message, err.statusCode)
    }
    throw err
  }
})
```

**Why a service layer?** It decouples testability (you can unit test `analyzePhoto` without an HTTP context), enables provider swapping (the route doesn't know or care which SDK you use), and gives you a single place to add caching, logging, or metrics.

### 2.3 State Flow

```
User Action
    │
    ▼
Feature View (container)
    │  owns: useXxxAnalysis() hook result
    │  passes: derived state as typed props
    ▼
Presenter Components
    │  no state, no side effects
    │  emit: callbacks up to container
    ▼
UI atoms / molecules
```

Side effects (camera access, intervals, AI streaming) live exclusively in hooks. Components dispatch events (button clicks, file drops) and receive derived state. This is unidirectional: data flows down, events flow up.

---

## Step 3: Codebase Redesign — Before / After

### 3.1 `LiveForm.tsx` — God Component

**What's wrong:** 6 refs, 8 state variables, 5 effects/intervals, 5 distinct concerns in one file. Untestable. A missed cleanup path is a memory leak.

**What changes:** Split into three layers.

**Layer 1 — `useCamera` hook:**

```typescript
// src/hooks/useCamera.ts
'use client'

import { useState, useEffect } from 'react'

type CameraState =
  | { status: 'idle' }
  | { status: 'active'; stream: MediaStream }
  | { status: 'error'; reason: 'permission-denied' | 'not-found' }

export function useCamera() {
  const [state, setState] = useState<CameraState>({ status: 'idle' })

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setState({ status: 'active', stream })
    } catch (err) {
      const reason = (err as Error).name === 'NotFoundError'
        ? 'not-found'
        : 'permission-denied'
      setState({ status: 'error', reason })
    }
  }

  const stop = () => {
    if (state.status === 'active') {
      state.stream.getTracks().forEach(t => t.stop())
    }
    setState({ status: 'idle' })
  }

  // Cleanup on unmount — prevents camera light staying on after navigation
  useEffect(() => {
    return () => {
      if (state.status === 'active') {
        state.stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [state])

  return { state, start, stop }
}
```

**Layer 2 — `useFrameCapture` hook:**

```typescript
// src/hooks/useFrameCapture.ts
'use client'

import { useEffect, useRef } from 'react'

type FrameCaptureOptions = {
  videoRef: React.RefObject<HTMLVideoElement>
  enabled: boolean
  intervalMs: number
  onFrame: (base64: string) => void
}

export function useFrameCapture({ videoRef, enabled, intervalMs, onFrame }: FrameCaptureOptions) {
  // Stable ref so the interval closure always sees the latest onFrame
  const onFrameRef = useRef(onFrame)
  useEffect(() => { onFrameRef.current = onFrame }, [onFrame])

  useEffect(() => {
    if (!enabled) return

    const id = setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      onFrameRef.current(canvas.toDataURL('image/jpeg', 0.8))
    }, intervalMs)

    return () => clearInterval(id)
  }, [enabled, intervalMs, videoRef])
}
```

**Layer 3 — `useLiveSession` state machine** (see Step 4)

**Layer 4 — `LiveAnalysisView` container (thin wiring):**

```typescript
// src/components/features/live/LiveAnalysisView.tsx
'use client'

export function LiveAnalysisView() {
  const { state: sessionState, start, stop, feedback, stopReason } = useLiveSession()
  const videoRef = useRef<HTMLVideoElement>(null)

  const stream = sessionState.status === 'active' ? sessionState.stream : null

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-4">
        <CameraPreview
          ref={videoRef}
          stream={stream}
          permissionError={sessionState.status === 'error'}
        />
        <WorkoutSelector
          {...workoutProps}
          disabled={sessionState.status === 'active'}
        />
        <Button onClick={sessionState.status === 'active' ? stop : start}>
          {sessionState.status === 'active' ? 'Stop session' : 'Start session'}
        </Button>
      </div>

      {sessionState.status === 'active' && (
        <LiveFeedbackDisplay feedback={feedback} />
      )}
      {stopReason && (
        <p className="text-sm text-red-500 text-center">{stopReason}</p>
      )}
    </div>
  )
}
```

### 3.2 `AnalyzeVideoForm.tsx` — Business Logic in UI

**What's wrong:** Two-phase upload/analysis orchestration (blob upload → analysis trigger) is inlined inside the component. The `fetch` override prop of `useObject` is the wrong seam for this — it makes the component aware of protocol details.

**What changes:** Extract to `useVideoAnalysis`:

```typescript
// src/hooks/useVideoAnalysis.ts
'use client'

import { useState, useRef } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { upload } from '@vercel/blob/client'
import { VideoFormFeedbackSchema } from '@/lib/schemas'

type Phase = 'idle' | 'uploading' | 'analyzing'

export function useVideoAnalysis() {
  const [phase, setPhase] = useState<Phase>('idle')
  const fileRef = useRef<File | null>(null)

  const { object, submit } = useObject({
    api: '/api/analyze-video',
    schema: VideoFormFeedbackSchema,
    onFinish: () => setPhase('idle'),
    onError: () => setPhase('idle'),
    fetch: async (input, init) => {
      const file = fileRef.current
      if (!file) throw new Error('No file selected')

      setPhase('uploading')
      const { url: blobUrl } = await upload(`${Date.now()}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',
        contentType: file.type,
      })

      setPhase('analyzing')
      const res = await fetch(input, {
        ...init,
        body: JSON.stringify({ blobUrl, mediaType: file.type }),
      })

      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        throw new Error(error)
      }
      return res
    },
  })

  return {
    phase,
    object,
    setFile: (f: File) => { fileRef.current = f },
    analyze: () => submit({}),
  }
}
```

### 3.3 Duplicated `ImageDropzone` / `VideoDropzone`

Both share identical drag/drop mechanics — only the accepted file type and preview rendering differ. Replace with a generic `Dropzone`:

```typescript
// src/components/ui/Dropzone.tsx
type DropzoneProps<T> = {
  accept: string
  value: T | null
  onFile: (file: File) => void
  renderPreview: (value: T) => React.ReactNode
  renderEmpty: () => React.ReactNode
  disabled?: boolean
}
```

The specialization (`image/*` vs `video/*`) is passed as `accept` + `renderPreview`. This eliminates ~80 lines of duplicated drag/drop state logic.

### 3.4 Uniform Error Handling

Three routes, three error strategies. Introduce typed error classes and a uniform error response shape:

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
  }
}
export class InvalidImageError extends AppError {
  constructor(msg: string) { super(msg, 400) }
}
export class FileTooLargeError extends AppError {
  constructor() { super('File exceeds size limit', 413) }
}
export class StorageError extends AppError {
  constructor(msg: string) { super(msg, 502) }
}
```

All routes catch `AppError` instances and call `errorResponse(err.message, err.statusCode)`. Unknown errors become 500s. Three files, one contract.

---

## Step 4: Design Patterns

### 4.1 State Machine for `useLiveSession`

`LiveForm` has five implicit states: `idle → requesting-permission → active → stopping → error`. These are currently expressed through scattered booleans and refs. Illegal transitions (e.g., capturing frames while stopping) are possible and not guarded.

Use `useReducer` with an explicit state enum — no XState dependency needed at this scale:

```typescript
// src/hooks/useLiveSession.ts
type SessionState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'active'; stream: MediaStream }
  | { status: 'error'; reason: 'permission-denied' }
  | { status: 'stopped'; reason: string }

type SessionAction =
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED'; stream: MediaStream }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'STOP'; reason?: string }
  | { type: 'RESET' }

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'REQUEST_PERMISSION':
      if (state.status !== 'idle') return state    // guard illegal transition
      return { status: 'requesting' }
    case 'PERMISSION_GRANTED':
      if (state.status !== 'requesting') return state
      return { status: 'active', stream: action.stream }
    case 'PERMISSION_DENIED':
      return { status: 'error', reason: 'permission-denied' }
    case 'STOP':
      return { status: 'stopped', reason: action.reason ?? 'User stopped session' }
    case 'RESET':
      return { status: 'idle' }
    default:
      return state
  }
}
```

**Why `useReducer` over XState?** XState is the right tool when transitions have side effects, guards, and you need visualisation. At this scale, `useReducer` with an exhaustive switch gives you the same illegal-state prevention without adding a 30 kB dependency or a learning curve. You can migrate to XState incrementally if the state machine grows.

**What this fixes:** The unrecognised-exercise timeout currently mutates `unrecognisedTimeoutRef` across multiple callbacks. With the state machine, `STOP` with `reason: 'No workout detected after 30s'` is dispatched by a timeout scheduled inside the hook — the component only sees `state.status === 'stopped'` and renders accordingly.

### 4.2 Compound Component (FeedbackPanel)

`FeedbackPanel` renders three conceptually distinct sections. If the Figma adds a fourth (e.g., video timestamps), you currently add a new section by editing one large component. A compound component pattern makes each section independently composable:

```typescript
// Usage:
<FeedbackPanel feedback={object}>
  <FeedbackPanel.Overall />
  <FeedbackPanel.Positives />
  <FeedbackPanel.Issues />
</FeedbackPanel>

// Implementation: shared context
const FeedbackContext = React.createContext<DeepPartial<FormFeedback>>({})

function FeedbackPanel({ feedback, children }: { feedback: DeepPartial<FormFeedback>; children: React.ReactNode }) {
  return <FeedbackContext.Provider value={feedback}>{children}</FeedbackContext.Provider>
}
FeedbackPanel.Overall = function Overall() {
  const { overallAssessment } = useContext(FeedbackContext)
  // ...
}
```

**Trade-off:** Compound components add an indirection layer. For the current two-section layout, this may be premature. Apply it when a third distinct section (video timestamps, rep count) is confirmed in the Figma — not before.

### 4.3 Rate Limiting Middleware Pattern

`@upstash/ratelimit` is installed but wired to nothing. The correct pattern is a higher-order function that wraps route handlers — not inline per route:

```typescript
// src/server/lib/middleware.ts
import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { errorResponse } from '@/lib/api'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),  // 10 req/min per IP
})

type RouteHandler = (req: Request) => Promise<Response>

export function withRateLimit(handler: RouteHandler): RouteHandler {
  return async (request) => {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success, limit, remaining } = await ratelimit.limit(ip)
    if (!success) {
      return errorResponse('Rate limit exceeded', 429)
    }
    const response = await handler(request)
    response.headers.set('X-RateLimit-Limit', String(limit))
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    return response
  }
}
```

All three analysis routes are wrapped: `export const POST = withRateLimit(async (request) => { ... })`. Adding auth later follows the same pattern: `withAuth(withRateLimit(handler))`.

---

## Step 5: Scalability & Future Proofing

### Team Scalability

The feature-based folder structure (`components/features/photo/`, `/video/`, `/live/`) means three developers can work on three modes concurrently without touching each other's files. Shared UI changes touch only `components/ui/`. This is the most practical win for team growth.

The current structure (all organisms in a flat `organisms/` directory) creates a false shared-ownership problem: any change to `FeedbackPanel` must be coordinated across all modes.

### Feature Scalability

**Adding a fourth analysis mode** (e.g., "compare two photos") requires:
1. New route: `src/app/api/analyze-comparison/route.ts`
2. New service: `src/server/services/analyzeComparison.ts`
3. New hook: `src/hooks/useComparisonAnalysis.ts`
4. New feature view: `src/components/features/comparison/ComparisonView.tsx`
5. New tab in `TabNav`

No existing file is modified. With the current structure, you'd be editing `page.tsx`, `organisms/`, and adding a new API route — not terrible, but the boundaries aren't enforced.

### Performance Considerations

**Canvas element allocation in `useFrameCapture`:** Each frame creates a new `HTMLCanvasElement`. These are GC'd but under a 5s interval they should be fine. If the interval is ever reduced (e.g., 1s), reuse a single off-screen canvas via `useRef`.

**`useObject` re-renders on every token:** The AI SDK streaming hook triggers a re-render per streamed token. `FeedbackPanel` should be memoized with `React.memo` with a shallow-equality comparison if rendering becomes expensive. Not necessary now — flag it for when the schema grows.

**`sweetalert2` (6.6 kB gzipped):** Used only for error modals. Replace with a lightweight toast component or a React context-based notification system. Reduces the bundle and removes the only UI library dependency without design system alignment.

### Testing Strategy

| Layer | Test type | Tool | What to test |
|---|---|---|---|
| `analyzePhoto` service | Unit | Vitest + `msw` | Validates image format rejection, size limits, returns correct schema |
| `useCamera` | Unit | Vitest + `@testing-library/react` | Permission granted/denied state transitions |
| `useLiveSession` reducer | Unit | Vitest | Every state transition, illegal transitions return current state |
| `FeedbackPanel` | Component | React Testing Library | Renders skeletons during loading, renders content when fully streamed |
| Photo/Video analysis flows | Integration | Playwright | File drop → submit → streaming feedback appears |

The container/presenter split is the prerequisite for this testing strategy. You can't unit test `LiveForm.tsx` in its current form without mocking `getUserMedia`, `setInterval`, and the AI SDK simultaneously.

### Potential Failure Points

1. **Gemini polling loop has no hard timeout.** The `while (state !== 'ACTIVE')` loop in `analyzeVideo` will silently breach Vercel's 60s function timeout. Add a max-iterations guard: `let polls = 0; while (state !== 'ACTIVE' && polls++ < 15)`.

2. **`after()` blob deletion is fire-and-forget.** If the deletion fails, orphaned blobs accumulate. Add a `logger.error` in the `after` callback and consider a scheduled cleanup job if blob costs become significant.

3. **No persistence.** Every analysis is ephemeral. This is fine now but means you can't improve prompts with real data. When you add a database, the service layer is the right insertion point — `analyzePhoto` saves the result before returning the stream.

4. **Tab state resets on navigation.** The current tab state lives in `page.tsx`. If the user navigates away and back, they lose their selected mode. Use URL search params (`?mode=video`) instead of React state — it's linkable and survives refresh.

---

## Step 6: Summary

### Architecture Overview

```
Browser                             Server
──────────────────────────────────  ────────────────────────────────────────
Feature View (container)
  │  useLiveSession / useVideoAnalysis / usePhotoAnalysis
  │  ↓ derived state
Presenter Components                Route Handler (thin)
  │  CameraPreview                   │  withRateLimit(withAuth(handler))
  │  FeedbackPanel                   │    ↓
  │  LiveFeedbackDisplay             Service (business logic)
  │                                  │  analyzePhoto / analyzeVideo / analyzeFrame
  │  ↑ events (callbacks)            │    ↓
UI atoms (Button, Badge, …)        AI Provider (Anthropic / Google)
```

### Key Design Decisions

| Decision | Rationale | Trade-off |
|---|---|---|
| Service layer in `src/server/services/` | Decouples route transport from AI logic; enables testing | Adds one indirection layer per route |
| Custom hooks over inline effects | Single responsibility; testable in isolation | More files; requires discipline to not leak state back into components |
| `useReducer` state machine for live session | Eliminates illegal states; auditable transitions | More verbose than scattered booleans; initial investment in defining the state graph |
| Generic `Dropzone` over two specific ones | DRY; consistent drag/drop behavior | `accept` prop type must be well-defined to prevent misuse |
| CSS custom property tokens | Framework-agnostic; survives Tailwind version changes | Requires discipline to use semantic names vs. reaching for `zinc-500` directly |
| `withRateLimit` HOF over per-route inline | Single implementation; composable with future auth | Requires Redis in all environments including local dev (use mock in dev) |
| `server-only` on `src/server/` | Compile-time guard against client bundle leaking API keys | Small friction; requires adding the package |

### Before vs. After

| Concern | Before | After |
|---|---|---|
| `LiveForm` size | 174 lines, 5 concerns | `LiveAnalysisView` ~40 lines; logic in 3 hooks |
| Rate limiting | Installed, unused | Applied to all 3 analysis routes via `withRateLimit` |
| Error contracts | 3 different shapes across 3 routes | Single `AppError` hierarchy, uniform response |
| Dropzone logic | Duplicated in `ImageDropzone` + `VideoDropzone` | Single `Dropzone` component, accept/preview as props |
| Video upload orchestration | Inside component `fetch` override | Extracted to `useVideoAnalysis` hook |
| State transitions (live) | Implicit booleans + refs | Explicit `useReducer` with guarded transitions |
| Provider swap | Requires editing route file | Swap model in service function; route unaffected |
| Testing surface | Near zero (all logic in components) | Hooks, services, and presenters independently testable |
