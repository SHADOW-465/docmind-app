# DocMind — v2 Improvement Plan

## 1. Large-File Strategy — Validation & Corrected Design

### User's Idea
> Large files → don't store in DB. Small files → store in DB. Large files → session-only context for AI.

### Validation: **Partially Correct — Needs One Correction**

**What's right:**
- Large files shouldn't store `full_text` in the DB (PostgreSQL TEXT columns aren't designed for 500KB+ text blobs)
- The AI model only needs context at query time, not persistent storage of raw text

**What contradicts core product requirements:**
- "Session-only" is impossible with Next.js API routes — each request is stateless. There is no "session" server-side
- If a user uploads a 150-page PDF and closes the tab, they **cannot resume chatting** if the text was never stored
- The core value prop is **re-opening and re-analyzing** documents — session-only breaks this

### ✅ Corrected Strategy (Hybrid)

| Size | Storage |
|------|---------|
| < 80 pages (small) | `full_text` stored in DB + file in Supabase Storage |
| ≥ 80 pages (large) | Extract first 50 pages → store as `full_text` (cap at 100K chars). File stored in Supabase Storage. `is_large: true` |
| All sizes (local mode) | File saved to `public/uploads/`. Text stored in `.local-documents.json` capped at 100K chars |

This means:
- All documents are always re-openable ✓
- Chat always has context ✓  
- DB doesn't explode with multi-MB text ✓
- For very large docs, RAG (pgvector) can later replace the 50-page cap ✓

---

## 2. "Document not found" — Root Cause

The `isSupabaseConfigured()` check uses the anon key presence. After fixing the `.env` to have the JWT anon key, Supabase IS configured. But:
- Documents uploaded before the `.env` fix are in `.local-documents.json`
- New uploads try Supabase first → the `documents` storage bucket may not exist → `storageError` silently sets `storage_path = null`
- The DB insert still succeeds but with `storage_path: null`
- Chat route: finds doc in Supabase ✓ → should work

**Actual remaining bug**: The `documents` Supabase Storage bucket is missing — need to create it. Also the chat route needs to pass `documentId` in each message body (it's in `useChat`'s `body` option but may not override per-request).

---

## 3. Features to Implement Now

### A. Delete Documents
- Delete button in `DocListPanel` (per-row) with confirmation
- Delete button in `DocCard` (dashboard)
- Wires to existing `deleteDocument` in `useDocuments` hook

### B. Summary Tab — Major Enhancement
- **Functional Regenerate button** — POST to `/api/summarize` (new route) with `documentId`
- **Copy as Markdown** — working clipboard copy of entire summary
- **Page source links** — summary items with `page` numbers get a clickable badge that scrolls the PDF viewer to that page
- **Bezier beam effect** — SVG animated line connecting a summary point to the document viewer (simplified: draws from summary panel to viewer panel on hover)

### C. Large File Strategy Fix (as above)
- Update `extractor.ts` — always extract text, cap large docs at 100K chars
- Update `upload/route.ts` — store `full_text` for all docs (capped), add `local-store` fallback for large files too

### D. New `/api/summarize` route
- POST `{ documentId }` → re-runs summarization → PATCH document in DB/local-store
- Returns updated `summary_json`

### E. Supabase Storage Bucket
- Create `documents` storage bucket via MCP

---

## 4. Feature Recommendations (Artifact)
Full recommendations document to be generated separately.

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/extractor.ts` | Cap large doc text at 100K chars, always return text |
| `src/app/api/documents/upload/route.ts` | Always store full_text (capped) |
| `src/app/api/summarize/route.ts` | **New** — regenerate summary endpoint |
| `src/components/workspace/SummaryTab.tsx` | Regenerate button, bezier beam, page links |
| `src/components/workspace/Workspace.tsx` | Pass `onPageChange` callback to PdfViewer |
| `src/components/workspace/PdfViewer.tsx` | Accept `pageNumber` prop for external page control |
| `src/components/workspace/DocListPanel.tsx` | Delete button with confirmation |
| `src/components/dashboard/DocCard.tsx` | Delete button |
| `AGENTS.md` | Full project context update |
