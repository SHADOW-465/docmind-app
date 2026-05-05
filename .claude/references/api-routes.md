# DocMind — API Routes Reference

## Common Requirements (ALL Routes)

```ts
export const runtime = 'nodejs'   // required — never 'edge'
export const maxDuration = 60     // required — prevents 10s timeout kills
```

## Route Map

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/documents` | List all documents |
| DELETE | `/api/documents` | Delete a document (body: `{ id }`) |
| PATCH | `/api/documents` | Update document fields (body: `{ id, ...patch }`) |
| POST | `/api/documents/upload` | Upload + extract + summarize a document |
| POST | `/api/documents/summarize` | (Re)generate summary for existing document |
| POST | `/api/chat` | Streaming chat with document context |
| POST | `/api/generate` | Streaming content generation |
| GET/POST | `/api/app-state` | Read/write onboarding state |

---

## POST /api/documents/upload

**File:** `src/app/api/documents/upload/route.ts`

**Purpose:** Accepts a multipart form upload, extracts text, generates summary + suggested actions, stores document.

**Form data:**
- `file` — the uploaded file (required)
- `mode` — document mode string, defaults to `'business'`

**Max file size:** 50 MB

**Processing pipeline:**
1. Extract text via `extractFromBuffer(buffer, filename)` → `{ text, fileType, pageCount, isLarge }`
2. If GROQ key valid AND text length > 50 chars:
   - `summarizeDocument(text, mode)` → `summary_json` (JSONB)
   - `suggestActions(text, filename, mode)` → `suggested_actions` array
   - These are called **sequentially** (not parallel) to stay under Groq 12k TPM
3. Build `docData` object with `full_text: isLarge ? null : text`
4. If Supabase NOT configured → write file to `public/uploads/`, insert into local-store
5. If Supabase configured → upload buffer to Storage bucket `documents`, insert row in DB
6. If `isLarge` → `setLargeDocText(doc.id, text)` in session cache

**Returns:** Full document row as JSON.

---

## POST /api/documents/summarize

**File:** `src/app/api/documents/summarize/route.ts`

**Purpose:** Re-generates the summary for an existing document (used when doc was uploaded without a Groq key, or to refresh).

**Body:** `{ documentId: string }`

**Pattern:**
1. Check Supabase → fallback local-store → 404
2. If `is_large` and `full_text` null → check `getLargeDocText(documentId)`
3. Call `summarizeDocument(text, mode)` → save via PATCH or `updateDocument()`
4. Return updated document row

---

## POST /api/chat

**File:** `src/app/api/chat/route.ts`

**Purpose:** Streaming chat endpoint. Returns an AI SDK v6 stream response.

**Body:** `{ documentId: string, messages: Message[] }` (AI SDK format)

**Pattern:**
1. Check Supabase → fallback local-store → 404
2. If `is_large`:
   - Check session cache: `getLargeDocText(documentId)`
   - If found: use as context (sliced to `MAX_CONTEXT_CHARS`)
   - If not found: call `retrieveRelevant()` stub from `src/lib/rag.ts` (returns placeholder)
3. If not large: use `doc.full_text` sliced to `MAX_CONTEXT_CHARS`
4. Build system prompt with mode persona + document context
5. Return `streamText(...)` via `result.toDataStreamResponse()`

**Important:** Returns AI SDK data stream format — the client uses `useChat` which expects this format.

---

## POST /api/generate

**File:** `src/app/api/generate/route.ts`

**Purpose:** Streaming content generation (executive summary, key points, etc.).

**Body:**
```ts
{
  documentId: string
  type: string      // e.g. 'executive_summary'
  label: string     // e.g. 'Executive Summary'
  description: string
  length: 'short' | 'medium' | 'long'
  tone: 'formal' | 'neutral' | 'casual'
}
```

**Pattern:**
1. Check Supabase → fallback local-store → 404
2. Resolve text: `doc.full_text ?? getLargeDocText(documentId) ?? ''`
3. Slice to `MAX_CONTEXT_CHARS`
4. Build prompt specifying type, length, tone
5. Return `streamText(...)` via `result.toTextStreamResponse()`

**Important:** Returns plain text stream — the client uses `useCompletion` which expects this format (not the data stream format).

---

## GET/DELETE/PATCH /api/documents

**File:** `src/app/api/documents/route.ts`

### GET
Returns all documents from Supabase (or local-store). Ordered by `created_at DESC`.

### DELETE
**Body:** `{ id: string }`
1. Delete from Supabase Storage (file) — non-fatal if fails
2. Delete from Supabase DB (row) OR local-store
3. Call `deleteLargeDocText(id)` to clean up session cache

### PATCH
**Body:** `{ id: string, ...patch }` — patch can include `summary_json`, `starred`, `mode`, etc.
1. Update Supabase row OR local-store document
2. Returns updated document

---

## isSupabaseConfigured() Helper

Used in every route to determine which storage backend to use:

```ts
function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}
```

Service role key is preferred for server-side operations (bypasses RLS). Falls back to anon key if service role not set.

## Groq API Key Validation

```ts
const groqKeyValid = process.env.GROQ_API_KEY?.startsWith('gsk_') &&
  (process.env.GROQ_API_KEY?.length ?? 0) > 20
```

If the key is invalid or absent, AI features return graceful fallbacks (no crash, no summary generated).

## Error Response Conventions

| Scenario | Status | Body |
|----------|--------|------|
| Missing required field | 400 | `{ error: 'No file provided' }` |
| File too large | 413 | `{ error: 'File exceeds 50 MB limit' }` |
| Document not found | 404 | `{ error: 'Document not found' }` |
| DB/storage error | 500 | `{ error: error.message }` |
| AI unavailable | 503 | `{ error: 'AI not configured' }` |
