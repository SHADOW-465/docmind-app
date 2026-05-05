# DocMind — Data Layer Reference

## Database: Supabase (PostgreSQL)

### Tables

#### `documents`
Primary data table. One row per uploaded document.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key, auto-generated |
| `name` | text | Original filename |
| `mode` | text | `scholar\|legal\|finance\|medical\|business` |
| `file_type` | text | `pdf`, `docx`, `xlsx`, `csv`, `image`, `text` |
| `storage_path` | text | Supabase bucket key OR `/uploads/filename` for local |
| `full_text` | text | Extracted text (null for large docs) |
| `page_count` | int | Total pages (0 for non-PDF) |
| `file_size` | int | Bytes |
| `is_large` | bool | true when page_count > 80 |
| `summary_json` | jsonb | AI-generated structured summary |
| `suggested_actions` | jsonb | AI-generated generate options array |
| `starred` | bool | User-starred flag |
| `created_at` | timestamptz | Auto-set |

#### `workspaces`
User-defined workspace groups for organizing documents.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `name` | text | Workspace display name |
| `mode` | text | Default mode for this workspace |
| `created_at` | timestamptz | |

#### `workspace_documents`
Join table linking documents to workspaces (many-to-many).

| Column | Type |
|--------|------|
| `workspace_id` | uuid → workspaces |
| `document_id` | uuid → documents |

Note: The workspace filter in `DocListPanel` currently shows all documents regardless of workspace selection. The join table is defined but the filtering logic is a stub (`return true`).

#### `app_state`
Single-row table storing global app state (onboarding, settings).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Always one row |
| `onboarding_complete` | bool | Whether ModeSelect has been completed |
| `default_mode` | text | User's chosen default mode |

#### `chat_messages`
Persistent chat history (defined in schema, not yet wired to the UI).

| Column | Type |
|--------|------|
| `id` | uuid |
| `document_id` | uuid → documents |
| `role` | text (`user\|assistant`) |
| `content` | text |
| `created_at` | timestamptz |

#### `generated_outputs`
Stores generated content (defined in schema, not yet wired to the UI).

| Column | Type |
|--------|------|
| `id` | uuid |
| `document_id` | uuid → documents |
| `type` | text |
| `content` | text |
| `created_at` | timestamptz |

### RLS Policies
All tables have RLS enabled with permissive "allow all" policies (MVP approach — no user auth). When real auth is added, these must be replaced with user-scoped policies.

---

## summary_json Shape

The `summary_json` column stores structured output from Groq. Its shape varies by mode but follows a consistent pattern:

```ts
// General shape
{
  overview?: string | { text: string; page?: number }[]
  key_points?: string[] | { text: string; page?: number }[]
  key_terms?: string[] | { term: string; definition: string; page?: number }[]
  action_items?: string[] | { text: string; page?: number }[]
  risks?: { text: string; tag: string; severity: string; page?: number }[]
  // ... mode-specific fields
}
```

The `SummaryTab` normalizes all these variants into `NormalizedSection[]` via `normalizeSections()`.

## suggested_actions Shape

```ts
Array<{
  id: string        // e.g. 'executive_summary'
  label: string     // e.g. 'Executive Summary'
  description: string  // shown under the label in GenerateTab
}>
```

When present, these override the default `DEFAULT_OPTIONS` in `GenerateTab`.

---

## Supabase Client Setup

### Client-side (`src/lib/supabase.ts`)
```ts
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () => createBrowserClient(URL, ANON_KEY)
```
Used in React components (DocListPanel, etc.).

### Server-side (`src/lib/supabase-server.ts`)
```ts
import { createClient } from '@supabase/supabase-js'
export const createServerClient = () =>
  createClient(URL, SERVICE_ROLE_KEY || ANON_KEY)
```
Used in API routes. Service role key bypasses RLS — preferred for server-side mutations.

### Key Detection
```ts
function isSupabaseConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return key.length > 0 && !key.startsWith('PASTE_YOUR')
}
```

---

## Local Store (`src/lib/local-store.ts`)

JSON file fallback when Supabase is not configured. Writes to `.local-documents.json` in the project root.

```ts
// Exported functions
getDocuments(): Document[]
getDocument(id: string): Document | null
insertDocument(data: Omit<Document, 'id' | 'created_at'>): Document
updateDocument(id: string, patch: Partial<Document>): Document | null
deleteDocument(id: string): boolean
```

Documents get a UUID generated with `crypto.randomUUID()` and `created_at` set to `new Date().toISOString()`.

**File location:** `.local-documents.json` — gitignored, in project root.
**Static files:** Written to `public/uploads/` — accessible at `/uploads/<filename>`.

---

## Session Cache (`src/lib/session-cache.ts`)

In-memory store for large document extracted text. Scoped to the Node.js process — cleared on server restart or Vercel cold start.

```ts
// Module-level Map
const cache = new Map<string, string>()

export function setLargeDocText(docId: string, text: string): void
export function getLargeDocText(docId: string): string | null
export function deleteLargeDocText(docId: string): void
```

**Lifecycle:**
- Set: during `POST /api/documents/upload` after extraction, if `isLarge`
- Read: in summarize, chat, generate routes when `full_text` is null
- Deleted: in `DELETE /api/documents` handler to free memory

**Vercel caveat:** Each warm serverless function instance has its own cache. A cold start after inactivity clears it. Large-doc AI features require re-uploading the document after a cold start.

---

## SWR Hook (`src/hooks/useDocuments.ts`)

Client-side data fetching with optimistic updates:

```ts
const { documents, addOptimistic, toggleStar, deleteDocument, refetch } = useDocuments()
```

**`deleteDocument(id)`:**
1. Optimistically removes doc from list
2. Calls `DELETE /api/documents` with `{ id }`
3. On error: rolls back the optimistic update and re-inserts the doc

**`toggleStar(id)`:**
1. Optimistically flips `starred` field
2. Calls `PATCH /api/documents` with `{ id, starred: !current }`
3. On error: rolls back

**`addOptimistic(doc)`:**
Prepends a doc to the list immediately (used by UploadZone to show the doc before the server response arrives).

**SWR key:** `/api/documents` — revalidates on focus by default.

---

## File Storage (Supabase Storage)

**Bucket:** `documents` (public bucket)

**Upload path:** `${Date.now()}-${sanitized_filename}` — collision-safe prefix.

**URL construction (client):**
```ts
`${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${storagePath}`
```

**Note:** `storage_path` in the DB is the bucket key (not a full URL). The URL is constructed at render time in `Workspace.tsx`. Local fallback paths start with `/` (e.g., `/uploads/file.pdf`) — distinguished by `startsWith('/')` check.
