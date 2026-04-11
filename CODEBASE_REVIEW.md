# Codebase Review — Gym Form Tracker

## Overall Score: 5.5 / 10

This score assumes production-grade expectations. The code shows genuine engineering skill in specific areas — streaming architecture, schema design, multi-model routing — but has systemic gaps in reliability, testability, observability, and state management that would make it risky to operate at scale. It reads like a well-built prototype one refactor away from being production-ready.

---

## High-Level Summary

The Gym Form Tracker is a Next.js 15 App Router app using the Vercel AI SDK for structured LLM streaming. It routes three distinct media types (static image, video clip, live camera frames) to different AI models (Claude Sonnet 4.6 for images, Gemini 2.5 Flash Lite for video/live) via separate API routes, and renders streaming partial JSON feedback in real time.

The architecture is intentional and mostly coherent. The core streaming pipeline is well-designed. However, the system accumulates significant fragility in its stateful client logic, has no observability layer, no test suite, no auth, and no rate limiting despite having those packages installed. The separation of concerns breaks down at the component level, where UI and business logic are co-located.

---

## Architecture Review

### What's good

**Multi-model routing is correctly designed.** Different models serve different latency/capability tradeoffs: Claude for richer image analysis, Gemini for cost-efficient high-frequency live frames. This is the right call and is cleanly expressed via route separation.

**Schema-first design is solid.** `src/lib/schemas.ts` uses Zod with embedded descriptions that double as LLM instructions. This is a legitimate pattern for structured output prompting, and the schemas are appropriately minimal per use case (`LiveFeedback` is deliberately sparse).

**The two-phase video upload** (`blob-upload` → `analyze-video`) correctly offloads large payloads outside the serverless request boundary. Streaming blob bytes directly to Gemini's resumable upload without buffering is the right approach.

### What's concerning

**No layering between API and AI.** The route handlers in `src/app/api/` contain validation, prompt construction, SDK calls, and retry logic all inline. There's no service layer, no repository, nothing. When you change the AI provider or add caching, you'll be editing route files directly.

**Component responsibility bleed.** `LiveForm.tsx` is an organism that manages camera permissions, interval scheduling, canvas frame capture, ref coordination, auto-stop timers, and display state simultaneously. That's 5–6 distinct concerns in one component. This will become unmaintainable.

**Hardcoded constants scattered across files.** The capture interval (5 seconds), auto-stop timeout (30 seconds), blob size limits (50 MB), and image size limits (5 MB) live in the files that use them, not in a shared config.

**Public API surface with no auth or rate limiting.** All routes are unauthenticated. `@upstash/ratelimit` and `@upstash/redis` are installed but wired to nothing. This is a direct path to abuse and cost blowup.

---

## Code Smells & Quality Issues

**`LiveForm.tsx` — God Component**
Six mutable refs, eight state variables, five effects or interval callbacks. The auto-stop logic (`unrecognisedTimeoutRef`), frame capture scheduling (`intervalRef`), and streaming state (`isAnalysingRef`) are entangled. A single missed cleanup path produces a memory leak or a ghost interval post-unmount. This needs a proper state machine.

**`AnalyzeVideoForm.tsx` — Inline two-phase orchestration**
The fetch function inside the component manually sequences blob upload → analysis trigger with phase state tracking. This is business logic embedded in a UI component. If that two-phase sequence needs retry, logging, or timeout handling, you're adding it here, and this file grows without bound.

**`@ts-expect-error` in `analyze-video/route.ts`**
Suppressing a TypeScript error on `duplex: "half"` is justifiable (Node fetch quirk), but the comment doesn't explain which TypeScript version or which SDK version introduced the gap. This becomes a silent landmine when either is upgraded.

**Inconsistent error handling surface**
`analyze-photo/route.ts` throws with plain `Response` objects. `analyze-video/route.ts` uses structured retry logic with exponential backoff. `analyze-stream/route.ts` logs but has no explicit error boundary. Three routes, three error strategies.

**Unused installed packages**
`@upstash/ratelimit`, `@upstash/redis` are in `package.json` and unused. They inflate the dependency surface, which matters for supply chain risk and bundle audits.

**Hardcoded exercise and muscle lists in `WorkoutSelector.tsx`**
These are domain data masquerading as UI constants. They belong in a typed constants module or eventually a database/CMS. When you add exercises, you're touching a presentational component.

**No client-side input validation before submission**
`AnalyzeForm` submits the base64 image directly to the API. The API validates it, but there's no client-side guard on file type or rough size before initiating the network round-trip. The user gets no feedback until the server rejects it.

---

## Design Patterns Found

**Schema Object Pattern (Zod + inferred types)**
Used correctly in `src/lib/schemas.ts`. Zod schemas serve as both runtime validation and TypeScript type source, plus LLM prompt instructions via `.describe()`. Clean and idiomatic.

**Adapter Pattern (implicit, in API routes)**
Each route adapts a different provider SDK (Anthropic, Google AI) to a uniform `streamText` → `toTextStreamResponse()` interface. The caller (client component) doesn't know which model was invoked. This is structurally good but not explicitly abstracted — if you need to add a third model or swap one out, you're copying route logic.

**Compound Component Pattern (partial)**
`FeedbackPanel` renders positives and issues in distinct sections with consistent `FeedbackItem` rendering. It's not a full compound component (no shared context), but the decomposition is sensible.

**Skeleton UI Pattern**
`FeedbackPanel` and `FeedbackItem` correctly handle `DeepPartial` streaming data with skeleton placeholders. This is the right UX pattern for progressive JSON streaming.

**Optimistic/Progressive Rendering**
`useObject` from `@ai-sdk/react` receives partial schema objects during streaming. `FeedbackPanel` renders whatever has arrived. This is a correct application of the SDK's streaming capability.

---

## Missing Design Patterns & Improvements

### 1. Service Layer / Use Case Pattern — Critical

There's no abstraction between the HTTP route and the AI provider call. The correct pattern is:

```
Route Handler → validates input, delegates to service
Service        → builds context, calls provider abstraction, returns domain object
Provider       → wraps SDK, handles retries, formats errors
```

Apply this to all three analyze routes. A concrete step: extract an `analyzeImage(input: AnalyzeImageInput): Promise<FormFeedback>` function into `src/lib/services/` that the route handler calls. This decouples testability, allows provider swapping, and centralizes retry/error logic.

### 2. State Machine (XState or useReducer) for LiveForm — High Priority

`LiveForm` has implicit state transitions: `idle → requesting-permission → streaming → capturing → stopped`. Currently these are expressed through scattered boolean refs and state variables. A `useReducer` with explicit action types, or a lightweight XState machine, would make transitions auditable and prevent illegal states (e.g., capturing while stopped).

### 3. Repository / Storage Abstraction

The `analyze-video` route calls Vercel Blob APIs directly. When you add a second storage provider or a database, you rewrite the route. A `StorageRepository` interface with a `VercelBlobStorage` implementation isolates this.

### 4. Strategy Pattern for Model Selection

The choice of Claude vs. Gemini is currently expressed via route file separation. As you add models or A/B test them, a `ModelStrategy` interface (`selectModelForMediaType(type: MediaType): ModelConfig`) makes this explicit and swappable without routing changes.

### 5. Middleware for Cross-Cutting Concerns

Auth, rate limiting, and logging need to apply uniformly across all API routes. These belong in Next.js middleware (`src/middleware.ts`) or a route wrapper utility, not inline in each handler. The current setup means adding auth requires touching four files.

---

## Future Risks

**Rate limiting gap is an active liability.** The packages are installed, implying intent, but the routes are open. A single public share of the URL triggers unbounded AI API calls at your cost.

**LiveForm interval cleanup is fragile.** If the component unmounts mid-analysis (tab switch, navigation), `isAnalysingRef` and `intervalRef` need to be cleared in the right order. The current cleanup logic is likely correct but hasn't been stress-tested; a React Strict Mode double-invoke in development would expose races.

**Gemini polling loop has no hard cap.** The `while` loop in `analyze-video` polling for file state has a maximum iteration count, but the sleep + retry pattern under serverless timeouts (Vercel default: 60s) could silently time out without a clear error surfacing to the user.

**Canvas element leaks in live capture.** Each frame capture creates a new `HTMLCanvasElement` via `document.createElement('canvas')`. These are not appended to the DOM and will be GC'd, but under aggressive capture rates or slow GC, this accumulates.

**No persistence means no feedback loop.** There's no record of what was analyzed, what feedback was given, or whether users found it useful. You can't improve the prompts with real data, and you can't implement history or progress tracking without a schema and database.

**Vendor lock-in on Vercel primitives.** `@vercel/blob`, `@vercel/analytics`, and the assumption of Vercel serverless functions are tightly coupled. Migrating to a different host requires touching blob storage, analytics, and the `after()` API.

---

## Refactoring Plan (Prioritised)

### High Priority

| # | Action | Why |
|---|--------|-----|
| 1 | Wire `@upstash/ratelimit` into a route middleware wrapper | Active security/cost risk on live routes |
| 2 | Extract service functions from API routes (`analyzeImage`, `analyzeVideo`, `analyzeFrame`) | Enables testing, decouples provider from transport |
| 3 | Refactor `LiveForm` to `useReducer` with explicit state enum | Prevents illegal state, makes transitions auditable |
| 4 | ~~Add a uniform error response shape across all routes~~ | ~~Clients get consistent error handling~~ |

### Medium Priority

| # | Action | Why |
|---|--------|-----|
| 5 | ~~Move hardcoded exercise/muscle data to `src/lib/constants.ts`~~ | ~~Domain data in UI component is wrong layer~~ |
| 6 | Add client-side file validation in dropzones (type + size) before submission | Better UX, reduces wasted API calls |
| 7 | Extract `ModelStrategy` abstraction for Claude vs. Gemini selection | Makes model swapping and A/B testing safe |
| 8 | ~~Add structured logging utility (wrapping `console`) across all routes~~ | ~~Observability prerequisite for production~~ |

### Low Priority

| # | Action | Why |
|---|--------|-----|
| 9 | Remove unused `@upstash` packages if not wiring rate limiting immediately | Reduce dependency surface |
| 10 | Add Playwright E2E tests for the three main analysis flows | Catch regressions in streaming UI behavior |
| 11 | Add a `StorageRepository` interface over Vercel Blob | Reduces vendor lock-in, enables mocking in tests |
| 12 | Document the Gemini resumable upload flow with inline comments | Complex protocol, high onboarding cost without docs |

---

*Score justification: The streaming architecture, schema design, and multi-model routing demonstrate real engineering intent and solid fundamentals — those components score well. The score is held down by: zero test coverage, no auth/rate limiting on live endpoints, a god component in `LiveForm`, no service layer, inconsistent error handling, and tight vendor coupling. Each of these individually is a medium risk; collectively they represent a system that will degrade quickly under production load or team growth.*
