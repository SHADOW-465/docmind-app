# DocMind — Frontend Components Reference

## Component Tree

```
src/app/
  layout.tsx          — root layout, fonts, theme provider
  page.tsx            — entry: onboarding check → ModeSelect | Dashboard | Workspace
  globals.css         — CSS variables, dark mode, animations

src/components/
  ui/
    icons.tsx         — all icon exports + I.* namespace
    primitives.tsx    — Button/Btn, Card, Chip, Segmented, Modal, Divider, Tooltip

  dashboard/
    Dashboard.tsx     — grid of DocCards + UploadZone
    DocCard.tsx       — single document card with mode chip, date, starred indicator
    UploadZone.tsx    — drag-and-drop file upload UI, calls POST /api/documents/upload

  sidebar/
    Sidebar.tsx       — left nav with WorkspaceRail
    WorkspaceRail.tsx — vertical list of workspace icons

  workspace/
    Workspace.tsx         — three-panel shell, page/beam state lifted here
    DocListPanel.tsx      — left panel: workspace filter chips + scrollable doc list
    PdfViewer.tsx         — react-pdf viewer (ssr:false), targetPage + page refs
    AIPanel.tsx           — right panel: tab bar (Summary/Chat/Generate)
    SummaryTab.tsx        — summary display, copy-all, rewrite mode, page-ref buttons
    ChatTab.tsx           — streaming chat with doc context
    GenerateTab.tsx       — content generation with type/tone/length options
    BezierBeam.tsx        — animated SVG overlay from summary ref → PDF page

  mode/
    ModeSelect.tsx        — full-screen onboarding mode picker
    ModeSwitcher.tsx      — compact mode switcher (used in Workspace header)
```

## UI Primitives (src/components/ui/primitives.tsx)

Always import from here — never create one-off styled components for these.

| Component | Props | Notes |
|-----------|-------|-------|
| `Button` / `Btn` | `variant`, `size`, `icon`, `onClick` | variants: `solid`, `ghost`, `outline` |
| `Card` | `className` | Simple bordered card wrapper |
| `Chip` | `label`, `color`, `onRemove` | Small tag/badge |
| `Segmented` | `value`, `onChange`, `options` | Radio-group style selector |
| `Modal` | `open`, `onClose`, `title`, `children` | Overlay dialog |
| `Divider` | — | Horizontal rule with token colors |
| `Tooltip` | `label`, `children` | Hover tooltip wrapper |

## Icons (src/components/ui/icons.tsx)

Two usage patterns — both valid:

```tsx
// Named imports for one-off use
import { FileIcon, TrashIcon, StarIcon } from '@/components/ui/icons'
<FileIcon size={16} />

// I.* namespace for component files that use many icons
import { I } from '@/components/ui/icons'
<I.Sparkle size={14} />
<I.Check size={13} />
<I.Copy size={12} />
<I.Download size={12} />
<I.Refresh size={12} />
<I.Trash size={12} />
```

**Never** import directly from `lucide-react` — always go through `icons.tsx`.

## Workspace.tsx — State and Data Flow

Central coordinator for the three-panel workspace. All inter-panel communication flows through here.

**State owned by Workspace:**
```ts
activeId: string | null          // which doc is selected
targetPage: number | null        // which PDF page to scroll to
beamFrom: {x,y} | null          // SVG beam start (from summary badge)
beamTo: {x,y} | null            // SVG beam end (PDF page element)
```

**Props passed down:**
- `DocListPanel`: `activeDocId`, `onSelect`, `onDelete`
- `PdfViewer`: `url`, `targetPage`, `onPageReady`
- `AIPanel`: `doc`, `onRefetch`, `onPageRef`

**PDF URL construction:**
```ts
// storage_path can be either a local path (/uploads/...) or a Supabase bucket key
const url = activeDoc.storage_path.startsWith('/')
  ? activeDoc.storage_path
  : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${activeDoc.storage_path}`
```

**Large-doc banner** renders above PdfViewer when `activeDoc.is_large === true`:
```tsx
<div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-700 ...">
  ⚠ Large document — AI context covers the first 20 pages only and is available this session only.
</div>
```

## DocListPanel.tsx

Left sidebar panel. Key behaviours:
- Workspace filter chips at top (from `workspaces` Supabase table) — currently shows all docs regardless of filter (stub)
- Doc rows are `<div class="group ...">` containers with two child buttons:
  - Left: selects the document on click
  - Right: trash icon, `opacity-0 group-hover:opacity-100` — appears on hover
- Delete flow: `setDeletingId(doc.id)` → spinner shows → `deleteDocument(doc.id)` (hook) → `onDelete?.(doc.id)` → `setDeletingId(null)`
- Supabase workspaces are fetched with a direct `supabase.from('workspaces').select('*')` call (not SWR)

## PdfViewer.tsx

Loaded with `dynamic(() => import('./PdfViewer'), { ssr: false })` to prevent hydration issues.

**Props:**
```ts
url: string
targetPage?: number
onPageReady?: (page: number, el: HTMLElement) => void
```

**Page refs:** Each rendered page div registers itself in a `Map<number, HTMLDivElement>` ref:
```tsx
ref={(el) => { if (el) pageRefs.current.set(index + 1, el) else pageRefs.current.delete(index + 1) }}
```

**targetPage effect:**
```ts
useEffect(() => {
  if (!targetPage) return
  const el = pageRefs.current.get(targetPage)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const t = setTimeout(() => onPageReady?.(targetPage, el), 350)
  return () => clearTimeout(t)
}, [targetPage])
```
The 350ms delay lets smooth scroll settle before `onPageReady` captures the element's bounding rect.

## BezierBeam.tsx

Fixed-position SVG overlay that draws an animated cubic bezier from a source element to a PDF page.

```ts
interface BezierBeamProps {
  from: { x: number; y: number }  // viewport coords (getBoundingClientRect)
  to: { x: number; y: number }    // viewport coords
  onDone: () => void
}
```

- Control points: `cx1 = from.x - 80`, `cx2 = to.x + 80` (creates left-curving S-shape)
- `motion.path`: dashed stroke, animates `pathLength` 0→1, opacity fades at end
- `motion.circle`: landing dot at `to`, scales up then fades
- Auto-calls `onDone` after 1200ms via `useEffect`

Coordinate source: `getBoundingClientRect()` on the clicked summary badge element, and on the PDF page element after scroll settles.

## AIPanel.tsx

Right panel with three tabs. Props:
```ts
interface AIPanelProps {
  doc: Document | null
  onRefetch?: () => void
  onPageRef?: (page: number, el: HTMLElement) => void
}
```

- Tabs: `summary` | `chat` | `generate`
- Renders each tab component with `key={doc.id}` (forces remount on doc change)
- Passes `onPageRef` down to `SummaryTab`
- When `doc` is null, shows a placeholder

## SummaryTab.tsx

Displays `doc.summary_json` content. Has three display states:

1. **Normal mode** — formatted sections with copy-all button
2. **Rewrite mode** — each item becomes a `<textarea>`, save reconstructs `summary_json`
3. **No summary** — "Generate AI Summary" button that calls `POST /api/documents/summarize`

**Summary JSON shape** (varies by mode, normalized by `normalizeSections()`):
```ts
// overview section
{ title: "Overview", items: [{ text: string, page?: number }] }

// key_terms section  
{ title: "Key Terms", items: [{ text: "**term**: definition", page?: number }] }

// risks section (legal/finance/medical modes)
{ title: "Risks", items: [{ text: string, page?: number, tag?: string, severity?: string }] }
```

**Copy format** (`copySummary()`):
```
## Section Title

- Item text (p.N)
- Item text
```

**Rewrite save** reconstructs `summary_json` from edited textarea values by section type:
- overview → `string` or `{ text, page }` object
- key_terms → parsed via regex `^\*\*(.+?)\*\*:\s*(.+)` → `{ term, definition, page }`
- risks → `{ text, page, tag, severity }` objects
- PATCHes `/api/documents` with `{ id, summary_json: newJson }` then calls `onRefetch()`

**Page reference buttons** (the `p.N` chips):
```tsx
onClick={(e) => onPageRef?.(item.page!, e.currentTarget)}
```
This fires the bezier beam animation from the badge element to the PDF page.

## ChatTab.tsx

Uses `useChat` from `@ai-sdk/react@3`.

**Critical AI SDK v6 API:**
```ts
// CORRECT — AI SDK v6
const { messages, sendMessage, isLoading } = useChat({ api: '/api/chat' })
sendMessage({ text: inputValue })

// WRONG — AI SDK v5 (will throw "sendMessage is not a function")
const { append } = useChat(...)
append({ role: 'user', content: inputValue })
```

Initial messages are populated from `doc.mode`'s `chatStarters` array. The doc ID is sent as `options.body.documentId`.

## GenerateTab.tsx

Uses `useCompletion` from `@ai-sdk/react@3`.

**Critical AI SDK v6 API:**
```ts
// CORRECT
const { completion, complete, isLoading, setCompletion, error } = useCompletion({ api: '/api/generate' })

// WRONG — status field does not exist in v6
const { status } = useCompletion(...)
```

Default generation types: `executive_summary`, `key_points`, `discussion_questions`, `glossary`.
If `doc.suggested_actions` is populated (from Groq on upload), those override the defaults.

Options: `length` (short/medium/long), `tone` (formal/neutral/casual). Sent as `body` to the API.

## useDocuments Hook (src/hooks/useDocuments.ts)

```ts
interface Document {
  id: string
  name: string
  mode: string
  file_type: string
  storage_path: string | null
  full_text: string | null
  page_count: number
  file_size: number
  is_large: boolean
  summary_json: any | null
  suggested_actions: Array<{ id: string; label: string; description: string }> | null
  starred: boolean
  created_at: string
}

// Hook returns:
const { documents, addOptimistic, toggleStar, deleteDocument, refetch } = useDocuments()
```

- `deleteDocument(id)`: optimistic update (removes immediately from list), rolls back on error
- `toggleStar(id)`: optimistic toggle
- `addOptimistic(doc)`: adds a doc to the list before server confirms (used by UploadZone)
- `refetch()`: triggers SWR revalidation
