# DocMind — Architecture Reference

## Overview

DocMind is a document intelligence application that lets users upload documents, get AI-generated summaries, and chat with document content. It uses a three-panel workspace layout and supports multiple document processing modes.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4, App Router, Turbopack |
| Runtime | React 19, TypeScript |
| AI SDK | `ai@6.0.168`, `@ai-sdk/react@3.0.170` |
| AI Provider | Groq `llama-3.3-70b-versatile` via `@ai-sdk/groq` |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (`documents` bucket) |
| Client Data | SWR (stale-while-revalidate) |
| Styling | Tailwind CSS 4, CSS custom properties |
| Animation | framer-motion v12.38.0 |
| PDF Rendering | react-pdf v10.4.1, pdfjs-dist |

## Three-Panel Workspace Layout

```
┌──────────────┬──────────────────────────┬────────────────┐
│ DocListPanel │      PdfViewer / Text     │   AIPanel      │
│   (w-60)     │      (flex-[2])           │   (flex-1)     │
│              │                           │                │
│ Workspace    │  PDF pages / plain text   │ Tabs:          │
│ selector     │  Scrollable               │ · Summary      │
│              │  Large-doc amber banner   │ · Chat         │
│ Doc list     │                           │ · Generate     │
│ (SWR)        │                           │                │
│              │                           │ Keyed by       │
│ Hover→delete │                           │ doc.id         │
└──────────────┴──────────────────────────┴────────────────┘
```

- `AIPanel` tabs are **keyed by `doc.id`** to force full remount when the active document changes — this resets all AI state (summary, chat history, generation output)
- `PdfViewer` is loaded via `dynamic()` with `ssr: false` to avoid hydration and Web Worker issues

## App Entry Flow

```
src/app/page.tsx
  ↓ useAppState() — checks onboarding_complete in app_state table
  ├── if not done → <ModeSelect> (full-screen mode picker, saves to app_state)
  └── if done → <Dashboard> or <Workspace initialDocId>
```

`app_state` table holds `{ onboarding_complete: boolean, default_mode: string }` — one row per user/session.

## Document Storage Strategy

### Small Documents (≤ 80 pages)
- `full_text` stored in Supabase `documents` table permanently
- All AI features (summary, chat, generate) read from `full_text` column
- Available across sessions and devices

### Large Documents (> 80 pages)
- `is_large = true`, `full_text = null` in DB
- Document metadata + summary stored in DB permanently (doc appears in sidebar forever)
- First-20-page extracted text stored in `src/lib/session-cache.ts` (in-memory `Map`)
- Session cache is cleared on server restart or Vercel cold start
- AI features work only during the session when the document was uploaded
- Users see amber banner: "Large document — AI context covers the first 20 pages only. Available this session only."

### Local Fallback (no Supabase)
When `NEXT_PUBLIC_SUPABASE_ANON_KEY` is absent or contains the placeholder `PASTE_YOUR`:
- Documents stored in `.local-documents.json` via `src/lib/local-store.ts`
- Files written to `public/uploads/` directory
- `storage_path` is set to `/uploads/<filename>` (served as static files)

## Dual-Source Pattern (ALL API Routes Must Follow This)

Every API route that fetches a document MUST follow this pattern:

```ts
// 1. Try Supabase first (if configured)
if (isSupabaseConfigured()) {
  const { data } = await supabase.from('documents').select('*').eq('id', id).single()
  if (!data) {
    // 2. Fallback to local-store
    const local = getDocument(id)
    if (!local) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    // use local
  } else {
    // use data from Supabase
  }
} else {
  // 3. Local-store only path
  const local = getDocument(id)
  if (!local) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  // use local
}

// 4. For large docs with null full_text, check session cache
if (!text || text.length < 50) {
  const cached = getLargeDocText(id)
  if (cached) text = cached
}
```

**Why:** If Supabase is configured but a doc was uploaded before env was set (or during local dev), it exists in local-store only. The hard branch causes 404 without a fallback. This pattern prevents that.

## Document Modes

Five modes, each with distinct AI persona and behaviour:

| Mode | Label | Focus |
|------|-------|-------|
| `scholar` | Scholar | Academic analysis, citations |
| `legal` | Legal | Clause extraction, risk flags |
| `finance` | Finance | Metrics, financial risk |
| `medical` | Medical | Clinical findings, diagnoses |
| `business` | Business | Executive summary, action items |

Defined in `src/lib/modes.ts`. Each mode has:
- `label`, `icon`, `description`
- `persona` — system prompt fragment
- `summaryStructure` — array of section specs fed to `buildSummaryPrompt()`
- `chatStarters` — suggested questions for the Chat tab

## Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/session-cache.ts` | In-memory Map for large-doc extracted text |
| `src/lib/local-store.ts` | JSON file fallback store (`.local-documents.json`) |
| `src/lib/extractor.ts` | Text extraction from PDF/DOCX/Excel/CSV/Image |
| `src/lib/groq.ts` | Groq API wrapper; `summarizeDocument`, `suggestActions` |
| `src/lib/rag.ts` | RAG stub — NOT IMPLEMENTED, returns placeholder |
| `src/lib/modes.ts` | Mode definitions + prompt builders |
| `src/hooks/useDocuments.ts` | SWR-backed document list with optimistic mutations |

## File Extraction (src/lib/extractor.ts)

| File Type | Library | Notes |
|-----------|---------|-------|
| PDF | pdfjs-dist | `LARGE_DOC_THRESHOLD = 80` pages; large PDFs extract first 20 pages only |
| DOCX | mammoth | Full text extraction |
| Excel | xlsx | Sheets serialized to CSV-style text |
| CSV | — | Plain text read |
| Image | tesseract.js | OCR |
| Plain text | — | Direct read |

`pdfjs-dist` is listed in `serverExternalPackages` in `next.config.ts` to prevent bundling issues in the Node.js runtime. Webpack/Turbopack aliases are configured to redirect the worker file.

## next.config.ts Key Settings

```ts
serverExternalPackages: ['pdfjs-dist']
// Turbopack alias
resolveAlias: { 'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.min.mjs' }
// Webpack alias
config.resolve.alias['pdfjs-dist/build/pdf.worker.min.mjs'] = ...
```
