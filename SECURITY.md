# Security Audit — FormCheck

Audited: 2026-04-15

---

## Issues

| # | Severity | Title | Status |
|---|----------|-------|--------|
| 1 | 🔴 Critical | SSRF in `/api/analyze-video` | Fixed |
| 2 | 🟠 High | Rate limiting bypassable (no IP fallback) | Fixed |
| 3 | 🟠 High | Wildcard CORS on API routes | Fixed |
| 4 | 🟠 High | Missing Content-Security-Policy | Fixed |
| 5 | 🟠 High | Prompt injection via user-supplied fields | Fixed |
| 6 | 🟡 Medium | `mediaType` not validated in analyze-video | Fixed |
| 7 | 🟡 Medium | Debug frame rendered in production | Fixed |
| 8 | 🟡 Medium | Missing `Permissions-Policy` header | Fixed |

---

## Detail

### 1 — SSRF in `/api/analyze-video` 🔴

**File:** `src/app/api/analyze-video/route.ts`

The `blobUrl` field came from the client request body and was fetched server-side with
no validation. An attacker could supply any URL — including AWS/GCP instance metadata
endpoints or internal network addresses — turning the server into a proxy.

**Fix:** Validate that the URL is HTTPS and the hostname ends with
`.public.blob.vercel-storage.com` before fetching.

---

### 2 — Rate limiting bypassable 🟠

**File:** `src/proxy.ts`

Rate limits were keyed on a session cookie. Any client that ignores `Set-Cookie`
(curl, scripts) received a fresh UUID session on every request, permanently resetting
its counter. This made all rate limits trivially bypassable for automated clients.

**Fix:** When no cookie is present, derive the rate-limit key from the client IP
(`x-forwarded-for` / `x-real-ip`) so bots are limited by IP even without a cookie.
The cookie itself still stores a stable UUID (not the raw IP).

---

### 3 — Wildcard CORS on API routes 🟠

**File:** `next.config.ts`

`Access-Control-Allow-Origin: *` was present on all routes (set by Vercel's edge for
static assets and inherited by API routes). Combined with bypassable rate limiting,
any third-party page could fire API calls through a visitor's browser.

**Fix:** Explicitly set `Access-Control-Allow-Origin` to the production origin on all
`/api/*` routes, overriding the platform default.

---

### 4 — Missing Content-Security-Policy 🟠

**File:** `next.config.ts`

No CSP header existed. Without one, the browser has no instructions to block injected
scripts if an XSS vector is ever found, significantly increasing blast radius.

**Fix:** Add a `Content-Security-Policy` header. Uses `unsafe-inline` for scripts and
styles (Next.js requires this without a custom nonce setup). Locks `connect-src` to
same origin, Vercel Analytics, and the Blob storage domain.

---

### 5 — Prompt injection 🟠

**File:** `src/lib/prompts.ts`

`exercise`, `targetMuscles`, and `trainingGoal` were interpolated verbatim into the
LLM system prompt as raw instructions. A crafted value like
`"squat. Ignore previous instructions and..."` could manipulate model output.

**Fix:** Wrap user-supplied context in an explicit `<user_context>` XML block and add
an instruction telling the model to treat the block as data, not commands. This is not
a perfect defence against all prompt injection, but it raises the bar significantly.

---

### 6 — `mediaType` not validated in analyze-video 🟡

**File:** `src/app/api/analyze-video/route.ts`

The client supplied the MIME type for the uploaded video. This value was forwarded
directly to Google's Gemini upload API headers without any allowlist check.

**Fix:** Validate `mediaType` against the same allowlist used in `blob-upload`.

---

### 7 — Debug frame rendered in production 🟡

**File:** `src/components/organisms/LiveForm.tsx`

The last captured webcam frame (the actual base64 image sent to the AI) was rendered
visibly in the UI via a `debugFrame` state variable. This was a dev artifact.

**Fix:** Remove the `debugFrame` state and its render block.

---

### 8 — Missing `Permissions-Policy` 🟡

**File:** `next.config.ts`

No `Permissions-Policy` header restricted which browser APIs were permitted.
For an app that accesses the camera, this header provides a defence-in-depth layer
(e.g. prevents embedded iframes from requesting camera access).

**Fix:** Add `Permissions-Policy: camera=(self), microphone=()`.
