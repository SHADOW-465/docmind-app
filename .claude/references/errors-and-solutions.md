# DocMind — Errors & Solutions Log

A history of bugs encountered during development, their root causes, and how they were fixed. Useful for avoiding the same mistakes and understanding why certain patterns exist.

---

## AI SDK: `sendMessage is not a function`

**Symptom:** Runtime TypeError in ChatTab. Message sending throws immediately.

**Root cause:** The codebase was written against AI SDK v4/v5 which uses `append()`. The project uses `@ai-sdk/react@3` (v6) which replaced `append` with `sendMessage`.

**Fix:** Rewrote ChatTab to use the v6 API:
```ts
// Before (v5)
const { append } = useChat(...)
append({ role: 'user', content: input })

// After (v6)
const { sendMessage } = useChat(...)
sendMessage({ text: input })
```

**Lesson:** AI SDK v5 → v6 is a breaking change. Never assume `useChat` returns `append`. Always check `@ai-sdk/react` version.

---

## AI SDK: `status` undefined on `useCompletion`

**Symptom:** `GenerateTab` crashes with "Cannot read properties of undefined" when checking `status === 'streaming'`.

**Root cause:** `useCompletion` in `@ai-sdk/react@3` does not expose a `status` field. Only `isLoading: boolean` is available for loading state.

**Fix:**
```ts
// Before
const { status } = useCompletion(...)
const isLoading = status === 'streaming'

// After
const { isLoading } = useCompletion(...)
```

**Lesson:** `status` is only on `useChat` in v6. `useCompletion` uses `isLoading`.

---

## PDF 404 — Storage Path Not a URL

**Symptom:** PdfViewer shows 404 / blank. Console shows a request to the raw `storage_path` value as a URL, which doesn't resolve.

**Root cause:** Supabase Storage stores a bucket key (e.g. `1234567890-file.pdf`), not a full URL. The component was rendering `src={doc.storage_path}` directly.

**Fix:** URL is constructed at render time in `Workspace.tsx`:
```ts
const url = activeDoc.storage_path.startsWith('/')
  ? activeDoc.storage_path                                      // local fallback
  : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${activeDoc.storage_path}`
```

**Lesson:** `storage_path` is always a bucket key or a local path. Never use it directly as a URL.

---

## Groq 413 "Request Too Large"

**Symptom:** Upload API returns error from Groq. Summary generation fails for most documents.

**Root cause:** The initial implementation sent up to 96,000 characters to Groq's summarize endpoint. The free tier has a 12,000 TPM limit — 96k chars ≈ 24k tokens, which is 2× the per-minute limit.

**Fix:** Added `MAX_SUMMARY_CHARS = 28000` constant in `src/lib/groq.ts`. Text is sliced before sending:
```ts
const truncated = text.slice(0, MAX_SUMMARY_CHARS)
```
28,000 chars ≈ 7,000 tokens — safely under 12k TPM.

**Lesson:** Always truncate before sending to Groq on the free tier. 28k chars is the safe ceiling.

---

## Groq: Summary JSON Truncated / Invalid

**Symptom:** `summary_json` is saved as null or contains cut-off JSON. SummaryTab shows a placeholder or crashes.

**Root cause:** `maxTokens: 1500` was too low for the structured JSON output Groq was generating. The response was cut mid-object, producing invalid JSON that failed `JSON.parse()`.

**Fix:** Increased to `maxTokens: 2000` in `src/lib/groq.ts`. The `summarizeDocument` function wraps the parse in a try/catch and returns null on failure.

**Lesson:** Structured JSON output needs enough token budget to complete the object. 2000 tokens is the safe minimum for DocMind's summary format.

---

## Groq Rate Limit: `Promise.all([summarize, suggestActions])`

**Symptom:** One or both AI calls fail with 429 Too Many Requests on upload.

**Root cause:** Both `summarizeDocument` and `suggestActions` were called in parallel with `Promise.all`. This sends two large prompts simultaneously, exceeding the 12,000 TPM limit.

**Fix:** Sequential calls with `await`:
```ts
// Before
const [summaryJson, actions] = await Promise.all([
  summarizeDocument(text, mode),
  suggestActions(text, filename, mode),
])

// After
const summaryJson = await summarizeDocument(text, mode)
const actions = await suggestActions(text, filename, mode)
```

**Lesson:** On Groq free tier, all AI calls in a single request handler must be sequential.

---

## "Document not found" on Chat / Generate / Summarize

**Symptom:** Clicking Chat or Generate for a document shows `{"error":"Document not found"}` even though the document is visible in the sidebar.

**Root cause:** All API routes had a hard `if (isSupabaseConfigured()) { ... } else { ... }` branch with no fallback between the two. If Supabase was configured but the document only existed in local-store (uploaded before env vars were set, or during an earlier local-only session), the Supabase query returned null and the route immediately returned 404 without checking the local store.

**Fix:** Added dual-source fallback pattern to all document routes:
```ts
if (isSupabaseConfigured()) {
  const { data } = await supabase.from('documents').select('*').eq('id', id).single()
  if (!data) {
    // fallback to local store
    const local = getDocument(id)
    if (!local) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    // use local
  }
}
```

**Files changed:** `summarize/route.ts`, `chat/route.ts`, `generate/route.ts`

**Lesson:** The dual-source fallback pattern is mandatory for ALL document routes. See `architecture.md` for the full pattern.

---

## React Hooks: Conditional Return Before Hook Call

**Symptom:** React error "Rendered more hooks than during the previous render" or "Hooks can only be called at the top level".

**Root cause:** In `SummaryTab.tsx`, new state variables (`copied`, `rewriteMode`, `editedItems`, `saving`) were added after a conditional early return (`if (!doc.summary_json) return <EmptyState/>`). React requires all hooks to be called in the same order on every render — a hook after a conditional return violates this.

**Fix:** Moved all `useState` declarations above the conditional return:
```tsx
// ALL hooks declared here, before any conditional returns
const [copied, setCopied] = useState(false)
const [rewriteMode, setRewriteMode] = useState(false)
const [editedItems, setEditedItems] = useState<Record<string, NormalizedItem[]>>({})
const [saving, setSaving] = useState(false)

// conditional returns after all hooks
if (!sections || sections.length === 0) {
  return <GenerateSummaryPrompt ... />
}
```

**Lesson:** All `useState`, `useEffect`, `useRef`, etc. must be at the top of the component function body, before any conditional returns.

---

## PdfViewer: Overflow Hidden Blocks Scroll

**Symptom:** PDF viewer renders but cannot be scrolled. `targetPage` navigation does not work — the page is in the DOM but can't be scrolled into view.

**Root cause:** The outer wrapper div in `Workspace.tsx` had `overflow-hidden` which prevented the inner `scrollIntoView` from working.

**Fix:** Changed to `overflow-y-auto`:
```tsx
// Before
<div className="flex-1 flex flex-col overflow-hidden">

// After
<div className="flex-1 overflow-y-auto relative flex flex-col">
```

**Lesson:** When wiring `scrollIntoView`, trace the entire ancestor chain for any element with `overflow: hidden` that could block the scroll.

---

## DocListPanel: Unused Import Warning

**Symptom:** TypeScript/ESLint warning about `PlusIcon` being imported but never used.

**Root cause:** During refactoring of the doc row layout, the `PlusIcon` was removed from the JSX but the import line was not updated.

**Fix:** Removed `PlusIcon` from the import line in `DocListPanel.tsx`.

**Lesson:** After component refactors, check that all named imports are still used.

---

## Summary "Re-Upload" Required After Changing GROQ_API_KEY

**Symptom:** Documents already in the sidebar show no summary / "Generate AI Summary" button even after adding a valid Groq key.

**Root cause:** `summary_json` is generated during upload. Documents uploaded before the key was configured have `summary_json: null` permanently (the upload route only calls Groq once).

**Fix:** Added a "Generate AI Summary" button in `SummaryTab` that calls `POST /api/documents/summarize` for the current document. This endpoint re-runs the Groq summarization and PATCHes the document row.

**Lesson:** The summarize endpoint exists specifically for this retroactive use case — the upload pipeline is not re-run.

---

## pdfjs-dist: Worker Import Error in Next.js

**Symptom:** Server crash or build error related to `pdfjs-dist/build/pdf.worker.min.mjs` path resolution.

**Root cause:** pdfjs-dist uses a Web Worker that requires special handling in bundlers. Next.js tries to bundle it as a server module and fails.

**Fix (next.config.ts):**
```ts
serverExternalPackages: ['pdfjs-dist']
// Turbopack alias
experimental: {
  turbopack: {
    resolveAlias: {
      'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.min.mjs'
    }
  }
}
// Webpack alias
webpack: (config) => {
  config.resolve.alias['pdfjs-dist/build/pdf.worker.min.mjs'] = ...
  return config
}
```

Also: `PdfViewer` must be loaded with `dynamic(() => import('./PdfViewer'), { ssr: false })`.

**Lesson:** pdfjs-dist requires both `serverExternalPackages` AND a `dynamic` import with `ssr: false`. Either alone is insufficient.
