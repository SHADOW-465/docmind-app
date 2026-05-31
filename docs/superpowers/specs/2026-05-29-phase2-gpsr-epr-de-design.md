# Phase 2 Design — EU GPSR/EPR (Germany Pilot)

**Date:** 2026-05-29
**Phase:** 2 of the DocMind revamp
**Predecessor:** Phase 1 engine skeleton (commit `82aeb4c` on `main`)
**Master spec:** `C:\Users\acer\.claude\plans\your-current-docmind-direction-partitioned-noodle.md`

---

## Context

Phase 1 shipped the vertical-agnostic engine: 10 typed primitives (ingest real, 8 stubs, trace sink), workflow runtime, rules-pack loader, Supabase schema, AI Gateway wrapper. Tests: 73 unit + 1 gated integration. Everything pushed to `origin/main`.

Phase 2 turns the stubs into real implementations for **one launch vertical**: EU GPSR/EPR compliance for cross-border e-commerce sellers, scoped to **Germany only**. This is the smallest thing that proves the rules-pack architecture works on a real, paying, painful problem.

**Why Germany alone:** the master spec said top-3 (DE/FR/IT) but Phase 2 cuts to DE-only for fastest end-to-end proof. FR + IT become a small rules-pack-only follow-up (no engine code) once DE is validated against a real product.

**Why GPSR/EPR:** forced-adoption catalyst (Amazon Pay-on-Behalf enforcement since March 2026), self-serve SaaS pricing, language-bridge plays to LLM strength, lowest founder liability, exercises all engine primitives genuinely.

**Intended outcome:** a working `gpsrEprWorkflow` that, given a product spec sheet, produces filled draft EPR registrations (Stiftung EAR + ZSVR) and a GPSR Article 9 safety notice, with per-field confidence + missing-field gating, persisted as JSON artifacts in `eng_artifacts` with full trace lineage.

---

## Scope

### In Phase 2
- `rules-packs/eu-gpsr-epr/2026.05.0/` — full rules pack content for Germany
- `engine/workflows/gpsr-epr.workflow.ts` — the workflow definition
- Real implementations of the 8 stub primitives (classify, extract, lookup, reason, draft, validate, hitl-passthrough, emit)
- Pack-context plumbing helpers (`engine/rules-pack/{context,prompts,schemas,lookups}.ts`)
- One synthetic fixture product spec for testing
- Unit tests for every real primitive (mocked LLM); one gated end-to-end test (live LLM + live Supabase)

### Out of Phase 2 (deferred)
| Item | Lands in |
|---|---|
| FR + IT country coverage | Phase 2.5 (rules-pack-only PR) |
| PDF artifact rendering, portal payloads | Phase 4 |
| Real HITL UI (per-field accept/edit/regen, citation editor) | Phase 3 |
| Multi-tenant auth, org switcher | Phase 5 |
| Billing meter, usage-based pricing | Phase 5 |
| TPRM rules pack (proves engine reuse) | Phase 6 |
| Vector search for large lookup corpora | Phase 4+ |
| Mistral OCR for messy scans | Add when a real customer brings scanned PDFs |
| EU Battery Regulation overlay | Out of Phase 2 |
| EU Responsible Person directory | Out of Phase 2 |

---

## Rules-pack content layout

```
rules-packs/eu-gpsr-epr/2026.05.0/
├── manifest.json                          # id, version 2026.05.0, locales: ['de','en'], file refs
├── hitl-policy.yaml                       # threshold 0.85, always-gate categories
├── schemas/
│   ├── ProductCatalogItem.json            # canonical input entity
│   ├── EprRegistrationDe.json             # WEEE + packaging output schemas
│   └── GpsrSafetyNotice.json              # Article 9 safety-info schema
├── rules/
│   ├── eligibility.yaml                   # which schemes apply per product category
│   ├── high-risk.yaml                     # categories that always force HITL
│   └── prompts/
│       ├── classify.product-category.md
│       ├── extract.product-catalog.md
│       ├── draft.epr-de-weee.md
│       ├── draft.epr-de-packaging.md
│       └── draft.gpsr-article9.md
├── lookups/
│   ├── eu-product-categories.jsonl       # ~40 categories with WEEE class + GPSR risk band
│   ├── de-epr-schemes.jsonl              # 2 PROs: Stiftung EAR (WEEE), ZSVR (packaging)
│   └── de-language-strings.jsonl         # German labels for form templates
└── templates/                             # empty in Phase 2 — JSON only; PDFs Phase 4
```

### Canonical entity: `ProductCatalogItem`
Fields (JSON-Schema):
- `name` (string, required)
- `manufacturer` ({ name, address, country, vatId? }, required)
- `importer` ({ name, address, country, vatId? }, optional)
- `weightGrams` (number, required)
- `materials` (array of { type, percentage })
- `packaging` ({ totalWeightGrams, components: [{ material, weightGrams }] })
- `hasBattery` (boolean)
- `batteryDetails` ({ chemistry, capacityWh, weightGrams } | null)
- `eanGtin` (string, optional)
- `categoryId` (string — assigned by classify primitive, from `eu-product-categories.jsonl`)

Every field stores `{ value, confidence, citations }` per Phase 1's `CanonicalEntity` type.

### Output schemas
- `EprRegistrationDe` — one schema with a `scheme` discriminator: `'stiftung-ear'` (WEEE) or `'zsvr'` (packaging). Each variant has its required field set.
- `GpsrSafetyNotice` — Article 9 fields: manufacturer/importer details, safety warnings, usage instructions language list, contact for safety issues.

---

## Workflow graph

```ts
// engine/workflows/gpsr-epr.workflow.ts
export const gpsrEprWorkflow = defineWorkflow({
  id: 'gpsr-epr/v1',
  rulesPack: 'eu-gpsr-epr@2026.05.0',
  nodes: {
    ingest:   P.ingest({ accept: ['pdf', 'docx', 'txt', 'image'] }),
    classify: P.classify({ taxonomy: 'eu-product-category' }),
    extract:  P.extract({ schema: 'ProductCatalogItem' }),
    lookup:   P.lookup({ indexes: ['de-epr-schemes', 'eu-product-categories'] }),
    reason:   P.reason({ task: 'de-epr-eligibility' }),
    draft:    P.draft({ outputs: ['EprRegistrationDe', 'GpsrSafetyNotice'] }),
    validate: P.validate({ against: 'schema+confidence+missing-fields' }),
    hitl:     P.hitl({ when: 'confidence<0.85 || rule:HIGH_RISK_PRODUCT' }),
    emit:     P.emit({ formats: ['json'] }),
  },
  edges: [
    'ingest → classify → extract → lookup → reason → draft → validate',
    'validate → hitl  [if needsReview]',
    'validate → emit  [else]',
    'hitl → emit',
  ],
});
```

Phase 2 keeps `hitl` as auto-approve (logs `reviewer.action: 'auto-approve-phase2'`). Phase 3 swaps the implementation to wait for a real reviewer.

---

## Primitive upgrades

| Primitive | Phase 2 behavior |
|---|---|
| **ingest** | Unchanged from Phase 1. |
| **classify** | Loads pack, reads `prompts/classify.product-category.md`, loads `eu-product-categories.jsonl`, calls `model(DEFAULT_FAST_MODEL)` with source text + category list. Returns `{ categoryId, confidence }`. Persists a `CanonicalEntity` of type `'classification'`. |
| **extract** | Reads `prompts/extract.product-catalog.md` + `schemas/ProductCatalogItem.json`. Calls fast model with source text + schema. Returns canonical `ProductCatalogItem` with per-field confidence + character-span citations. Persists `CanonicalEntity` of type `'ProductCatalogItem'`. |
| **lookup** | Pure-function: loads `de-epr-schemes.jsonl`, filters by `categoryId` from prior state. Returns `{ schemes: [...] }`. No LLM. |
| **reason** | Reads `rules/eligibility.yaml` + extracted entity + scheme rows. Calls `model(DEFAULT_REASONING_MODEL)` to apply rules and identify gaps. Returns `{ applicableSchemes, gaps, decisions }`. |
| **draft** | One sequential call per output (3 total: WEEE, packaging, GPSR notice) using fast model. Each draft is a JSON object with per-field `{ value, confidence, citations }`. Persists 3 `Artifact` rows with `status: 'draft'`. |
| **validate** | For each draft: (a) Zod-validates against output JSON-Schema; (b) scans for fields with `confidence < hitlPolicy.threshold`; (c) flags required fields with `value: null`. Returns `{ needsReview: bool, issues: [{artifactId, field, reason}] }`. |
| **hitl** | Phase 2: pass-through. Logs auto-approval. Updates each artifact status to `'approved'`. |
| **emit** | Updates each artifact: `status='emitted'`, `emittedFormat='json'`, `emittedUrl=null` (no external destination yet). |
| **trace** | Unchanged from Phase 1 — every primitive call writes a TraceEvent. |

---

## Engine-side helpers (small, targeted)

These aren't features per se but unlock Phase 2 without ballooning scope:

1. **`engine/rules-pack/context.ts`** — `loadPackForWorkflow(rulesPackRef)` with per-process LRU cache so the pack loads once per workflow run instead of once per primitive.
2. **`engine/rules-pack/prompts.ts`** — `loadPrompt(pack, relPath)` reads `prompts/*.md`, returns string. Caches in-process.
3. **`engine/rules-pack/schemas.ts`** — `loadSchema(pack, relPath)` reads `schemas/*.json`, returns parsed JSON-Schema object. Caches.
4. **`engine/rules-pack/lookups.ts`** — `loadLookup(pack, name)` reads `lookups/<name>.jsonl`, returns `{ rows, indexBy(field) }`. Tiny in-memory `Map` indexes; no vector DB.

These four files total ~80 LOC. They're scaffolding for the primitives, not user-facing.

---

## Provider strategy

All LLM calls go through `engine/providers/gateway.ts` `model(id)` — no per-provider SDKs.

- `DEFAULT_FAST_MODEL = 'groq/llama-3.3-70b-versatile'` → classify, extract, each of 3 drafts
- `DEFAULT_REASONING_MODEL = 'anthropic/claude-sonnet-4-5'` → reason
- Sequential calls only (honors existing project rule re: Groq free-tier TPM limit)
- OCR (`mistral/mistral-ocr-latest`) not used in Phase 2 — ingest stays on pdf-parse + tesseract path

---

## Test plan

### Unit tests (mocked LLM)
- `engine/__tests__/primitives/classify.test.ts` — mocks `@engine/providers/gateway`, asserts call shape + return mapping
- Same shape for `extract.test.ts`, `lookup.test.ts` (no LLM, pure function), `reason.test.ts`, `draft.test.ts`, `validate.test.ts`, `hitl.test.ts`, `emit.test.ts`
- `engine/__tests__/rules-pack/{context,prompts,schemas,lookups}.test.ts` — pack-loader helpers against the real `eu-gpsr-epr@2026.05.0` fixture
- `engine/__tests__/workflows/gpsr-epr.workflow.test.ts` — `defineWorkflow` accepts the graph, nodes/edges validate

### Validate primitive — three explicit cases
- High-confidence + complete → `{ needsReview: false }`
- Low-confidence field → `{ needsReview: true, issues: [{field, reason: 'low-confidence'}] }`
- Missing required field → `{ needsReview: true, issues: [{field, reason: 'missing-required'}] }`

### One gated end-to-end test
`engine/__tests__/integration/gpsr-epr-workflow.test.ts` — wrapped in `describe.skipIf(!RUN_INTEGRATION)`. Requires `AI_GATEWAY_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Steps:
1. `createWorkspace({ workflowId: 'gpsr-epr/v1', rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0' })`
2. `runWorkflow` with a real fixture file `engine/__tests__/fixtures/usb-charger-spec.txt` (a synthetic but realistic spec sheet for a 65W USB-C GaN charger from "Acme GmbH")
3. Assert: workflow completes at `emit`, 3 artifacts in `eng_artifacts` (Stiftung EAR draft, ZSVR draft, GPSR notice), trace events for all 9 nodes exist, artifacts have non-null `value.manufacturer.name` (sanity check that drafting actually ran)

---

## Critical files

Pattern: rules-pack content under `rules-packs/eu-gpsr-epr/2026.05.0/`; engine helpers under `engine/rules-pack/`; one workflow file; new tests under `engine/__tests__/`.

**New (rules pack content, ~15 files):**
- `rules-packs/eu-gpsr-epr/2026.05.0/manifest.json`
- `rules-packs/eu-gpsr-epr/2026.05.0/hitl-policy.yaml`
- `rules-packs/eu-gpsr-epr/2026.05.0/schemas/{ProductCatalogItem,EprRegistrationDe,GpsrSafetyNotice}.json`
- `rules-packs/eu-gpsr-epr/2026.05.0/rules/{eligibility,high-risk}.yaml`
- `rules-packs/eu-gpsr-epr/2026.05.0/rules/prompts/{classify.product-category,extract.product-catalog,draft.epr-de-weee,draft.epr-de-packaging,draft.gpsr-article9}.md`
- `rules-packs/eu-gpsr-epr/2026.05.0/lookups/{eu-product-categories,de-epr-schemes,de-language-strings}.jsonl`

**New (engine helpers + workflow, ~5 files):**
- `engine/rules-pack/context.ts`
- `engine/rules-pack/prompts.ts`
- `engine/rules-pack/schemas.ts`
- `engine/rules-pack/lookups.ts`
- `engine/workflows/gpsr-epr.workflow.ts`

**Modified (primitives — stub → real, 8 files):**
- `engine/primitives/{classify,extract,lookup,reason,draft,validate,hitl,emit}.ts`

**New tests + fixture (15 files):**
- `engine/__tests__/primitives/{classify,extract,lookup,reason,draft,validate,hitl,emit}.test.ts` (8 files; `hitl` adds an auto-approve-log assertion to its existing structural test)
- `engine/__tests__/rules-pack/{context,prompts,schemas,lookups}.test.ts` (4)
- `engine/__tests__/workflows/gpsr-epr.workflow.test.ts` (1)
- `engine/__tests__/integration/gpsr-epr-workflow.test.ts` (1, gated)
- `engine/__tests__/fixtures/usb-charger-spec.txt` (1, fixture data, not a test)

**Reused as-is from Phase 1:**
- `engine/types.ts`, `engine/result.ts`, `engine/storage/*`, `engine/workflow/{runtime,defineWorkflow,dsl}.ts`, `engine/rules-pack/{loader,schema,version}.ts`, `engine/providers/gateway.ts`, `engine/primitives/{trace,ingest}.ts`, `engine/primitives/index.ts`

---

## Verification

End-to-end success criteria:

1. **Pack loads cleanly:** `loadRulesPack('eu-gpsr-epr', '2026.05.0', packsDir)` returns without error; manifest passes schema validation.
2. **All unit tests pass:** every primitive's unit test green with mocked gateway. Validate primitive's three explicit cases all pass.
3. **Workflow definition valid:** `gpsrEprWorkflow` parses through `defineWorkflow`, all edge nodes resolve.
4. **Gated integration test passes (manual, with API keys):**
   - workflow completes at `emit`
   - 3 artifacts persisted (Stiftung EAR, ZSVR, GPSR notice)
   - trace events for all 9 nodes
   - manufacturer name on each draft matches the fixture's "Acme GmbH"
5. **`npx tsc --noEmit` clean, `npm run lint` no new warnings in `engine/` or `rules-packs/`**
6. **No legacy file changes** — Phase 2 is purely additive plus stub-replacement; legacy `src/` untouched

After Phase 2 lands, the demo flow is: drop a product spec into a fresh workspace → run the workflow → inspect the 3 emitted artifacts in Supabase + the trace log. That's the validation milestone.

---

## What Phase 3 inherits from Phase 2

Phase 3 (HITL UI) gets:
- A workflow that actually produces draft artifacts with per-field confidence + citations to wire into a diff editor
- A `validate` primitive that can flag fields needing review
- A `hitl` primitive seam that's already in the workflow graph — just swap the pass-through implementation for one that awaits a real reviewer decision
- Trace events that make "why did this field say X?" answerable

That's why Phase 2 invests in per-field confidence + citations even though the UI is deferred: the data shape needs to be right from the start.
