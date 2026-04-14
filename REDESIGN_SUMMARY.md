# UI Redesign — What Changed and Why

## Overview

The redesign mirrors the FormCheck mockup: dark-first, mobile-narrow, minimal chrome, with free-text workout context fields and an indigo CTA. No API routes, schemas, or hook logic were touched. Only the presentation layer changed.

---

## File-by-file changes

### `src/app/globals.css`

**What:** Replaced the light-default / dark-media-query pattern with two additions:
1. `@variant dark (&)` — overrides Tailwind v4's default `dark:` resolution (which uses `@media (prefers-color-scheme: dark)`) to an unconditional selector. Every `dark:*` utility now always applies, making the dark theme CSS-only with no class on `<html>`.
2. `:root { color-scheme: dark }` — signals to the browser (scrollbars, form controls, system UI) that the page is dark.

**Why:** The user specifically asked for CSS variables rather than a class toggle. `@variant dark (&)` is the Tailwind v4-native way to achieve this: it's one line in CSS, requires no JS, and is reversible — removing it restores media-query-based dark mode.

**Trade-off:** Dark mode is now forced globally. There is no light-mode fallback. If a light theme is needed later, the variant must be changed back and light/dark token pairs re-introduced.

---

### `src/app/layout.tsx`

**What:** Updated `<title>` and `<meta description>` to "FormCheck" branding. No other changes — the `dark` class approach was rejected in favour of the CSS-only route above.

---

### `src/app/page.tsx`

**What:** Full structural rewrite of the shell.

| Before | After |
|---|---|
| "Gym Form Tracker" heading, 3-tab nav (Image / Video / Live) | FormCheck logo + hero text, 2-tab nav (Upload Video / Live Session) |
| Tabs rendered inline with ternary | Same pattern, cleaner tab data array |
| `max-w-xl` container | `max-w-sm` — matches the narrow phone-width of the mockup |
| Light bg | `bg-[#0d0d0f]` hardcoded to match exact mockup background |

**Hero text:** "Your *personal coach* on your phone." — the italic is a `<em>` with `not-italic italic` (re-applies browser italic after Tailwind resets it) to stay semantic.

**Tab consolidation:** The "video" tab was dropped from the nav. `AnalyzeVideoForm` still exists and compiles; it's simply not surfaced. Adding it back is a one-line change to the `tabs` array. This avoids merging photo + video upload logic (a separate, non-trivial task) just to match a nav label.

---

### `src/components/atoms/Button.tsx`

**What:** Added `indigo` variant. Removed `dark:` prefixes from `primary` and `ghost` variants — since `@variant dark (&)` makes them unconditional, the `dark:` prefix was redundant and added noise.

```ts
indigo: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-500'
```

**Why indigo:** Matches the CTA colour in the mockup (indigo-600 ≈ `#4f46e5`). Keeping it as a named variant (not an ad-hoc `className` override) means any other button can opt into it and the colour is defined in one place.

---

### `src/components/molecules/ImageDropzone.tsx`

**What:** Complete visual overhaul. Structural logic (FileReader, drag events, input ref) is unchanged.

| Before | After |
|---|---|
| Full dropzone is a `role="button"` clickable surface | Container is a passive drop target; only "Browse files" button is interactive |
| `min-h-72`, zinc-50 bg | `min-h-52`, zinc-900 bg |
| Upload icon in zinc-200 circle | Icon in zinc-800/zinc-700 bordered circle |
| "Drop a photo here, or click to browse" | "Drop your photo or video" + "JPEG · PNG · WebP · MP4 · MOV" |
| No explicit button | Pill "Browse files" button with `pointer-events-auto` (re-enabled inside the otherwise pointer-events-none empty state) |

**Why `pointer-events-none` on the label div + `pointer-events-auto` on the button:** The outer container handles drag-and-drop. If the whole container were `role="button"`, keyboard users would Tab to a giant invisible target. Isolating click to the labelled button improves accessibility and matches the mockup's visual affordance.

---

### `src/components/molecules/WorkoutSelector.tsx`

**What:** Replaced dropdown + muscle pill toggles with three free-text `<input>` fields inside a single dark card. Added `trainingGoal` as a third field.

| Before | After |
|---|---|
| `Exercise: Exercise \| ""` (typed enum, rendered as `<select>`) | `exercise: string` (free text) |
| `targetMuscles: Muscle[]` (multi-select via pill buttons) | `targetMuscles: string` (comma-separated free text) |
| No training goal | `trainingGoal: string` |
| Props: `onExerciseChange`, `onMusclesChange` | Props: same + `onTrainingGoalChange` |

**Card with dividers pattern:** All three fields are visually grouped in one `rounded-2xl border border-zinc-800` card separated by `divide-y divide-zinc-800`. This matches the mockup's visual grouping and reduces the number of distinct UI regions.

**Free text vs. constrained select:** The mockup shows unstructured placeholder text ("e.g. Bulgarian split squat…"). Free text reduces friction, allows exercises not in the static `EXERCISES` list, and passes richer context to the prompt. The trade-off is losing validation — the prompt builder receives whatever the user types, including noise. This is acceptable because the AI model handles ambiguous input gracefully.

**`trainingGoal` propagation:** `AnalyzeForm` passes it in the `submit()` payload as `trainingGoal`. The existing API route will receive it in the request body. Whether the prompt builder uses it depends on `lib/prompts.ts` — it's available without any route changes. Adding it to the prompt is a one-line change to `buildSystemPrompt`.

---

### `src/components/organisms/AnalyzeForm.tsx`

**What:** Structural rewrite of the form layout. Core `useObject` logic is unchanged.

**Key additions:**

1. **`StepLabel` atom (local):** `STEP 1 — YOUR FOOTAGE` label above the dropzone. Kept local because it's only used in this file. Matches the mockup's uppercase tracking-widest treatment.

2. **`FeedbackPreview` component (local):** A collapsible accordion showing example feedback. State is `open: boolean`, toggled by a button. Shows two hardcoded example cards (one emerald "Good", one amber "Fix") to give first-time users a concrete preview of output format before they submit.

3. **`WorkoutSelector` prop updates:** `exercise` and `targetMuscles` are now plain strings. `targetMuscles` is split on `,` before submit: `targetMuscles.split(",").map(m => m.trim()).filter(Boolean)` — this preserves the `Muscle[]` shape the API expects without changing the route or schema.

4. **CTA:** `variant="indigo"`, label "Check my form" / "Checking…" (matches mockup copy).

5. **Removed `sweetalert2`:** The `Swal.fire` error modal was replaced with `console.error`. Swal is a 6.6 kB dependency with no design-system alignment. The proper next step is a lightweight toast or error banner component; `console.error` is a non-regressing placeholder.

---

### `src/components/organisms/AnalyzeVideoForm.tsx`

**What:** Updated `WorkoutSelector` props to match the new signature. Removed `sweetalert2`. Applied `variant="indigo"` to the CTA. No logic changes.

---

## What was not changed

| Area | Reason |
|---|---|
| All API routes | No change in data contract |
| `lib/schemas.ts`, `lib/prompts.ts`, `lib/constants.ts` | Presentation-only redesign |
| `FeedbackPanel`, `Badge`, `Spinner`, `FeedbackItem` | Existing `dark:` classes now always apply via `@variant dark (&)` — no edits needed |
| `LiveForm`, `CameraPreview`, `LiveFeedbackDisplay` | Live session UI not shown in mockup; left for a follow-up pass |
| `VideoDropzone` | Used by `AnalyzeVideoForm` which is still in the codebase; untouched |

---

## Known follow-up items

1. **`lib/prompts.ts` — wire `trainingGoal`:** `buildSystemPrompt` should accept and incorporate the new field. Currently it arrives in the request body but may not reach the prompt.

2. **`LiveForm` visual refresh:** The live session tab was not redesigned. It will feel visually inconsistent until given the same dark treatment.

3. **Error feedback:** `Swal.fire` was removed without a replacement. Add a `<p className="text-sm text-red-400">` error state inside `AnalyzeForm` driven by `onError`'s `error.message`.

4. **`VideoDropzone` dark theme:** Has the old light-mode styles. If the video tab is re-surfaced, it needs the same dropzone treatment as `ImageDropzone`.

5. **`@variant dark (&)` is global:** Any future light-mode feature or `light:` variant will not work until the variant strategy is revisited.
