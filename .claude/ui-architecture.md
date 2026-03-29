# UI Architecture — Gym Form Tracker

## File structure

```
src/
├── lib/
│   └── schemas.ts               ← shared contract between server and client
└── components/
    ├── atoms/
    │   ├── Spinner.tsx
    │   ├── Badge.tsx
    │   └── Button.tsx
    ├── molecules/
    │   ├── ImageDropzone.tsx
    │   └── FeedbackItem.tsx
    └── organisms/
        ├── FeedbackPanel.tsx
        └── AnalyzeForm.tsx
```

---

## Why atomic design?

Atomic design (Brad Frost, 2013) classifies components by their conceptual complexity rather than their location or domain. The core insight is that UI is compositional: **atoms** have no dependencies on other components, **molecules** compose atoms into a small functional unit, and **organisms** compose molecules and atoms into a complete section of the interface.

The practical benefit is a forcing function for separation of concerns. When a component can only reach "down" the hierarchy to import from smaller units, you avoid the most common React anti-pattern: a single mega-component that owns state, renders UI, handles events, calls APIs, and formats data all in one place. Every component here has a single, clear responsibility.

---

## Atoms

**`Spinner`** — a pure CSS animated ring. Accepts a `size` prop (`sm`, `md`, `lg`) so it can be embedded in a button or shown as a standalone page-level loader without any duplication. Has `role="status"` and `aria-label` for screen readers.

**`Badge`** — a severity chip for the three levels Claude returns (`low`, `medium`, `high`). The color maps are `Record<Severity, string>` keyed directly off the union type, so TypeScript will error at compile time if a new severity value is added to the Zod schema but the Badge styles aren't updated.

**`Button`** — extends `ButtonHTMLAttributes<HTMLButtonElement>` so it accepts every native button prop without any manual pass-through. The `loading` prop wires in the `Spinner` atom and sets `disabled` automatically — the consumer never has to remember to do both. Two variants (`primary`, `ghost`) cover every usage in this app.

---

## Molecules

**`ImageDropzone`** — a controlled component (it owns no image state — that lives in `AnalyzeForm`). It accepts `imageUrl` and `onImageChange`, making it trivially testable: you can render it with any image URL and assert on the output without a real `FileReader`. The drag-and-drop uses three native DOM events (`onDrop`, `onDragOver`, `onDragLeave`) and the `isDragging` local boolean drives the border/background styling. The `<input type="file">` is visually hidden but accessible — a keyboard user can press Enter on the div to trigger it. `next/image` renders the preview with `unoptimized` because data URLs can't go through Next.js's image CDN pipeline.

**`FeedbackItem`** — renders a single feedback point: title, description, and an optional `Badge`. The `loading` prop switches it to a skeleton pulse layout. This is the key pattern for streaming UX: the same component renders real content when tokens have arrived and an animated placeholder when they haven't, keeping the layout stable so the page doesn't reflow as content populates.

---

## Organisms

**`FeedbackPanel`** — purely presentational. It takes a `DeepPartial<FormFeedback>` (the type the AI SDK gives you during streaming) and renders three sections. The `DeepPartial` type means every field and every item in every array may be `undefined` at any given moment, so every access uses optional chaining. By making `FeedbackPanel` receive data rather than fetch it, it can be used in tests, Storybook, or a future "replay" feature by simply passing in any object.

The sections conditionally appear as soon as streaming begins (`isLoading || data.length > 0`), and each list renders a trailing skeleton item while loading. This gives the experience of watching the analysis fill in live rather than waiting for a blank screen followed by a sudden wall of text.

**`AnalyzeForm`** — the one organism that owns state and talks to the AI SDK. It holds the `imageUrl` string (the base64 data URL produced by `ImageDropzone`), and it holds the `useObject` hook which manages the streaming lifecycle. The `submit({ image: imageUrl })` call is the bridge: whatever you pass to `submit` is serialised as the JSON body of the POST request to `/api/analyze`, which is exactly what the route expects.

---

## The `useObject` hook — the AI engineering core

`experimental_useObject` from `@ai-sdk/react` does four things that would otherwise require significant custom code:

1. **Sends the request** — a POST to your `api` endpoint with the submit argument as the JSON body
2. **Reads the stream** — parses the AI SDK's text stream protocol as chunks arrive over HTTP
3. **Reconstructs partial JSON** — incrementally parses the growing JSON string into a typed `DeepPartial<T>` object, triggering a React re-render on each token
4. **Validates on completion** — runs the Zod schema against the final object and surfaces a validation error if the model's output didn't conform

The schema import is shared between the server (`route.ts`) and the client (`AnalyzeForm.tsx`). This is the key pattern: the same Zod definition is the source of truth for what the model must produce *and* for how the client types the streamed result. Change the schema once and TypeScript will surface every place that needs updating.