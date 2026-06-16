# DocMind — Engine Layer Reference (Phases 1–2)

The engine turns **source documents + a versioned rules pack** into compliant **output artifacts** with traceable provenance and human-in-the-loop (HITL) gating. It is **vertical-agnostic**: the first vertical is **EU GPSR/EPR compliance (Germany)**.

- Top-level `engine/` directory (sibling of `src/`, NOT under it). Framework-agnostic — no Next.js/React imports.
- Consumed by Next.js via path alias `@engine/*`.
- A **new vertical = a new rules pack + a workflow file. No engine code change.**

## First-class objects (`engine/types.ts`)

| Object | What it is |
|--------|-----------|
| **Workspace** | A run container: owns Sources, CanonicalEntities, WorkflowRuns, Artifacts, TraceEvents. Has a status. |
| **RulesPack** | A versioned bundle (`+ Manifest`) of schemas, rules, prompts, lookups, HITL policy. Referenced as `id@version`. |
| **WorkflowGraph** | Nodes (primitive invocations) + Edges (`WorkflowGraph`/`Edge`/`Node`). Walked by the runtime. |
| **CitationAnchor** | Provenance pointer back into a Source (the basis for traceable extraction/reasoning). |

Other types: `Source`, `CanonicalEntity`, `WorkflowRun`, `Artifact`, `TraceEvent`, `PrimitiveResult`.
Result envelope helpers in `engine/result.ts`: `ok()`, `fail<T>()`, `needsReview()`.

## The 10 primitives (`engine/primitives/`)

`index.ts` exports a `primitives` namespace of node-factory functions. Every primitive writes a `TraceEvent` to the **trace** sink.

| Primitive | LLM? | Model | Does |
|-----------|------|-------|------|
| `ingest` | no | — | Wraps `src/lib/extractor.ts` to load source text. |
| `classify` | yes | fast | Classifies the document. |
| `extract` | yes | fast | Field extraction with per-field confidence + citations. |
| `lookup` | no | — | Pure JSONL filter (no LLM). |
| `reason` | yes | reasoning | Applies eligibility rules. |
| `draft` | yes | — | **3 SEQUENTIAL LLM calls**: WEEE + packaging + GPSR notice. |
| `validate` | no | — | ajv schema + per-field confidence threshold + missing-required. |
| `hitl` | no | — | Phase 2: auto-approve pass-through; logs `reviewer.action='auto-approve-phase2'`. |
| `emit` | no | — | Inserts artifacts, marks `status='emitted'` `format='json'`. |
| `trace` | no | — | The sink every primitive writes a `TraceEvent` to. |

## Rules-pack layout

Live under top-level `rules-packs/<id>/<version>/` — e.g. `rules-packs/eu-gpsr-epr/2026.05.0/`:

```
manifest.json        # zod-validated manifest (engine/rules-pack/schema.ts)
hitl-policy.yaml
schemas/*.json       # ajv draft-2020-12
rules/*.yaml
rules/prompts/*.md   # {{var}} substitution
lookups/*.jsonl
```

Loader API (`engine/rules-pack/`):
- `version.ts` — `parsePackRef` / `formatPackRef` / `satisfies`
- `loader.ts` + `context.ts` — `loadPackForRef` (process cache) / `clearPackCache`
- `prompts.ts` — `loadPrompt` + `renderPrompt` (`{{var}}`)
- `schemas.ts` — `loadSchema` + `validatorFor` (ajv draft-2020-12)
- `lookups.ts` — `loadLookup` JSONL reader with `indexBy`

## Workflow DSL (`engine/workflow/`)

- `dsl.ts` — edge-string parser: `a → b [if expr]`, supports `!` negation and `max N loops`.
- `defineWorkflow.ts` — public API; validates that edge nodes exist.
- `runtime.ts` — `runWorkflow` walks the graph, dispatches primitives, persists `WorkflowRun` state, enforces `maxLoops`. Passes a `state` snapshot + loaded `workspace` into each primitive ctx. Helpers: `evalGuard`, `pickNextNode`.

Workflows in `engine/workflows/`:
- `noop.workflow.ts` — Phase 1 smoke test.
- `gpsr-epr.workflow.ts` — the real vertical. id `gpsr-epr/v1`, rulesPack `eu-gpsr-epr@2026.05.0`, 9 nodes: ingest → classify → extract → lookup → reason → draft → validate → (hitl if `needsReview`) → emit.

## Adding a new vertical

1. Create a rules pack under `rules-packs/<id>/<version>/` (manifest, schemas, rules, prompts, lookups, hitl-policy).
2. Add a workflow file in `engine/workflows/` referencing that pack and wiring primitives via the DSL.
3. No changes to engine primitives/runtime required.

## Provider / model strategy (`engine/providers/gateway.ts`)

Vercel AI Gateway wrapper. `model(id)` takes `"provider/model"` strings. Constants:
- `DEFAULT_FAST_MODEL = 'groq/llama-3.3-70b-versatile'` (classify, extract)
- `DEFAULT_REASONING_MODEL = 'anthropic/claude-sonnet-4-5'` (reason)
- `DEFAULT_OCR_MODEL = 'mistral/mistral-ocr-latest'`

AI SDK v6 uses **`maxOutputTokens`** (NOT `maxTokens`). The `draft` primitive's 3 calls remain **sequential**.

## Storage (`engine/storage/`)

All wrap `createServerClient()` from `src/lib/supabase-server.ts`:
- `workspace.ts` — create/get/updateStatus + insertSource/listSources
- `artifact.ts` — insert/update/listArtifacts
- `trace.ts` — insertTraceEvent
- `entities.ts` — insertEntity/listEntities

## Database (`eng_*` tables)

Migration `supabase/migrations/002_engine_schema.sql`. New tables: `organizations`, `memberships`, `rules_packs`, `eng_workspaces`, `eng_sources`, `eng_canonical_entities`, `eng_workflow_runs`, `eng_artifacts`, `eng_trace_events` (hash-partitioned 8 ways by `workspace_id`). Legacy tables (`documents`, `chat_messages`, etc.) untouched. See [`data-layer.md`](./data-layer.md).

## Testing

Vitest; tests in `engine/__tests__/`. Unit tests mock `@engine/providers/gateway` and `@/lib/supabase-server` (`vi.mock` hoisted above SUT imports; `generateText` mock uses `vi.hoisted()`). Gated integration tests in `engine/__tests__/integration/` skip unless `AI_GATEWAY_API_KEY` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set.
