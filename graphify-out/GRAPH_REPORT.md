# Graph Report - .  (2026-06-16)

## Corpus Check
- 128 files · ~86,612 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 305 nodes · 520 edges · 43 communities (30 shown, 13 thin omitted)
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Engine Primitives|Engine Primitives]]
- [[_COMMUNITY_API Routes|API Routes]]
- [[_COMMUNITY_Engine Storage & Emit|Engine Storage & Emit]]
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_AI Models & Config|AI Models & Config]]
- [[_COMMUNITY_App Modes & Features|App Modes & Features]]
- [[_COMMUNITY_Ingest & Result Envelope|Ingest & Result Envelope]]
- [[_COMMUNITY_Frontend Hooks & Upload|Frontend Hooks & Upload]]
- [[_COMMUNITY_SubGEN Research Papers|SubGEN Research Papers]]
- [[_COMMUNITY_Workflow DSL & Definitions|Workflow DSL & Definitions]]
- [[_COMMUNITY_Legacy DB Schema|Legacy DB Schema]]
- [[_COMMUNITY_Rules-Pack Loader & Schema|Rules-Pack Loader & Schema]]
- [[_COMMUNITY_Rules-Pack Versioning|Rules-Pack Versioning]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]

## God Nodes (most connected - your core abstractions)
1. `createServerClient()` - 33 edges
2. `writeTrace()` - 21 edges
3. `ok()` - 20 edges
4. `loadPackForRef()` - 19 edges
5. `extractPrimitive()` - 14 edges
6. `DocMind MVP Implementation Plan` - 13 edges
7. `classifyPrimitive()` - 13 edges
8. `extractFromBuffer()` - 12 edges
9. `SubGEN AI: Hardware-Aware AI Subtitle Generator` - 11 edges
10. `draftPrimitive()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `listArtifacts()` --calls--> `createServerClient()`  [INFERRED]
  engine/storage/artifact.ts → src/lib/supabase-server.ts
- `insertEntity()` --calls--> `createServerClient()`  [INFERRED]
  engine/storage/entities.ts → src/lib/supabase-server.ts
- `updateWorkspaceStatus()` --calls--> `createServerClient()`  [INFERRED]
  engine/storage/workspace.ts → src/lib/supabase-server.ts
- `insertSource()` --calls--> `createServerClient()`  [INFERRED]
  engine/storage/workspace.ts → src/lib/supabase-server.ts
- `listSources()` --calls--> `createServerClient()`  [INFERRED]
  engine/storage/workspace.ts → src/lib/supabase-server.ts

## Hyperedges (group relationships)
- **Multi-Layer Storage Strategy** — hybrid_storage_solution, supabase_postgresql, local_store_fallback, large_doc_handling [EXTRACTED 1.00]
- **Document Processing Pipeline** — upload_flow, extractor_module, groq_llama, documents_table [EXTRACTED 1.00]
- **Chat Interaction Flow** — chat_flow, chat_api_route, chat_messages_table, groq_llama [EXTRACTED 1.00]
- **Mode-Centric Architecture** — mode_first_design, modes_module, five_modes, useAppState_hook [EXTRACTED 1.00]
- **Document Processing Pipeline** — upload_flow, extractor_module, groq_llama, documents_table [EXTRACTED 1.00]
- **Chat Interaction Flow** — chat_flow, chat_api_route, chat_messages_table, groq_llama [EXTRACTED 1.00]
- **Mode-Centric Architecture** — mode_first_design, modes_module, five_modes, useAppState_hook [EXTRACTED 1.00]
- **Multi-Layer Storage Strategy** — hybrid_storage_solution, supabase_postgresql, local_store_fallback, large_doc_handling [EXTRACTED 1.00]
- **SubGEN AI System Architecture** — esp32_dsp_co_processor, signal_informed_qc, sqlite_corrections_db, streamlit_ui [EXTRACTED 1.00]
- **Next.js starter template SVG assets** — asset_file_svg, asset_globe_svg, asset_next_svg, asset_vercel_svg, asset_window_svg [INFERRED 0.75]

## Communities (43 total, 13 thin omitted)

### Community 0 - "Engine Primitives"
Cohesion: 0.13
Nodes (21): ok(), classifyPrimitive(), draftPrimitive(), extractPrimitive(), hitlPrimitive(), emitResult(), lookupPrimitive(), reasonPrimitive() (+13 more)

### Community 1 - "API Routes"
Cohesion: 0.11
Nodes (30): isSupabaseConfigured(), POST(), DELETE(), GET(), isSupabaseConfigured(), PATCH(), isSupabaseConfigured(), POST() (+22 more)

### Community 2 - "Engine Storage & Emit"
Cohesion: 0.11
Nodes (22): GET(), isSupabaseConfigured(), PATCH(), readLocalState(), writeLocalState(), createServerClient(), emitPrimitive(), insertArtifact() (+14 more)

### Community 3 - "Frontend Components"
Cohesion: 0.1
Nodes (4): Btn(), Card(), Chip(), Tooltip()

### Community 4 - "AI Models & Config"
Cohesion: 0.09
Nodes (23): Groq 128K Context Window, ChatTab Component, DOCX File Support, Dashboard Component, Excel/CSV File Support, GenerateTab Component, OCR (Image Text Recognition), PDF File Support (+15 more)

### Community 5 - "App Modes & Features"
Cohesion: 0.11
Nodes (22): Vercel AI SDK v6, Business Mode, Delete Documents Feature, DocMind AI Application, Document Not Found Root Cause, Finance Mode, Five Domain Modes, Framer Motion v12 (+14 more)

### Community 6 - "Ingest & Result Envelope"
Cohesion: 0.17
Nodes (15): fail(), needsReview(), detectFileType(), extractCsv(), extractDocx(), extractExcel(), extractFromBuffer(), extractImage() (+7 more)

### Community 7 - "Frontend Hooks & Upload"
Cohesion: 0.13
Nodes (6): UploadZone(), useAppState(), useDocuments(), createClient(), SWR (stale-while-revalidate), DocListPanel()

### Community 8 - "SubGEN Research Papers"
Cohesion: 0.15
Nodes (14): End-to-End Speech Recognition Survey (Base Paper), Automatic Subtitle Generation for Videos (Reference Paper 2), ESP32 DSP Co-Processor (MFCC Pipeline), ESP32 Microcontroller, Faster-Whisper ASR System, Indic Languages (Tamil, Telugu, Malayalam, Kannada), MFCC (Mel-Frequency Cepstral Coefficients), Signal-Informed Quality Control Engine (+6 more)

### Community 9 - "Workflow DSL & Definitions"
Cohesion: 0.32
Nodes (3): defineWorkflow(), parseEdges(), parseLine()

### Community 10 - "Legacy DB Schema"
Cohesion: 0.29
Nodes (7): app_state Table, chat_messages Table, documents Table, generated_outputs Table, Large Document Handling (is_large=true), Supabase Database Schema, workspaces Table

### Community 12 - "Rules-Pack Versioning"
Cohesion: 0.6
Nodes (3): formatPackRef(), parsePackRef(), satisfies()

## Knowledge Gaps
- **55 isolated node(s):** `Next.js 16 App Router`, `Vercel AI SDK v6`, `React 19`, `TailwindCSS 4`, `Framer Motion v12` (+50 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createServerClient()` connect `Engine Storage & Emit` to `Engine Primitives`, `API Routes`, `Ingest & Result Envelope`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `DocMind AI Application` connect `App Modes & Features` to `AI Models & Config`, `Frontend Hooks & Upload`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `loadPackForRef()` connect `Engine Primitives` to `Rules-Pack Loader & Schema`, `Rules-Pack Versioning`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `createServerClient()` (e.g. with `GET()` and `PATCH()`) actually correct?**
  _`createServerClient()` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `writeTrace()` (e.g. with `classifyPrimitive()` and `draftPrimitive()`) actually correct?**
  _`writeTrace()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `ok()` (e.g. with `classifyPrimitive()` and `draftPrimitive()`) actually correct?**
  _`ok()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `loadPackForRef()` (e.g. with `classifyPrimitive()` and `draftPrimitive()`) actually correct?**
  _`loadPackForRef()` has 8 INFERRED edges - model-reasoned connections that need verification._