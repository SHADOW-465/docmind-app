# Graph Report - .  (2026-05-06)

## Corpus Check
- 61 files · ~62,756 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 193 nodes · 271 edges · 29 communities (23 shown, 6 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Routes|API Routes]]
- [[_COMMUNITY_Frontend Integration|Frontend Integration]]
- [[_COMMUNITY_Backend Infrastructure|Backend Infrastructure]]
- [[_COMMUNITY_Document Management|Document Management]]
- [[_COMMUNITY_AI Models & Config|AI Models & Config]]
- [[_COMMUNITY_Research Papers|Research Papers]]
- [[_COMMUNITY_File Processing|File Processing]]
- [[_COMMUNITY_Feature Development|Feature Development]]
- [[_COMMUNITY_Application Modes|Application Modes]]
- [[_COMMUNITY_Database Schema|Database Schema]]
- [[_COMMUNITY_Document Analysis|Document Analysis]]
- [[_COMMUNITY_Mode Personas|Mode Personas]]
- [[_COMMUNITY_Storage Layer|Storage Layer]]
- [[_COMMUNITY_Layout Components|Layout Components]]
- [[_COMMUNITY_System Design|System Design]]
- [[_COMMUNITY_Environment Setup|Environment Setup]]

## God Nodes (most connected - your core abstractions)
1. `createServerClient()` - 16 edges
2. `DocMind MVP Implementation Plan` - 13 edges
3. `SubGEN AI: Hardware-Aware AI Subtitle Generator` - 11 edges
4. `extractFromBuffer()` - 10 edges
5. `getDocument()` - 9 edges
6. `DocMind AI Application` - 9 edges
7. `POST()` - 8 edges
8. `POST()` - 8 edges
9. `getPersona()` - 8 edges
10. `POST()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `DocMind AI Application` --implements--> `Mode-First Design Philosophy`  [EXTRACTED]
  README.md → docs/superpowers/specs/2026-04-25-docmind-design.md
- `Upload API Route` --calls--> `Groq llama-3.3-70b-versatile`  [INFERRED]
  docs/superpowers/plans/2026-04-25-docmind-mvp.md → .claude/AGENTS.md
- `DocMind AI Application` --implements--> `Next.js 16 App Router`  [EXTRACTED]
  README.md → .claude/AGENTS.md
- `DocMind AI Application` --implements--> `Supabase PostgreSQL + Storage`  [EXTRACTED]
  README.md → .claude/AGENTS.md
- `DocMind AI Application` --implements--> `Groq llama-3.3-70b-versatile`  [EXTRACTED]
  README.md → .claude/AGENTS.md

## Hyperedges (group relationships)
- **Document Processing Pipeline** — upload_flow, extractor_module, groq_llama, documents_table [EXTRACTED 1.00]
- **Chat Interaction Flow** — chat_flow, chat_api_route, chat_messages_table, groq_llama [EXTRACTED 1.00]
- **Mode-Centric Architecture** — mode_first_design, modes_module, five_modes, useAppState_hook [EXTRACTED 1.00]
- **Multi-Layer Storage Strategy** — hybrid_storage_solution, supabase_postgresql, local_store_fallback, large_doc_handling [EXTRACTED 1.00]
- **SubGEN AI System Architecture** — esp32_dsp_co_processor, signal_informed_qc, sqlite_corrections_db, streamlit_ui [EXTRACTED 1.00]

## Communities (29 total, 6 thin omitted)

### Community 0 - "API Routes"
Cohesion: 0.18
Nodes (20): GET(), isSupabaseConfigured(), PATCH(), readLocalState(), writeLocalState(), DELETE(), GET(), isSupabaseConfigured() (+12 more)

### Community 1 - "Frontend Integration"
Cohesion: 0.09
Nodes (12): Vercel AI SDK v6, UploadZone(), DocMind AI Application, Framer Motion v12, useAppState(), useDocuments(), createClient(), Next.js 16 App Router (+4 more)

### Community 2 - "Backend Infrastructure"
Cohesion: 0.18
Nodes (16): isSupabaseConfigured(), POST(), isSupabaseConfigured(), POST(), suggestActions(), summarizeDocument(), getDocument(), buildActionsPrompt() (+8 more)

### Community 3 - "Document Management"
Cohesion: 0.1
Nodes (4): Btn(), Card(), Chip(), Tooltip()

### Community 4 - "AI Models & Config"
Cohesion: 0.09
Nodes (23): Groq 128K Context Window, ChatTab Component, DOCX File Support, Dashboard Component, Excel/CSV File Support, GenerateTab Component, OCR (Image Text Recognition), PDF File Support (+15 more)

### Community 5 - "Research Papers"
Cohesion: 0.15
Nodes (14): End-to-End Speech Recognition Survey (Base Paper), Automatic Subtitle Generation for Videos (Reference Paper 2), ESP32 DSP Co-Processor (MFCC Pipeline), ESP32 Microcontroller, Faster-Whisper ASR System, Indic Languages (Tamil, Telugu, Malayalam, Kannada), MFCC (Mel-Frequency Cepstral Coefficients), Signal-Informed Quality Control Engine (+6 more)

### Community 6 - "File Processing"
Cohesion: 0.38
Nodes (9): detectFileType(), extractCsv(), extractDocx(), extractExcel(), extractFromBuffer(), extractImage(), extractPdf(), extractPlainText() (+1 more)

### Community 7 - "Feature Development"
Cohesion: 0.25
Nodes (8): Delete Documents Feature, Document Not Found Root Cause, Hybrid Storage Solution, Local Store Fallback (.local-documents.json), Regenerate Summary Endpoint (/api/summarize), Summary Tab Enhancement, Supabase PostgreSQL + Storage, DocMind v2 Enhancements Walkthrough

### Community 8 - "Application Modes"
Cohesion: 0.39
Nodes (8): Business Mode, Finance Mode, Five Domain Modes, Legal Mode, Medical Mode, Mode-First Design Philosophy, Modes Module (modes.ts), Scholar Mode

### Community 9 - "Database Schema"
Cohesion: 0.29
Nodes (7): app_state Table, chat_messages Table, documents Table, generated_outputs Table, Large Document Handling (is_large=true), Supabase Database Schema, workspaces Table

## Knowledge Gaps
- **48 isolated node(s):** `Next.js 16 App Router`, `Vercel AI SDK v6`, `React 19`, `TailwindCSS 4`, `Framer Motion v12` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DocMind AI Application` connect `Frontend Integration` to `Application Modes`, `AI Models & Config`, `Feature Development`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `createServerClient()` (e.g. with `GET()` and `PATCH()`) actually correct?**
  _`createServerClient()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `getDocument()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`getDocument()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js 16 App Router`, `Vercel AI SDK v6`, `React 19` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Document Management` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `AI Models & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._