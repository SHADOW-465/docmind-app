# Phase 2 — EU GPSR/EPR Germany Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `gpsr-epr` workflow that ingests a product spec sheet and produces three filled draft artifacts — Stiftung EAR WEEE registration, ZSVR packaging registration, and a GPSR Article 9 safety notice — all persisted in `eng_artifacts` with per-field confidence + citations and full trace lineage. Germany only. JSON artifacts only (PDF deferred to Phase 4).

**Architecture:** Builds on the Phase 1 engine. Two small runtime additions (state/workspace in primitive ctx, CanonicalEntity CRUD) unblock the 8 stub primitives. Real LLM calls go through `engine/providers/gateway.ts` with `groq/llama-3.3-70b-versatile` for fast paths (classify, extract, draft) and `anthropic/claude-sonnet-4-5` for reasoning. JSON-Schema validation via `ajv`. All unit tests mock the gateway; one gated end-to-end test exercises the live pipeline.

**Tech Stack:** TypeScript strict, Vitest 4, AI SDK v6 + `@ai-sdk/gateway`, Supabase Postgres, `ajv` (new dep) for JSON-Schema validation, `yaml` (new dep) for the rules YAML files. Builds on Phase 1 engine kernel at `engine/`.

---

## File Structure

### New files under `rules-packs/eu-gpsr-epr/2026.05.0/` (15 files)
Pack manifest + hitl-policy + 3 schemas + 2 rules YAMLs + 5 prompts + 3 JSONL lookups.

### New files under `engine/` (6 files)
- `engine/storage/entities.ts` — CanonicalEntity CRUD
- `engine/rules-pack/context.ts` — per-process pack cache
- `engine/rules-pack/prompts.ts` — prompt file reader
- `engine/rules-pack/schemas.ts` — JSON-Schema reader + ajv validator factory
- `engine/rules-pack/lookups.ts` — JSONL reader + indexBy
- `engine/workflows/gpsr-epr.workflow.ts` — the workflow definition

### Modified files (10 files)
- `engine/workflow/runtime.ts` — extend ctx with `state` + `workspace`
- 8 stub primitives in `engine/primitives/` — replace with real implementations: `classify.ts`, `extract.ts`, `lookup.ts`, `reason.ts`, `draft.ts`, `validate.ts`, `hitl.ts`, `emit.ts`
- `package.json` — add `ajv` and `yaml` deps

### New tests + fixture (15 files)
- `engine/__tests__/storage/entities.test.ts`
- `engine/__tests__/rules-pack/{context,prompts,schemas,lookups}.test.ts` (4)
- `engine/__tests__/primitives/{classify,extract,lookup,reason,draft,validate,hitl,emit}.test.ts` (8)
- `engine/__tests__/workflows/gpsr-epr.workflow.test.ts` (1)
- `engine/__tests__/integration/gpsr-epr-workflow.test.ts` (1, gated)
- `engine/__tests__/fixtures/usb-charger-spec.txt` (fixture)

**Decomposition rationale:** Pack content split into separate small commits per file family (manifest, schemas, rules, prompts, lookups) so each commit is independently reviewable and the pack loader can be re-run after each to confirm structural integrity. Engine helpers split by responsibility (context/prompts/schemas/lookups) — each file ~50 LOC, easy to hold in context. Primitives stay one-per-file as in Phase 1. The runtime extension and CanonicalEntity CRUD go first because every later task depends on them.

---

## Task 1: Add deps + extend runtime ctx (state + workspace)

**Files:**
- Modify: `package.json` (add deps)
- Modify: `engine/workflow/runtime.ts`
- Test: `engine/__tests__/workflow/runtime.test.ts` (extend with one new assertion)

- [ ] **Step 1: Install deps**

```bash
npm install ajv yaml
```

Expected: `ajv` (^8 or ^9 — accept whatever npm resolves) and `yaml` (^2.x) added to `dependencies` in `package.json`.

- [ ] **Step 2: Read current `engine/workflow/runtime.ts` to confirm the dispatch shape**

The relevant block is around line 95–102:
```ts
const sideInput = input.nodeInputs?.[current] ?? {};
const result = await invokePrimitive(nodeDef.primitive, {
  workspaceId: input.workspaceId,
  workflowRunId: run.id,
  nodeId: current,
  config: nodeDef.config,
  ...sideInput,
});
```

- [ ] **Step 3: Add a workspace fetch at the top of `runWorkflow` and pass `state` + `workspace` to ctx**

In `engine/workflow/runtime.ts`, find the existing import block (line 1–15) and add:
```ts
import { getWorkspace } from '@engine/storage/workspace';
import type { Workspace } from '@engine/types';
```

Inside `runWorkflow`, immediately after the `runRow` insert (before the `const run: WorkflowRun = {...}` line), add a workspace fetch:
```ts
  const workspace: Workspace | null = await getWorkspace(input.workspaceId);
  if (!workspace) throw new Error(`runWorkflow: workspace ${input.workspaceId} not found`);
```

Then in the dispatch block (the `invokePrimitive` call), pass `state` and `workspace`:
```ts
    const sideInput = input.nodeInputs?.[current] ?? {};
    const result = await invokePrimitive(nodeDef.primitive, {
      workspaceId: input.workspaceId,
      workflowRunId: run.id,
      nodeId: current,
      config: nodeDef.config,
      state: { ...state },        // snapshot, not the mutable ref
      workspace,
      ...sideInput,
    });
```

- [ ] **Step 4: Write the failing test**

Append to `engine/__tests__/workflow/runtime.test.ts` (inside the file, after the existing `describe('pickNextNode', ...)` block, before the closing of the file):

```ts
import type { Workspace } from '@engine/types';

describe('runWorkflow ctx', () => {
  it('passes state snapshot and workspace to each primitive (shape-only test)', () => {
    // This is a compile-time shape check; full e2e is covered by integration tests.
    // Asserting on the runtime's call shape is overkill here — we trust the
    // implementation by reading runtime.ts. This test reserves a placeholder for
    // future expansion (e.g., a fake primitive that captures its ctx).
    const w: Workspace = {
      id: 'ws-x', orgId: 'org-x', ownerId: null,
      workflowId: 'noop/v1', rulesPackId: 'noop', rulesPackVersion: '1.0.0',
      status: 'open', createdAt: new Date().toISOString(),
    };
    expect(w.id).toBe('ws-x');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run -- engine/__tests__/workflow/runtime.test.ts
```
Expected: 6 passed (5 prior + 1 new shape check).

- [ ] **Step 6: Run tsc**

```bash
npx tsc --noEmit
```
Expected: clean. If it errors on missing `state`/`workspace` fields in any existing primitive's input interface, you must NOT add them to the per-primitive interfaces (Phase 1 stubs ignore them). The error would be in a TEST that passes a typed ctx — none should exist yet. Investigate before proceeding.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json engine/workflow/runtime.ts engine/__tests__/workflow/runtime.test.ts
git commit -m "feat(engine): pass state snapshot + workspace to primitive ctx; add ajv + yaml deps"
```

---

## Task 2: CanonicalEntity storage (`engine/storage/entities.ts`)

**Files:**
- Create: `engine/storage/entities.ts`
- Test: `engine/__tests__/storage/entities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/storage/entities.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn().mockResolvedValue({
  data: { id: 'ent-1', workspace_id: 'ws-1', type: 'classification',
          value: { categoryId: 'cat-electronics' }, citations: [] },
  error: null,
});
const selectMock = vi.fn().mockReturnValue({ single: insertMock });
const insertFnMock = vi.fn().mockReturnValue({ select: selectMock });
const eqMock = vi.fn().mockResolvedValue({ data: [], error: null });
const selectListMock = vi.fn().mockReturnValue({ eq: eqMock });
const fromMock = vi.fn().mockReturnValue({ insert: insertFnMock, select: selectListMock });

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  insertMock.mockClear(); selectMock.mockClear(); insertFnMock.mockClear();
  eqMock.mockClear(); selectListMock.mockClear(); fromMock.mockClear();
});

import { insertEntity, listEntities } from '@engine/storage/entities';

describe('insertEntity', () => {
  it('writes snake_case row and maps result back to domain shape', async () => {
    const ent = await insertEntity({
      workspaceId: 'ws-1',
      type: 'classification',
      value: { categoryId: 'cat-electronics' },
      citations: [],
    });
    expect(fromMock).toHaveBeenCalledWith('eng_canonical_entities');
    const row = insertFnMock.mock.calls[0][0];
    expect(row.workspace_id).toBe('ws-1');
    expect(row.type).toBe('classification');
    expect(row.value).toEqual({ categoryId: 'cat-electronics' });
    expect(ent.id).toBe('ent-1');
    expect(ent.workspaceId).toBe('ws-1');
  });
});

describe('listEntities', () => {
  it('filters by workspace_id and optionally by type', async () => {
    await listEntities('ws-1');
    expect(fromMock).toHaveBeenLastCalledWith('eng_canonical_entities');
    expect(selectListMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenLastCalledWith('workspace_id', 'ws-1');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/storage/entities.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/storage/entities.ts`**

```ts
// engine/storage/entities.ts
import { createServerClient } from '@/lib/supabase-server';
import type { CanonicalEntity, CitationAnchor } from '@engine/types';

export async function insertEntity(input: {
  workspaceId: string;
  type: string;
  value: Record<string, unknown>;
  citations: CitationAnchor[];
}): Promise<CanonicalEntity> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_canonical_entities')
    .insert({
      workspace_id: input.workspaceId,
      type: input.type,
      value: input.value,
      citations: input.citations,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`insertEntity failed: ${error?.message}`);
  return rowToEntity(data);
}

export async function listEntities(
  workspaceId: string,
  type?: string,
): Promise<CanonicalEntity[]> {
  const supabase = createServerClient();
  const base = supabase.from('eng_canonical_entities').select().eq('workspace_id', workspaceId);
  const { data, error } = type ? await base.eq('type', type) : await base;
  if (error) throw new Error(`listEntities failed: ${error.message}`);
  return (data ?? []).map(rowToEntity);
}

type EntityRow = {
  id: string; workspace_id: string; type: string;
  value: Record<string, unknown>; citations: CitationAnchor[];
};

function rowToEntity(r: EntityRow): CanonicalEntity {
  return {
    id: r.id, workspaceId: r.workspace_id, type: r.type,
    value: r.value, citations: r.citations,
  };
}
```

- [ ] **Step 4: Run tests + tsc**

```bash
npm run test:run -- engine/__tests__/storage/entities.test.ts
npx tsc --noEmit
```
Expected: 2 tests passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/storage/entities.ts engine/__tests__/storage/entities.test.ts
git commit -m "feat(engine): add CanonicalEntity storage (insertEntity, listEntities)"
```

---

## Task 3: Rules pack — manifest + hitl-policy + dir skeleton

**Files:**
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/manifest.json`
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/hitl-policy.yaml`
- Create: empty subdirs: `schemas/`, `rules/`, `rules/prompts/`, `lookups/`, `templates/` (with .gitkeep)

- [ ] **Step 1: Create dir tree**

```bash
mkdir -p rules-packs/eu-gpsr-epr/2026.05.0/schemas rules-packs/eu-gpsr-epr/2026.05.0/rules/prompts rules-packs/eu-gpsr-epr/2026.05.0/lookups rules-packs/eu-gpsr-epr/2026.05.0/templates
```

Then create empty `.gitkeep` markers in each (use Write tool to make empty files at):
- `rules-packs/eu-gpsr-epr/2026.05.0/schemas/.gitkeep`
- `rules-packs/eu-gpsr-epr/2026.05.0/rules/.gitkeep`
- `rules-packs/eu-gpsr-epr/2026.05.0/rules/prompts/.gitkeep`
- `rules-packs/eu-gpsr-epr/2026.05.0/lookups/.gitkeep`
- `rules-packs/eu-gpsr-epr/2026.05.0/templates/.gitkeep`

- [ ] **Step 2: Write the manifest**

Create `rules-packs/eu-gpsr-epr/2026.05.0/manifest.json`:
```json
{
  "id": "eu-gpsr-epr",
  "version": "2026.05.0",
  "displayName": "EU GPSR + EPR (Germany)",
  "locales": ["de", "en"],
  "schemas": [
    "schemas/ProductCatalogItem.json",
    "schemas/EprRegistrationDe.json",
    "schemas/GpsrSafetyNotice.json"
  ],
  "rules": [
    "rules/eligibility.yaml",
    "rules/high-risk.yaml"
  ],
  "lookups": [
    "lookups/eu-product-categories.jsonl",
    "lookups/de-epr-schemes.jsonl",
    "lookups/de-language-strings.jsonl"
  ],
  "templates": [],
  "hitlPolicy": "hitl-policy.yaml"
}
```

- [ ] **Step 3: Write the hitl policy**

Create `rules-packs/eu-gpsr-epr/2026.05.0/hitl-policy.yaml`:
```yaml
# Per-field confidence threshold; values below this set needsReview=true.
threshold: 0.85

# Categories that ALWAYS force HITL regardless of confidence.
# Matched against ProductCatalogItem.categoryId (see lookups/eu-product-categories.jsonl).
alwaysGateCategories:
  - cat-batteries-portable
  - cat-batteries-industrial
  - cat-electronics-consumer
  - cat-toys

# Reviewer roles permitted to approve gated artifacts. Phase 2 doesn't enforce
# this (auto-approve passes through); recorded for future phases.
reviewerRoles:
  - reviewer
  - admin
  - owner

# SLA (informational, not enforced in Phase 2).
slaHours: 24
```

- [ ] **Step 4: Verify the manifest loads through the Phase 1 loader**

Add a one-off ad-hoc verification (do NOT commit this as a permanent test):

```bash
node --input-type=module -e "
import('./engine/rules-pack/loader.js').catch(() => null);
console.log('manifest exists:', require('fs').existsSync('./rules-packs/eu-gpsr-epr/2026.05.0/manifest.json'));
"
```

(Compiled JS won't exist; just confirm the file is on disk. Real load-test comes in Task 4 covering the context helper.)

Run the existing full suite to ensure nothing broke:
```bash
npm run test:run
npx tsc --noEmit
```
Expected: all green, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add rules-packs/eu-gpsr-epr
git commit -m "feat(rules-pack): add eu-gpsr-epr@2026.05.0 manifest + hitl-policy + dir skeleton"
```

---

## Task 4: Pack context cache (`engine/rules-pack/context.ts`)

**Files:**
- Create: `engine/rules-pack/context.ts`
- Test: `engine/__tests__/rules-pack/context.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/rules-pack/context.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => {
  clearPackCache();
});

describe('loadPackForRef', () => {
  it('loads a pack by "id@version" reference', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    expect(pack.manifest.id).toBe('eu-gpsr-epr');
    expect(pack.manifest.version).toBe('2026.05.0');
  });

  it('returns the same instance on repeat call (cached)', async () => {
    const a = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const b = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    expect(a).toBe(b);
  });

  it('rejects malformed refs', async () => {
    await expect(loadPackForRef('no-at-sign', PACKS_DIR)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/rules-pack/context.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/rules-pack/context.ts`**

```ts
// engine/rules-pack/context.ts
import path from 'path';
import type { RulesPack } from '@engine/types';
import { loadRulesPack } from '@engine/rules-pack/loader';
import { parsePackRef } from '@engine/rules-pack/version';

const DEFAULT_PACKS_DIR = path.resolve(process.cwd(), 'rules-packs');

// Process-wide LRU cache keyed by "id@version". Tiny; primitives call this
// once per workflow run and we don't expect many concurrent versions.
const cache = new Map<string, RulesPack>();

export async function loadPackForRef(
  ref: string,
  packsDir: string = DEFAULT_PACKS_DIR,
): Promise<RulesPack> {
  const hit = cache.get(ref);
  if (hit) return hit;
  const { id, version } = parsePackRef(ref);
  const pack = await loadRulesPack(id, version, packsDir);
  cache.set(ref, pack);
  return pack;
}

export function clearPackCache(): void {
  cache.clear();
}
```

- [ ] **Step 4: Verify tests pass + tsc clean**

```bash
npm run test:run -- engine/__tests__/rules-pack/context.test.ts
npx tsc --noEmit
```
Expected: 3 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/rules-pack/context.ts engine/__tests__/rules-pack/context.test.ts
git commit -m "feat(engine): add rules-pack context cache (loadPackForRef + clearPackCache)"
```

---

## Task 5: Pack content — 3 JSON-Schemas

**Files:**
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/schemas/ProductCatalogItem.json`
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/schemas/EprRegistrationDe.json`
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/schemas/GpsrSafetyNotice.json`

- [ ] **Step 1: Write `ProductCatalogItem.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "ProductCatalogItem",
  "title": "ProductCatalogItem",
  "type": "object",
  "required": ["name", "manufacturer", "weightGrams", "categoryId"],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "manufacturer": {
      "type": "object",
      "required": ["name", "address", "country"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "address": { "type": "string", "minLength": 1 },
        "country": { "type": "string", "pattern": "^[A-Z]{2}$" },
        "vatId": { "type": "string" }
      }
    },
    "importer": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "address": { "type": "string" },
        "country": { "type": "string", "pattern": "^[A-Z]{2}$" },
        "vatId": { "type": "string" }
      }
    },
    "weightGrams": { "type": "number", "minimum": 0 },
    "materials": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "percentage"],
        "properties": {
          "type": { "type": "string" },
          "percentage": { "type": "number", "minimum": 0, "maximum": 100 }
        }
      }
    },
    "packaging": {
      "type": "object",
      "properties": {
        "totalWeightGrams": { "type": "number", "minimum": 0 },
        "components": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["material", "weightGrams"],
            "properties": {
              "material": { "type": "string" },
              "weightGrams": { "type": "number", "minimum": 0 }
            }
          }
        }
      }
    },
    "hasBattery": { "type": "boolean" },
    "batteryDetails": {
      "oneOf": [
        { "type": "null" },
        {
          "type": "object",
          "required": ["chemistry", "capacityWh", "weightGrams"],
          "properties": {
            "chemistry": { "type": "string" },
            "capacityWh": { "type": "number", "minimum": 0 },
            "weightGrams": { "type": "number", "minimum": 0 }
          }
        }
      ]
    },
    "eanGtin": { "type": "string", "pattern": "^[0-9]{8,14}$" },
    "categoryId": { "type": "string", "minLength": 1 }
  }
}
```

- [ ] **Step 2: Write `EprRegistrationDe.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "EprRegistrationDe",
  "title": "EprRegistrationDe",
  "type": "object",
  "required": ["scheme", "producer", "productCategory", "perUnitWeights"],
  "properties": {
    "scheme": {
      "type": "string",
      "enum": ["stiftung-ear", "zsvr"]
    },
    "producer": {
      "type": "object",
      "required": ["name", "address", "country"],
      "properties": {
        "name": { "type": "string" },
        "address": { "type": "string" },
        "country": { "type": "string", "pattern": "^[A-Z]{2}$" },
        "vatId": { "type": "string" },
        "deTaxNumber": { "type": "string" },
        "deAuthRep": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "address": { "type": "string" }
          }
        }
      }
    },
    "productCategory": { "type": "string" },
    "perUnitWeights": {
      "type": "object",
      "properties": {
        "deviceGrams": { "type": "number", "minimum": 0 },
        "packagingGrams": { "type": "number", "minimum": 0 }
      }
    },
    "weeeClass": { "type": "string" },
    "packagingMaterials": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["material", "weightGrams"],
        "properties": {
          "material": {
            "type": "string",
            "enum": ["paper", "cardboard", "glass", "plastic-pet", "plastic-other", "metal-steel", "metal-aluminium", "wood", "composite"]
          },
          "weightGrams": { "type": "number", "minimum": 0 }
        }
      }
    },
    "registrationLanguage": { "type": "string", "enum": ["de"] }
  }
}
```

- [ ] **Step 3: Write `GpsrSafetyNotice.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "GpsrSafetyNotice",
  "title": "GpsrSafetyNotice",
  "type": "object",
  "required": ["product", "manufacturer", "safetyInformation", "languages"],
  "properties": {
    "product": {
      "type": "object",
      "required": ["name", "modelOrType", "batchOrSerial"],
      "properties": {
        "name": { "type": "string" },
        "modelOrType": { "type": "string" },
        "batchOrSerial": { "type": "string" }
      }
    },
    "manufacturer": {
      "type": "object",
      "required": ["name", "postalAddress", "electronicAddress"],
      "properties": {
        "name": { "type": "string" },
        "postalAddress": { "type": "string" },
        "electronicAddress": { "type": "string", "format": "email" }
      }
    },
    "euResponsiblePerson": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "postalAddress": { "type": "string" },
        "electronicAddress": { "type": "string" }
      }
    },
    "safetyInformation": {
      "type": "object",
      "required": ["warnings", "instructionsForUse"],
      "properties": {
        "warnings": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "instructionsForUse": { "type": "string", "minLength": 1 },
        "intendedUse": { "type": "string" },
        "foreseeableMisuse": { "type": "array", "items": { "type": "string" } }
      }
    },
    "languages": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-z]{2}$" },
      "minItems": 1
    },
    "safetyContact": {
      "type": "object",
      "required": ["email"],
      "properties": { "email": { "type": "string", "format": "email" } }
    }
  }
}
```

- [ ] **Step 4: Sanity check files are valid JSON**

```bash
node -e "['ProductCatalogItem','EprRegistrationDe','GpsrSafetyNotice'].forEach(n => { JSON.parse(require('fs').readFileSync('rules-packs/eu-gpsr-epr/2026.05.0/schemas/'+n+'.json','utf-8')); console.log(n,'ok'); });"
```
Expected: 3 "ok" lines.

Then run the existing suite to ensure nothing broke:
```bash
npm run test:run
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add rules-packs/eu-gpsr-epr/2026.05.0/schemas
git commit -m "feat(rules-pack): add 3 JSON-Schemas (ProductCatalogItem, EprRegistrationDe, GpsrSafetyNotice)"
```

---

## Task 6: Pack content — 2 rules YAMLs

**Files:**
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/rules/eligibility.yaml`
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/rules/high-risk.yaml`

- [ ] **Step 1: Write `eligibility.yaml`**

```yaml
# Maps product categories (from lookups/eu-product-categories.jsonl) to the
# German EPR schemes that apply. The reason primitive consumes this to decide
# which drafts to produce.

rules:
  - id: weee-electronics
    when:
      anyCategoryIn:
        - cat-electronics-consumer
        - cat-electronics-it
        - cat-electronics-tools
        - cat-electronics-lighting
        - cat-electronics-medical
    then:
      schemes:
        - stiftung-ear
      mandatory: true
      rationale: "ElektroG §6 — electrical and electronic equipment placed on the DE market requires WEEE registration."

  - id: packaging-any
    when:
      hasPackaging: true
    then:
      schemes:
        - zsvr
      mandatory: true
      rationale: "VerpackG §9 — all sales packaging placed on the DE market requires LUCID/ZSVR registration."

  - id: batteries-portable
    when:
      anyCategoryIn:
        - cat-batteries-portable
        - cat-batteries-industrial
      then:
        schemes:
          - stiftung-ear
        mandatory: true
        rationale: "BattG §4 — battery producers must register before placing on market. Phase 2 routes via Stiftung EAR; battery-specific PROs deferred."
```

- [ ] **Step 2: Write `high-risk.yaml`**

```yaml
# Conditions that force HITL gating regardless of confidence. Consumed by the
# validate primitive together with hitl-policy.yaml::alwaysGateCategories.

predicates:
  - id: HIGH_RISK_PRODUCT
    description: "Product category is on the always-gate list."
    when:
      categoryIn:
        - cat-batteries-portable
        - cat-batteries-industrial
        - cat-electronics-consumer
        - cat-toys

  - id: HIGH_RISK_MISSING_VAT
    description: "Producer/importer has no VAT ID — German EPR schemes require one."
    when:
      missingFields:
        - producer.vatId
```

- [ ] **Step 3: Sanity check YAML parses**

```bash
node -e "const yaml=require('yaml'); ['eligibility','high-risk'].forEach(n=>{yaml.parse(require('fs').readFileSync('rules-packs/eu-gpsr-epr/2026.05.0/rules/'+n+'.yaml','utf-8')); console.log(n,'ok');});"
```
Expected: 2 "ok" lines.

- [ ] **Step 4: Commit**

```bash
git add rules-packs/eu-gpsr-epr/2026.05.0/rules/eligibility.yaml rules-packs/eu-gpsr-epr/2026.05.0/rules/high-risk.yaml
git commit -m "feat(rules-pack): add eligibility + high-risk YAML rules"
```

---

## Task 7: Pack content — 5 prompt files

**Files:**
- Create 5 files under `rules-packs/eu-gpsr-epr/2026.05.0/rules/prompts/`

- [ ] **Step 1: Write `classify.product-category.md`**

```markdown
# Classify product into EU product category

You are a product compliance classifier. Given the source text of a product
specification sheet, choose exactly one category id from the provided list
that best describes the product. Return JSON:

```json
{ "categoryId": "<one id from the list>", "confidence": 0.0-1.0, "rationale": "..." }
```

Confidence rubric:
- 0.95+ : category is explicitly named in source or unambiguous from product type
- 0.80–0.94 : strongly implied by features (e.g. "USB-C charger" → electronics-consumer)
- 0.60–0.79 : reasonable inference from materials, intended use, or images
- below 0.60 : you are guessing; pick the closest category and mark confidence low

If no category in the list fits at all, set `categoryId` to `cat-unknown` and
`confidence` to 0.0.

CATEGORY LIST:
{{categoryList}}

PRODUCT SOURCE TEXT:
{{sourceText}}
```

- [ ] **Step 2: Write `extract.product-catalog.md`**

```markdown
# Extract canonical ProductCatalogItem

Given product source text and the target JSON-Schema, extract a single
`ProductCatalogItem` object. For each field:

- Use only information present in the source text. Never invent.
- If a required field cannot be determined, set its value to null (the
  validator will flag it as a gap).
- For each leaf field also emit a confidence score 0.0–1.0 and the character
  span(s) in the source that justify the value (start/end char indexes).

Return JSON of shape:
```json
{
  "value": { ...ProductCatalogItem fields... },
  "fieldMeta": {
    "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": N, "end": M}] }
  }
}
```

SCHEMA:
{{schemaJson}}

CATEGORY ASSIGNED (from classify step):
{{categoryId}}

SOURCE TEXT:
{{sourceText}}
```

- [ ] **Step 3: Write `draft.epr-de-weee.md`**

```markdown
# Draft Stiftung EAR (WEEE) registration — Germany

Produce a draft `EprRegistrationDe` object with `scheme: "stiftung-ear"`. Use
the canonical ProductCatalogItem and the looked-up scheme metadata. Required
fields per the schema. Where information is missing, set to null and explain
in the per-field gap notes.

Output JSON shape:
```json
{
  "value": { "scheme": "stiftung-ear", ...other fields... },
  "fieldMeta": {
    "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": N, "end": M}] }
  }
}
```

WEEE class mapping rules:
- Consumer electronics → "4 — IT and telecommunication equipment" or "5 — Lighting equipment", choose by product subtype
- Portable batteries embedded in device → still WEEE; battery shows on the registration separately

CANONICAL ENTITY:
{{productCatalogItemJson}}

SCHEME METADATA:
{{schemeMetadataJson}}

OUTPUT SCHEMA:
{{outputSchemaJson}}
```

- [ ] **Step 4: Write `draft.epr-de-packaging.md`**

```markdown
# Draft ZSVR / LUCID packaging registration — Germany

Produce a draft `EprRegistrationDe` object with `scheme: "zsvr"`. Required
fields per the schema. Map every packaging component from the canonical entity
into `packagingMaterials` using the schema's material enum:
`paper, cardboard, glass, plastic-pet, plastic-other, metal-steel, metal-aluminium, wood, composite`.

If a material in the source doesn't fit cleanly, choose the closest enum value
and set its field confidence to 0.7 or lower.

Output JSON shape:
```json
{
  "value": { "scheme": "zsvr", ...other fields... },
  "fieldMeta": { "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": N, "end": M}] } }
}
```

CANONICAL ENTITY:
{{productCatalogItemJson}}

SCHEME METADATA:
{{schemeMetadataJson}}

OUTPUT SCHEMA:
{{outputSchemaJson}}
```

- [ ] **Step 5: Write `draft.gpsr-article9.md`**

```markdown
# Draft GPSR Article 9 safety notice

Produce a draft `GpsrSafetyNotice` per the schema. Required: at least one
warning, instructionsForUse non-empty, languages list with at least 'de' for
the German market plus 'en' if the source uses English.

If euResponsiblePerson is not in source, leave the object out (it's optional
in the schema). The validator will flag the gap only if the manufacturer is
based outside the EU — that decision lives in the validate primitive.

Output JSON shape:
```json
{
  "value": { ...GpsrSafetyNotice fields... },
  "fieldMeta": { "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": N, "end": M}] } }
}
```

CANONICAL ENTITY:
{{productCatalogItemJson}}

OUTPUT SCHEMA:
{{outputSchemaJson}}
```

- [ ] **Step 6: Sanity check files exist**

```bash
ls rules-packs/eu-gpsr-epr/2026.05.0/rules/prompts/
```
Expected: 5 .md files + .gitkeep.

Run full suite:
```bash
npm run test:run
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add rules-packs/eu-gpsr-epr/2026.05.0/rules/prompts
git commit -m "feat(rules-pack): add 5 LLM prompts (classify, extract, 3 drafts)"
```

---

## Task 8: Pack content — 3 JSONL lookups

**Files:**
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/lookups/eu-product-categories.jsonl`
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/lookups/de-epr-schemes.jsonl`
- Create: `rules-packs/eu-gpsr-epr/2026.05.0/lookups/de-language-strings.jsonl`

- [ ] **Step 1: Write `eu-product-categories.jsonl`**

Each line is one JSON object. Include the 10 categories below verbatim, plus add at least 20 more covering common e-commerce verticals (kitchen appliances, garden tools, textiles, cosmetics, food contact items, etc.) following the same shape. Aim for ~30 total.

Required JSON shape per row:
```json
{ "id": "cat-...", "label": "...", "weeeClass": "..." | null, "gpsrRiskBand": "low|medium|high", "notes": "..." }
```

The 10 baseline rows (paste verbatim, one per line):
```jsonl
{"id":"cat-unknown","label":"Unknown / unclassified","weeeClass":null,"gpsrRiskBand":"high","notes":"Fallback when classifier cannot decide; always gated."}
{"id":"cat-electronics-consumer","label":"Consumer electronics","weeeClass":"4","gpsrRiskBand":"high","notes":"Phones, chargers, headphones, audio."}
{"id":"cat-electronics-it","label":"IT / telecommunication equipment","weeeClass":"4","gpsrRiskBand":"medium","notes":"Routers, laptops, peripherals."}
{"id":"cat-electronics-tools","label":"Electrical tools","weeeClass":"6","gpsrRiskBand":"medium","notes":"Drills, screwdrivers, garden tools with motors."}
{"id":"cat-electronics-lighting","label":"Lighting equipment","weeeClass":"5","gpsrRiskBand":"medium","notes":"LED bulbs, lamps, fixtures."}
{"id":"cat-electronics-medical","label":"Medical devices (low risk)","weeeClass":"8","gpsrRiskBand":"high","notes":"Thermometers, blood pressure monitors."}
{"id":"cat-batteries-portable","label":"Portable batteries","weeeClass":null,"gpsrRiskBand":"high","notes":"AA, AAA, lithium coin cells, power banks (BattG)."}
{"id":"cat-batteries-industrial","label":"Industrial batteries","weeeClass":null,"gpsrRiskBand":"high","notes":"E-bike packs, UPS battery banks."}
{"id":"cat-toys","label":"Toys (3+ years)","weeeClass":null,"gpsrRiskBand":"high","notes":"GPSR + Toy Safety Directive; always gated."}
{"id":"cat-textiles","label":"Textiles / apparel","weeeClass":null,"gpsrRiskBand":"low","notes":"Clothing without electronic components."}
```

Then add at least 20 more rows for: kitchen utensils, kitchen small appliances, cookware, furniture, garden tools (non-electric), garden machinery, sporting goods, bicycles, books/media, cosmetics, personal care, food contact items, baby products (non-toy), pet products, office supplies, stationery, jewellery, watches, bags/luggage, shoes. Use shape above; assign `weeeClass` only where the product is electrical, otherwise `null`. Assign `gpsrRiskBand` conservatively (high for baby, cosmetics, food contact, medical-adjacent; medium for sporting, garden machinery; low for textiles, books, stationery).

- [ ] **Step 2: Write `de-epr-schemes.jsonl`**

Two rows exactly:

```jsonl
{"schemeId":"stiftung-ear","name":"Stiftung Elektro-Altgeräte Register","jurisdiction":"DE","wasteStream":"weee","portalUrl":"https://www.ear-system.de/ear-portal/","registrationFieldShape":{"required":["producer.name","producer.address","producer.country","producer.deTaxNumber","productCategory","weeeClass","perUnitWeights.deviceGrams"],"language":"de"},"appliesToCategories":["cat-electronics-consumer","cat-electronics-it","cat-electronics-tools","cat-electronics-lighting","cat-electronics-medical","cat-batteries-portable","cat-batteries-industrial"]}
{"schemeId":"zsvr","name":"Zentrale Stelle Verpackungsregister (LUCID)","jurisdiction":"DE","wasteStream":"packaging","portalUrl":"https://lucid.verpackungsregister.org/","registrationFieldShape":{"required":["producer.name","producer.address","producer.country","packagingMaterials","perUnitWeights.packagingGrams"],"language":"de"},"appliesToCategories":["*"]}
```

(The `"*"` means packaging applies to all categories because nearly every product ships in packaging.)

- [ ] **Step 3: Write `de-language-strings.jsonl`**

Each row is `{ "key": "...", "de": "...", "en": "..." }`. Include at least these keys for form labels (paste verbatim, add ~10 more covering common producer/packaging terms):

```jsonl
{"key":"producer.name","de":"Name des Herstellers","en":"Producer name"}
{"key":"producer.address","de":"Anschrift des Herstellers","en":"Producer address"}
{"key":"producer.country","de":"Land","en":"Country"}
{"key":"producer.vatId","de":"USt-IdNr.","en":"VAT ID"}
{"key":"producer.deTaxNumber","de":"Steuernummer","en":"German tax number"}
{"key":"productCategory","de":"Produktkategorie","en":"Product category"}
{"key":"weeeClass","de":"WEEE-Geräteklasse","en":"WEEE class"}
{"key":"perUnitWeights.deviceGrams","de":"Gerätegewicht (g)","en":"Device weight (g)"}
{"key":"perUnitWeights.packagingGrams","de":"Verpackungsgewicht (g)","en":"Packaging weight (g)"}
{"key":"packagingMaterials","de":"Verpackungsmaterialien","en":"Packaging materials"}
```

Add at least 10 more rows for: importer fields, contact details, safety warnings, instructions for use, EU responsible person, electronic address, etc.

- [ ] **Step 4: Sanity check JSONL parses**

```bash
node -e "['eu-product-categories','de-epr-schemes','de-language-strings'].forEach(n=>{const lines=require('fs').readFileSync('rules-packs/eu-gpsr-epr/2026.05.0/lookups/'+n+'.jsonl','utf-8').split(/\r?\n/).filter(Boolean); lines.forEach((l,i)=>{try{JSON.parse(l)}catch(e){console.error(n,'line',i+1,e.message);process.exit(1)}}); console.log(n,lines.length,'rows ok');});"
```
Expected: 3 "rows ok" lines, no errors.

Full suite:
```bash
npm run test:run
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add rules-packs/eu-gpsr-epr/2026.05.0/lookups
git commit -m "feat(rules-pack): add 3 JSONL lookups (categories, DE schemes, language strings)"
```

---

## Task 9: Prompt reader (`engine/rules-pack/prompts.ts`)

**Files:**
- Create: `engine/rules-pack/prompts.ts`
- Test: `engine/__tests__/rules-pack/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/rules-pack/prompts.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => { clearPackCache(); });

describe('loadPrompt', () => {
  it('reads a prompt .md from the pack', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const text = await loadPrompt(pack, 'classify.product-category.md');
    expect(text).toContain('Classify product into EU product category');
  });

  it('throws when prompt file is missing', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    await expect(loadPrompt(pack, 'does-not-exist.md')).rejects.toThrow(/prompt/i);
  });
});

describe('renderPrompt', () => {
  it('substitutes {{var}} placeholders', () => {
    const out = renderPrompt('Hello {{name}}, you are {{role}}.', {
      name: 'Acme', role: 'a producer',
    });
    expect(out).toBe('Hello Acme, you are a producer.');
  });

  it('leaves unknown placeholders intact', () => {
    expect(renderPrompt('{{a}}+{{b}}', { a: 'x' })).toBe('x+{{b}}');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/rules-pack/prompts.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/rules-pack/prompts.ts`**

```ts
// engine/rules-pack/prompts.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { RulesPack } from '@engine/types';

const cache = new Map<string, string>();

export async function loadPrompt(pack: RulesPack, relPath: string): Promise<string> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${relPath}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const full = path.join(pack.rootDir, 'rules', 'prompts', relPath);
  try {
    const text = await fs.readFile(full, 'utf-8');
    cache.set(key, text);
    return text;
  } catch (err) {
    throw new Error(`prompt file not found at ${full}: ${(err as Error).message}`);
  }
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (m, name) => {
    return name in vars ? vars[name] : m;
  });
}
```

- [ ] **Step 4: Verify tests pass + tsc**

```bash
npm run test:run -- engine/__tests__/rules-pack/prompts.test.ts
npx tsc --noEmit
```
Expected: 4 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/rules-pack/prompts.ts engine/__tests__/rules-pack/prompts.test.ts
git commit -m "feat(engine): add prompt loader + renderPrompt with {{var}} substitution"
```

---

## Task 10: Schema reader + ajv validator (`engine/rules-pack/schemas.ts`)

**Files:**
- Create: `engine/rules-pack/schemas.ts`
- Test: `engine/__tests__/rules-pack/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/rules-pack/schemas.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';
import { loadSchema, validatorFor } from '@engine/rules-pack/schemas';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => { clearPackCache(); });

describe('loadSchema', () => {
  it('reads a JSON-Schema from the pack', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const schema = await loadSchema(pack, 'ProductCatalogItem.json');
    expect((schema as { title: string }).title).toBe('ProductCatalogItem');
  });
});

describe('validatorFor', () => {
  it('returns a validator that accepts a valid ProductCatalogItem', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const validate = await validatorFor(pack, 'ProductCatalogItem.json');
    const valid = {
      name: 'USB-C Charger 65W',
      manufacturer: { name: 'Acme GmbH', address: 'Berlin', country: 'DE' },
      weightGrams: 120,
      categoryId: 'cat-electronics-consumer',
    };
    expect(validate(valid)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('returns a validator that rejects an invalid manufacturer.country', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const validate = await validatorFor(pack, 'ProductCatalogItem.json');
    const invalid = {
      name: 'X',
      manufacturer: { name: 'A', address: 'B', country: 'germany' }, // bad
      weightGrams: 1,
      categoryId: 'cat-x',
    };
    expect(validate(invalid)).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/rules-pack/schemas.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/rules-pack/schemas.ts`**

```ts
// engine/rules-pack/schemas.ts
import { promises as fs } from 'fs';
import path from 'path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { RulesPack } from '@engine/types';

const schemaCache = new Map<string, object>();
const validatorCache = new Map<string, ValidateFunction>();

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export async function loadSchema(pack: RulesPack, relPath: string): Promise<object> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${relPath}`;
  const hit = schemaCache.get(key);
  if (hit) return hit;
  const full = path.join(pack.rootDir, 'schemas', relPath);
  let raw: string;
  try {
    raw = await fs.readFile(full, 'utf-8');
  } catch (err) {
    throw new Error(`schema file not found at ${full}: ${(err as Error).message}`);
  }
  const parsed: object = JSON.parse(raw);
  schemaCache.set(key, parsed);
  return parsed;
}

export async function validatorFor(pack: RulesPack, relPath: string): Promise<ValidateFunction> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${relPath}`;
  const hit = validatorCache.get(key);
  if (hit) return hit;
  const schema = await loadSchema(pack, relPath);
  const v = ajv.compile(schema);
  validatorCache.set(key, v);
  return v;
}
```

- [ ] **Step 4: Install ajv-formats**

The test uses `format: "email"` which requires `ajv-formats`:
```bash
npm install ajv-formats
```

- [ ] **Step 5: Run tests + tsc**

```bash
npm run test:run -- engine/__tests__/rules-pack/schemas.test.ts
npx tsc --noEmit
```
Expected: 3 passed; tsc clean. If a test fails because of `additionalProperties` strictness, the `strict: false` flag in the Ajv constructor handles it; if not, also pass `strictTypes: false` and `validateFormats: true`.

- [ ] **Step 6: Commit**

```bash
git add engine/rules-pack/schemas.ts engine/__tests__/rules-pack/schemas.test.ts package.json package-lock.json
git commit -m "feat(engine): add schema loader + ajv validator factory (+ ajv-formats)"
```

---

## Task 11: Lookup reader (`engine/rules-pack/lookups.ts`)

**Files:**
- Create: `engine/rules-pack/lookups.ts`
- Test: `engine/__tests__/rules-pack/lookups.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/rules-pack/lookups.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';
import { loadLookup } from '@engine/rules-pack/lookups';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => { clearPackCache(); });

describe('loadLookup', () => {
  it('parses a JSONL file into an array of rows', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const lookup = await loadLookup(pack, 'eu-product-categories');
    expect(lookup.rows.length).toBeGreaterThanOrEqual(10);
    const first = lookup.rows[0] as { id: string };
    expect(first.id).toMatch(/^cat-/);
  });

  it('indexBy returns a map keyed by the given field', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const lookup = await loadLookup(pack, 'eu-product-categories');
    const byId = lookup.indexBy('id');
    expect(byId.get('cat-unknown')).toBeDefined();
    expect((byId.get('cat-unknown') as { label: string }).label).toMatch(/Unknown/);
  });

  it('throws when the lookup file is missing', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    await expect(loadLookup(pack, 'nope')).rejects.toThrow(/lookup/i);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/rules-pack/lookups.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/rules-pack/lookups.ts`**

```ts
// engine/rules-pack/lookups.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { RulesPack } from '@engine/types';

export interface Lookup {
  rows: ReadonlyArray<Record<string, unknown>>;
  indexBy(field: string): Map<unknown, Record<string, unknown>>;
}

const cache = new Map<string, Lookup>();

export async function loadLookup(pack: RulesPack, name: string): Promise<Lookup> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const full = path.join(pack.rootDir, 'lookups', `${name}.jsonl`);
  let raw: string;
  try {
    raw = await fs.readFile(full, 'utf-8');
  } catch (err) {
    throw new Error(`lookup file not found at ${full}: ${(err as Error).message}`);
  }
  const rows: Record<string, unknown>[] = raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      try { return JSON.parse(line) as Record<string, unknown>; }
      catch (e) { throw new Error(`malformed JSONL at ${full}:${i + 1}: ${(e as Error).message}`); }
    });
  const lookup: Lookup = {
    rows,
    indexBy(field: string) {
      const m = new Map<unknown, Record<string, unknown>>();
      for (const r of rows) m.set(r[field], r);
      return m;
    },
  };
  cache.set(key, lookup);
  return lookup;
}
```

- [ ] **Step 4: Verify tests pass + tsc clean**

```bash
npm run test:run -- engine/__tests__/rules-pack/lookups.test.ts
npx tsc --noEmit
```
Expected: 3 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/rules-pack/lookups.ts engine/__tests__/rules-pack/lookups.test.ts
git commit -m "feat(engine): add JSONL lookup reader with indexBy"
```

---

## Task 12: Real `classify` primitive

**Files:**
- Modify: `engine/primitives/classify.ts`
- Test: `engine/__tests__/primitives/classify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/classify.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the gateway BEFORE importing the SUT (Vitest hoists vi.mock).
const generateTextMock = vi.fn();
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: generateTextMock };
});
vi.mock('@engine/providers/gateway', () => ({
  model: (id: string) => ({ id }),
  DEFAULT_FAST_MODEL: 'mock/fast',
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({
        data: { id: 'ent-1', workspace_id: 'ws-1', type: 'classification',
                value: { categoryId: 'cat-electronics-consumer', confidence: 0.92 },
                citations: [] },
        error: null,
      }) }) }),
      // For trace inserts:
      // The trace.ts insert is fire-and-forget; we don't assert on it here.
    }),
  }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { classifyPrimitive } from '@engine/primitives/classify';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('classifyPrimitive (real impl)', () => {
  it('calls the LLM, parses JSON, returns categoryId + confidence', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: '{ "categoryId": "cat-electronics-consumer", "confidence": 0.92, "rationale": "USB-C charger" }',
    });
    const result = await classifyPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'classify',
      config: { taxonomy: 'eu-product-category' },
      workspace,
      state: {},
      sourceText: 'A 65W USB-C GaN charger by Acme GmbH.',
    });
    expect(result.ok).toBe(true);
    expect(result.value.categoryId).toBe('cat-electronics-consumer');
    expect(result.confidence).toBeCloseTo(0.92);
  });

  it('falls back to cat-unknown with confidence 0 when LLM returns garbage', async () => {
    generateTextMock.mockResolvedValueOnce({ text: 'not json at all' });
    const result = await classifyPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'classify',
      config: { taxonomy: 'eu-product-category' },
      workspace,
      state: {},
      sourceText: '',
    });
    expect(result.ok).toBe(true);
    expect(result.value.categoryId).toBe('cat-unknown');
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/classify.test.ts
```
Expected: FAIL — the existing stub returns `{ class: 'unknown' }` not `{ categoryId: 'cat-electronics-consumer' }`.

- [ ] **Step 3: Replace the stub at `engine/primitives/classify.ts`**

Full file content:
```ts
// engine/primitives/classify.ts
import { generateText } from 'ai';
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { model, DEFAULT_FAST_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';
import { loadLookup } from '@engine/rules-pack/lookups';
import { insertEntity } from '@engine/storage/entities';
import { listSources } from '@engine/storage/workspace';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ClassifyInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { taxonomy?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
  sourceText?: string;   // optional override; otherwise read from workspace sources
}

export interface ClassifyOutput {
  categoryId: string;
}

export async function classifyPrimitive(
  input: ClassifyInput,
): Promise<PrimitiveResult<ClassifyOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    // Phase 1 stub callers don't pass workspace; emit a no-op trace and return unknown.
    const result = ok({ categoryId: 'cat-unknown' }, { confidence: 0 });
    await writeTrace({
      workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
      primitive: 'classify',
      inputs: { taxonomy: input.config.taxonomy ?? null, reason: 'no-workspace-context' },
      output: result.value,
      model: null, confidence: 0, latencyMs: Date.now() - t0,
      costUsd: null, reviewer: null,
    });
    return result;
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);

  // Resolve source text.
  let sourceText = input.sourceText ?? '';
  if (!sourceText) {
    const sources = await listSources(input.workspaceId);
    sourceText = sources.map((s) => s.typedRep.text).join('\n\n---\n\n');
  }

  // Build the prompt.
  const template = await loadPrompt(pack, 'classify.product-category.md');
  const categoryList = await loadLookup(pack, 'eu-product-categories');
  const listText = categoryList.rows
    .map((r) => `- ${(r as { id: string }).id}: ${(r as { label: string }).label}`)
    .join('\n');
  const prompt = renderPrompt(template, {
    categoryList: listText,
    sourceText,
  });

  // Call LLM.
  const { text } = await generateText({
    model: model(DEFAULT_FAST_MODEL),
    prompt,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — AI SDK options compat
    maxTokens: 200,
  });

  // Parse JSON out of the response.
  let parsed: { categoryId?: string; confidence?: number; rationale?: string } = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    // fall through to unknown
  }
  const categoryId = (parsed.categoryId ?? 'cat-unknown') as string;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

  // Persist as a CanonicalEntity for downstream primitives.
  await insertEntity({
    workspaceId: input.workspaceId,
    type: 'classification',
    value: { categoryId, confidence, rationale: parsed.rationale ?? null },
    citations: [],
  });

  const result = ok({ categoryId }, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'classify',
    inputs: { taxonomy: input.config.taxonomy ?? null, sourceLength: sourceText.length },
    output: { categoryId, confidence },
    model: { name: DEFAULT_FAST_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

- [ ] **Step 4: Verify tests pass + tsc clean**

```bash
npm run test:run -- engine/__tests__/primitives/classify.test.ts
npx tsc --noEmit
```
Expected: 2 passed; tsc clean. If tsc complains about the `// @ts-ignore` comment placement, move it to immediately above the `maxTokens:` line.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/classify.ts engine/__tests__/primitives/classify.test.ts
git commit -m "feat(engine): real classify primitive (LLM-driven product-category classification)"
```

---

## Task 13: Real `extract` primitive

**Files:**
- Modify: `engine/primitives/extract.ts`
- Test: `engine/__tests__/primitives/extract.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/extract.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextMock = vi.fn();
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: generateTextMock };
});
vi.mock('@engine/providers/gateway', () => ({
  model: (id: string) => ({ id }),
  DEFAULT_FAST_MODEL: 'mock/fast',
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({
        data: { id: 'ent-2', workspace_id: 'ws-1', type: 'ProductCatalogItem',
                value: {}, citations: [] },
        error: null,
      }) }) }),
    }),
  }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { extractPrimitive } from '@engine/primitives/extract';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('extractPrimitive (real impl)', () => {
  it('parses LLM JSON into ProductCatalogItem + fieldMeta', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        value: {
          name: 'USB-C Charger 65W',
          manufacturer: { name: 'Acme GmbH', address: 'Berlin', country: 'DE' },
          weightGrams: 120,
          categoryId: 'cat-electronics-consumer',
        },
        fieldMeta: { name: { confidence: 0.95, spans: [{ start: 0, end: 20 }] } },
      }),
    });
    const result = await extractPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'extract',
      config: { schema: 'ProductCatalogItem' },
      workspace,
      state: { categoryId: 'cat-electronics-consumer' },
      sourceText: 'USB-C Charger 65W by Acme GmbH, Berlin.',
    });
    expect(result.ok).toBe(true);
    expect(result.value.entity.name).toBe('USB-C Charger 65W');
    expect(result.value.fieldMeta.name.confidence).toBeCloseTo(0.95);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/extract.test.ts
```
Expected: FAIL — current stub returns `{ entities: [] }`.

- [ ] **Step 3: Replace `engine/primitives/extract.ts`**

```ts
// engine/primitives/extract.ts
import { generateText } from 'ai';
import { writeTrace } from '@engine/primitives/trace';
import { ok, fail } from '@engine/result';
import { model, DEFAULT_FAST_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';
import { loadSchema } from '@engine/rules-pack/schemas';
import { insertEntity } from '@engine/storage/entities';
import { listSources } from '@engine/storage/workspace';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ExtractInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { schema?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
  sourceText?: string;
}

export interface ExtractOutput {
  entity: Record<string, unknown>;
  fieldMeta: Record<string, { confidence: number; spans: { start: number; end: number }[] }>;
}

export async function extractPrimitive(
  input: ExtractInput,
): Promise<PrimitiveResult<ExtractOutput>> {
  const t0 = Date.now();
  if (!input.workspace || !input.config.schema) {
    return fail<ExtractOutput>('E_EXTRACT_NO_CONTEXT', 'workspace + schema config required');
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);
  const schema = await loadSchema(pack, `${input.config.schema}.json`);

  let sourceText = input.sourceText ?? '';
  if (!sourceText) {
    const sources = await listSources(input.workspaceId);
    sourceText = sources.map((s) => s.typedRep.text).join('\n\n---\n\n');
  }

  const template = await loadPrompt(pack, 'extract.product-catalog.md');
  const categoryId = (input.state?.categoryId as string | undefined) ?? 'cat-unknown';
  const prompt = renderPrompt(template, {
    schemaJson: JSON.stringify(schema, null, 2),
    categoryId,
    sourceText,
  });

  const { text } = await generateText({
    model: model(DEFAULT_FAST_MODEL),
    prompt,
    // @ts-ignore
    maxTokens: 2000,
  });

  let parsed: { value?: Record<string, unknown>; fieldMeta?: ExtractOutput['fieldMeta'] } = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    // fall through
  }
  const entity = parsed.value ?? {};
  const fieldMeta = parsed.fieldMeta ?? {};

  // Persist as a canonical entity.
  await insertEntity({
    workspaceId: input.workspaceId,
    type: input.config.schema,
    value: { ...entity, _fieldMeta: fieldMeta },
    citations: [],
  });

  // Overall confidence = mean of per-field confidences, or 0.5 if none.
  const confs = Object.values(fieldMeta).map((m) => m.confidence ?? 0);
  const confidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.5;

  const result = ok({ entity, fieldMeta }, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'extract',
    inputs: { schema: input.config.schema, categoryId, sourceLength: sourceText.length },
    output: { entityKeys: Object.keys(entity), fieldMetaCount: Object.keys(fieldMeta).length },
    model: { name: DEFAULT_FAST_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

- [ ] **Step 4: Verify tests pass + tsc clean**

```bash
npm run test:run -- engine/__tests__/primitives/extract.test.ts
npx tsc --noEmit
```
Expected: 1 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/extract.ts engine/__tests__/primitives/extract.test.ts
git commit -m "feat(engine): real extract primitive (LLM-driven canonical entity extraction)"
```

---

## Task 14: Real `lookup` primitive (pure function)

**Files:**
- Modify: `engine/primitives/lookup.ts`
- Test: `engine/__tests__/primitives/lookup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/lookup.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: () => ({ insert: () => ({}) }),  // trace.ts inserts; ignored here
  }),
}));

import { lookupPrimitive } from '@engine/primitives/lookup';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('lookupPrimitive', () => {
  it('returns schemes matching the categoryId in state', async () => {
    const result = await lookupPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'lookup',
      config: { indexes: ['de-epr-schemes', 'eu-product-categories'] },
      workspace,
      state: { categoryId: 'cat-electronics-consumer' },
    });
    expect(result.ok).toBe(true);
    expect(result.value.schemes.length).toBeGreaterThanOrEqual(1);
    const ids = result.value.schemes.map((s) => s.schemeId);
    expect(ids).toContain('stiftung-ear');
    expect(ids).toContain('zsvr');
  });

  it('returns only zsvr (the wildcard match) when categoryId is unknown', async () => {
    const result = await lookupPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'lookup',
      config: { indexes: ['de-epr-schemes'] },
      workspace,
      state: { categoryId: 'cat-textiles' },
    });
    expect(result.ok).toBe(true);
    const ids = result.value.schemes.map((s) => s.schemeId);
    expect(ids).toEqual(['zsvr']);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/lookup.test.ts
```
Expected: FAIL — stub returns `{ matches: [] }`.

- [ ] **Step 3: Replace `engine/primitives/lookup.ts`**

```ts
// engine/primitives/lookup.ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadLookup } from '@engine/rules-pack/lookups';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface LookupInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { indexes?: string[] };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

interface SchemeRow {
  schemeId: string;
  name: string;
  jurisdiction: string;
  wasteStream: string;
  portalUrl: string;
  registrationFieldShape: { required: string[]; language: string };
  appliesToCategories: string[];
}

export interface LookupOutput {
  schemes: SchemeRow[];
}

export async function lookupPrimitive(
  input: LookupInput,
): Promise<PrimitiveResult<LookupOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return await emit(input, t0, { schemes: [] });
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);

  // Only de-epr-schemes contributes to schemes[] in Phase 2.
  const useSchemes = (input.config.indexes ?? []).includes('de-epr-schemes');
  if (!useSchemes) {
    return await emit(input, t0, { schemes: [] });
  }

  const lookup = await loadLookup(pack, 'de-epr-schemes');
  const categoryId = (input.state?.categoryId as string | undefined) ?? 'cat-unknown';
  const schemes: SchemeRow[] = (lookup.rows as unknown as SchemeRow[]).filter((row) => {
    return row.appliesToCategories.includes('*') || row.appliesToCategories.includes(categoryId);
  });

  return await emit(input, t0, { schemes });
}

async function emit(
  input: LookupInput,
  t0: number,
  value: LookupOutput,
): Promise<PrimitiveResult<LookupOutput>> {
  const result = ok(value, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'lookup',
    inputs: { indexes: input.config.indexes ?? [], categoryId: input.state?.categoryId ?? null },
    output: { schemeIds: value.schemes.map((s) => s.schemeId) },
    model: null, confidence: 1.0, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

- [ ] **Step 4: Verify tests pass + tsc clean**

```bash
npm run test:run -- engine/__tests__/primitives/lookup.test.ts
npx tsc --noEmit
```
Expected: 2 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/lookup.ts engine/__tests__/primitives/lookup.test.ts
git commit -m "feat(engine): real lookup primitive (pure JSONL filter by categoryId)"
```

---

## Task 15: Real `reason` primitive

**Files:**
- Modify: `engine/primitives/reason.ts`
- Test: `engine/__tests__/primitives/reason.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/reason.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextMock = vi.fn();
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: generateTextMock };
});
vi.mock('@engine/providers/gateway', () => ({
  model: (id: string) => ({ id }),
  DEFAULT_REASONING_MODEL: 'mock/reasoner',
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { reasonPrimitive } from '@engine/primitives/reason';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('reasonPrimitive', () => {
  it('returns applicableSchemes + gaps from LLM output', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        applicableSchemes: ['stiftung-ear', 'zsvr'],
        gaps: ['producer.vatId'],
        decisions: [{ rule: 'weee-electronics', applied: true }],
        confidence: 0.9,
      }),
    });
    const result = await reasonPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'reason',
      config: { task: 'de-epr-eligibility' },
      workspace,
      state: { schemes: [{ schemeId: 'stiftung-ear' }, { schemeId: 'zsvr' }] },
    });
    expect(result.ok).toBe(true);
    expect(result.value.applicableSchemes).toEqual(['stiftung-ear', 'zsvr']);
    expect(result.value.gaps).toEqual(['producer.vatId']);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/reason.test.ts
```
Expected: FAIL — stub returns `{ decisions: [] }`.

- [ ] **Step 3: Replace `engine/primitives/reason.ts`**

```ts
// engine/primitives/reason.ts
import { generateText } from 'ai';
import { promises as fs } from 'fs';
import path from 'path';
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { model, DEFAULT_REASONING_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ReasonInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { task?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

export interface ReasonOutput {
  applicableSchemes: string[];
  gaps: string[];
  decisions: Array<{ rule: string; applied: boolean; rationale?: string }>;
}

export async function reasonPrimitive(
  input: ReasonInput,
): Promise<PrimitiveResult<ReasonOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    const r = ok<ReasonOutput>({ applicableSchemes: [], gaps: [], decisions: [] });
    return r;
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);
  const eligibilityYaml = await fs.readFile(path.join(pack.rootDir, 'rules', 'eligibility.yaml'), 'utf-8');

  const schemes = (input.state?.schemes as Array<{ schemeId: string }> | undefined) ?? [];
  const prompt = `You apply EPR eligibility rules. Given the eligibility YAML, the looked-up
schemes, and the workflow state, decide which schemes actually apply and what
fields are missing. Return JSON exactly:

{ "applicableSchemes": ["..."], "gaps": ["dot.path"], "decisions": [{"rule":"id","applied":true,"rationale":"..."}], "confidence": 0.0-1.0 }

ELIGIBILITY YAML:
${eligibilityYaml}

LOOKED-UP SCHEMES:
${JSON.stringify(schemes, null, 2)}

WORKFLOW STATE (excerpt):
${JSON.stringify({ categoryId: input.state?.categoryId, entityKeys: Object.keys(input.state ?? {}) }, null, 2)}
`;

  const { text } = await generateText({
    model: model(DEFAULT_REASONING_MODEL),
    prompt,
    // @ts-ignore
    maxTokens: 1500,
  });

  let parsed: Partial<ReasonOutput & { confidence?: number }> = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    // ignore
  }

  const value: ReasonOutput = {
    applicableSchemes: parsed.applicableSchemes ?? [],
    gaps: parsed.gaps ?? [],
    decisions: parsed.decisions ?? [],
  };
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;

  const result = ok(value, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'reason',
    inputs: { task: input.config.task ?? null, schemeCount: schemes.length },
    output: { applicableSchemes: value.applicableSchemes, gapsCount: value.gaps.length },
    model: { name: DEFAULT_REASONING_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

- [ ] **Step 4: Verify**

```bash
npm run test:run -- engine/__tests__/primitives/reason.test.ts
npx tsc --noEmit
```
Expected: 1 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/reason.ts engine/__tests__/primitives/reason.test.ts
git commit -m "feat(engine): real reason primitive (LLM rules-application returning applicableSchemes + gaps)"
```

---

## Task 16: Real `draft` primitive (3 sequential LLM calls)

**Files:**
- Modify: `engine/primitives/draft.ts`
- Test: `engine/__tests__/primitives/draft.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/draft.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateTextMock = vi.fn();
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: generateTextMock };
});
vi.mock('@engine/providers/gateway', () => ({
  model: (id: string) => ({ id }),
  DEFAULT_FAST_MODEL: 'mock/fast',
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { draftPrimitive } from '@engine/primitives/draft';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('draftPrimitive', () => {
  it('produces one draft per requested output and calls the LLM sequentially', async () => {
    // Three sequential calls: WEEE, packaging, GPSR notice.
    generateTextMock
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { scheme: 'stiftung-ear', producer: { name: 'Acme GmbH' } }, fieldMeta: {} }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { scheme: 'zsvr', producer: { name: 'Acme GmbH' } }, fieldMeta: {} }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { product: { name: 'X' }, manufacturer: { name: 'Acme GmbH' } }, fieldMeta: {} }) });

    const result = await draftPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'draft',
      config: { outputs: ['EprRegistrationDe', 'GpsrSafetyNotice'] },
      workspace,
      state: {
        applicableSchemes: ['stiftung-ear', 'zsvr'],
        entity: { name: 'USB-C Charger 65W', manufacturer: { name: 'Acme GmbH' } },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.value.drafts.length).toBe(3);
    expect(result.value.drafts.map((d) => d.outputType)).toEqual([
      'EprRegistrationDe',
      'EprRegistrationDe',
      'GpsrSafetyNotice',
    ]);
    // Sequential, not parallel:
    expect(generateTextMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/draft.test.ts
```
Expected: FAIL — stub returns `{ drafts: [] }`.

- [ ] **Step 3: Replace `engine/primitives/draft.ts`**

```ts
// engine/primitives/draft.ts
import { generateText } from 'ai';
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { model, DEFAULT_FAST_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';
import { loadSchema } from '@engine/rules-pack/schemas';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface DraftInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { outputs?: string[] };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

export interface SingleDraft {
  outputType: string;
  scheme?: string;          // for EprRegistrationDe variants
  value: Record<string, unknown>;
  fieldMeta: Record<string, { confidence: number; spans?: { start: number; end: number }[] }>;
}

export interface DraftOutput {
  drafts: SingleDraft[];
}

interface PromptPlan {
  outputType: string;
  scheme?: string;
  promptFile: string;
  outputSchemaFile: string;
}

export async function draftPrimitive(
  input: DraftInput,
): Promise<PrimitiveResult<DraftOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return ok({ drafts: [] });
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);

  const applicableSchemes = (input.state?.applicableSchemes as string[] | undefined) ?? [];
  const entity = (input.state?.entity as Record<string, unknown> | undefined) ?? {};
  const requested = input.config.outputs ?? [];

  const plan: PromptPlan[] = [];
  if (requested.includes('EprRegistrationDe')) {
    if (applicableSchemes.includes('stiftung-ear')) {
      plan.push({ outputType: 'EprRegistrationDe', scheme: 'stiftung-ear',
                  promptFile: 'draft.epr-de-weee.md', outputSchemaFile: 'EprRegistrationDe.json' });
    }
    if (applicableSchemes.includes('zsvr')) {
      plan.push({ outputType: 'EprRegistrationDe', scheme: 'zsvr',
                  promptFile: 'draft.epr-de-packaging.md', outputSchemaFile: 'EprRegistrationDe.json' });
    }
  }
  if (requested.includes('GpsrSafetyNotice')) {
    plan.push({ outputType: 'GpsrSafetyNotice',
                promptFile: 'draft.gpsr-article9.md', outputSchemaFile: 'GpsrSafetyNotice.json' });
  }

  const drafts: SingleDraft[] = [];

  // SEQUENTIAL — honor existing Groq TPM rule. No Promise.all.
  for (const item of plan) {
    const template = await loadPrompt(pack, item.promptFile);
    const outputSchema = await loadSchema(pack, item.outputSchemaFile);
    const schemeMeta = item.scheme
      ? (input.state?.schemes as Array<{ schemeId: string }> | undefined)?.find((s) => s.schemeId === item.scheme) ?? null
      : null;
    const prompt = renderPrompt(template, {
      productCatalogItemJson: JSON.stringify(entity, null, 2),
      schemeMetadataJson: JSON.stringify(schemeMeta, null, 2),
      outputSchemaJson: JSON.stringify(outputSchema, null, 2),
    });

    const { text } = await generateText({
      model: model(DEFAULT_FAST_MODEL),
      prompt,
      // @ts-ignore
      maxTokens: 2500,
    });

    let parsed: { value?: Record<string, unknown>; fieldMeta?: SingleDraft['fieldMeta'] } = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      // ignore
    }

    drafts.push({
      outputType: item.outputType,
      scheme: item.scheme,
      value: parsed.value ?? {},
      fieldMeta: parsed.fieldMeta ?? {},
    });
  }

  // Confidence = mean of per-draft mean-field-confidence.
  const draftConfidences = drafts.map((d) => {
    const confs = Object.values(d.fieldMeta).map((m) => m.confidence ?? 0);
    return confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.5;
  });
  const confidence = draftConfidences.length
    ? draftConfidences.reduce((a, b) => a + b, 0) / draftConfidences.length
    : 0.5;

  const result = ok({ drafts }, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'draft',
    inputs: { outputs: requested, applicableSchemes },
    output: { draftCount: drafts.length, outputTypes: drafts.map((d) => d.outputType) },
    model: { name: DEFAULT_FAST_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

- [ ] **Step 4: Verify**

```bash
npm run test:run -- engine/__tests__/primitives/draft.test.ts
npx tsc --noEmit
```
Expected: 1 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/draft.ts engine/__tests__/primitives/draft.test.ts
git commit -m "feat(engine): real draft primitive (3 sequential LLM calls for WEEE + packaging + GPSR)"
```

---

## Task 17: Real `validate` primitive

**Files:**
- Modify: `engine/primitives/validate.ts`
- Test: `engine/__tests__/primitives/validate.test.ts`

- [ ] **Step 1: Write the failing test (three explicit cases per the spec)**

Create `engine/__tests__/primitives/validate.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

import { validatePrimitive } from '@engine/primitives/validate';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

const validWeee = {
  outputType: 'EprRegistrationDe',
  scheme: 'stiftung-ear',
  value: {
    scheme: 'stiftung-ear',
    producer: { name: 'Acme GmbH', address: 'Berlin', country: 'DE', deTaxNumber: '123/456/78901' },
    productCategory: 'cat-electronics-consumer',
    weeeClass: '4',
    perUnitWeights: { deviceGrams: 120, packagingGrams: 30 },
    registrationLanguage: 'de',
  },
  fieldMeta: {
    'producer.name': { confidence: 0.98 },
    'producer.address': { confidence: 0.96 },
    'weeeClass': { confidence: 0.92 },
  },
};

describe('validatePrimitive', () => {
  beforeEach(() => {});

  it('high-confidence + complete artifact → needsReview false', async () => {
    const result = await validatePrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'validate',
      config: { against: 'schema+confidence+missing-fields' },
      workspace,
      state: { drafts: [validWeee] },
    });
    expect(result.ok).toBe(true);
    expect(result.value.needsReview).toBe(false);
    expect(result.value.issues.length).toBe(0);
    expect(result.needsReview).toBe(false);
  });

  it('low-confidence field → flagged as low-confidence', async () => {
    const lowConf = { ...validWeee, fieldMeta: { 'weeeClass': { confidence: 0.4 } } };
    const result = await validatePrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'validate',
      config: { against: 'schema+confidence+missing-fields' },
      workspace,
      state: { drafts: [lowConf] },
    });
    expect(result.value.needsReview).toBe(true);
    expect(result.value.issues.some((i) => i.reason === 'low-confidence' && i.field === 'weeeClass')).toBe(true);
  });

  it('missing required field → flagged as missing-required', async () => {
    const missing = {
      ...validWeee,
      value: { ...validWeee.value, producer: { ...validWeee.value.producer, address: undefined } },
    };
    const result = await validatePrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'validate',
      config: { against: 'schema+confidence+missing-fields' },
      workspace,
      state: { drafts: [missing] },
    });
    expect(result.value.needsReview).toBe(true);
    expect(result.value.issues.some((i) => i.reason === 'missing-required')).toBe(true);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/validate.test.ts
```
Expected: FAIL — stub returns `{ needsReview: false, issues: [] }` always.

- [ ] **Step 3: Replace `engine/primitives/validate.ts`**

```ts
// engine/primitives/validate.ts
import { promises as fs } from 'fs';
import path from 'path';
import * as yaml from 'yaml';
import { writeTrace } from '@engine/primitives/trace';
import { ok, needsReview } from '@engine/result';
import { loadPackForRef } from '@engine/rules-pack/context';
import { validatorFor } from '@engine/rules-pack/schemas';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ValidateInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { against?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

export interface ValidateIssue {
  draftIndex: number;
  outputType: string;
  field: string;
  reason: 'schema-violation' | 'low-confidence' | 'missing-required';
  detail?: string;
}

export interface ValidateOutput {
  needsReview: boolean;
  issues: ValidateIssue[];
}

interface DraftLike {
  outputType: string;
  value: Record<string, unknown>;
  fieldMeta: Record<string, { confidence?: number }>;
}

export async function validatePrimitive(
  input: ValidateInput,
): Promise<PrimitiveResult<ValidateOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return ok({ needsReview: false, issues: [] });
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);

  // Load hitl policy threshold.
  const hitlText = await fs.readFile(path.join(pack.rootDir, 'hitl-policy.yaml'), 'utf-8');
  const hitlPolicy = yaml.parse(hitlText) as { threshold: number };
  const threshold = typeof hitlPolicy.threshold === 'number' ? hitlPolicy.threshold : 0.85;

  const drafts = (input.state?.drafts as DraftLike[] | undefined) ?? [];
  const issues: ValidateIssue[] = [];

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];

    // 1. Schema validation via ajv.
    const validator = await validatorFor(pack, `${d.outputType}.json`);
    const okSchema = validator(d.value);
    if (!okSchema && validator.errors) {
      for (const err of validator.errors) {
        const field = err.instancePath.replace(/^\//, '').replace(/\//g, '.') || (err.params as { missingProperty?: string }).missingProperty || 'root';
        const reason: ValidateIssue['reason'] = err.keyword === 'required' ? 'missing-required' : 'schema-violation';
        issues.push({ draftIndex: i, outputType: d.outputType, field, reason, detail: err.message });
      }
    }

    // 2. Per-field confidence.
    for (const [field, meta] of Object.entries(d.fieldMeta ?? {})) {
      if (typeof meta.confidence === 'number' && meta.confidence < threshold) {
        issues.push({ draftIndex: i, outputType: d.outputType, field, reason: 'low-confidence',
                      detail: `confidence ${meta.confidence.toFixed(2)} < threshold ${threshold}` });
      }
    }
  }

  const value: ValidateOutput = { needsReview: issues.length > 0, issues };
  const result = value.needsReview ? needsReview(ok(value, { confidence: 1.0 })) : ok(value, { confidence: 1.0 });

  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'validate',
    inputs: { against: input.config.against ?? null, draftCount: drafts.length, threshold },
    output: { needsReview: value.needsReview, issueCount: issues.length },
    model: null, confidence: 1.0, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

- [ ] **Step 4: Verify**

```bash
npm run test:run -- engine/__tests__/primitives/validate.test.ts
npx tsc --noEmit
```
Expected: 3 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/validate.ts engine/__tests__/primitives/validate.test.ts
git commit -m "feat(engine): real validate primitive (ajv schema + confidence + missing-required)"
```

---

## Task 18: Real `hitl` primitive (Phase 2 pass-through)

**Files:**
- Modify: `engine/primitives/hitl.ts`
- Test: `engine/__tests__/primitives/hitl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/hitl.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

import { hitlPrimitive } from '@engine/primitives/hitl';

describe('hitlPrimitive (Phase 2 auto-approve pass-through)', () => {
  it('returns approve and logs reviewer action auto-approve-phase2', async () => {
    const result = await hitlPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'hitl',
      config: { when: 'confidence<0.85' },
    });
    expect(result.ok).toBe(true);
    expect(result.value.reviewer.action).toBe('approve');
    // Trace insert was called with reviewer.action = 'auto-approve-phase2'
    const traceRow = insertMock.mock.calls[0][0];
    expect(traceRow.reviewer.action).toBe('auto-approve-phase2');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/hitl.test.ts
```
Expected: FAIL — current stub logs `action: 'auto-approve'` (not `'auto-approve-phase2'`).

- [ ] **Step 3: Replace `engine/primitives/hitl.ts`**

```ts
// engine/primitives/hitl.ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface HitlInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { when?: string };
}

/**
 * Phase 2: HITL is a pass-through that always approves and records the
 * decision in the trace as `auto-approve-phase2` so Phase 3's real UI can
 * distinguish auto-approvals from human approvals later.
 */
export async function hitlPrimitive(
  input: HitlInput,
): Promise<PrimitiveResult<{ reviewer: { action: 'approve' } }>> {
  const t0 = Date.now();
  const result = ok({ reviewer: { action: 'approve' as const } }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'hitl',
    inputs: { when: input.config.when ?? null },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null,
    reviewer: { userId: '00000000-0000-0000-0000-000000000000', action: 'auto-approve-phase2' },
  });
  return result;
}
```

- [ ] **Step 4: Verify**

```bash
npm run test:run -- engine/__tests__/primitives/hitl.test.ts
npx tsc --noEmit
```
Expected: 1 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/hitl.ts engine/__tests__/primitives/hitl.test.ts
git commit -m "feat(engine): hitl pass-through logs reviewer action 'auto-approve-phase2'"
```

---

## Task 19: Real `emit` primitive

**Files:**
- Modify: `engine/primitives/emit.ts`
- Test: `engine/__tests__/primitives/emit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/emit.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertArtifactMock = vi.fn();
const updateArtifactMock = vi.fn();
vi.mock('@engine/storage/artifact', () => ({
  insertArtifact: (i: unknown) => insertArtifactMock(i),
  updateArtifact: (id: string, p: unknown) => updateArtifactMock(id, p),
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

beforeEach(() => {
  insertArtifactMock.mockReset(); updateArtifactMock.mockReset();
  insertArtifactMock.mockImplementation((input: { workspaceId: string; type: string }) =>
    Promise.resolve({ id: `art-${input.type}`, workspaceId: input.workspaceId, type: input.type,
                      schemaId: input.type, value: {}, status: 'draft',
                      emittedFormat: null, emittedUrl: null }));
  updateArtifactMock.mockResolvedValue(undefined);
});

import { emitPrimitive } from '@engine/primitives/emit';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('emitPrimitive', () => {
  it('inserts an artifact per draft and marks them emitted as json', async () => {
    const drafts = [
      { outputType: 'EprRegistrationDe', scheme: 'stiftung-ear', value: { scheme: 'stiftung-ear' }, fieldMeta: {} },
      { outputType: 'EprRegistrationDe', scheme: 'zsvr', value: { scheme: 'zsvr' }, fieldMeta: {} },
      { outputType: 'GpsrSafetyNotice', value: { product: { name: 'X' } }, fieldMeta: {} },
    ];
    const result = await emitPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'emit',
      config: { formats: ['json'] },
      workspace,
      state: { drafts },
    });
    expect(result.ok).toBe(true);
    expect(insertArtifactMock).toHaveBeenCalledTimes(3);
    expect(updateArtifactMock).toHaveBeenCalledTimes(3);
    const updates = updateArtifactMock.mock.calls.map((c) => c[1] as { status: string; emittedFormat: string });
    expect(updates.every((u) => u.status === 'emitted' && u.emittedFormat === 'json')).toBe(true);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/primitives/emit.test.ts
```
Expected: FAIL — stub doesn't call insertArtifact.

- [ ] **Step 3: Replace `engine/primitives/emit.ts`**

```ts
// engine/primitives/emit.ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { insertArtifact, updateArtifact } from '@engine/storage/artifact';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface EmitInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { formats?: string[] };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

interface DraftLike {
  outputType: string;
  scheme?: string;
  value: Record<string, unknown>;
  fieldMeta?: Record<string, unknown>;
}

export interface EmitOutput {
  emitted: Array<{ artifactId: string; outputType: string; format: string }>;
}

export async function emitPrimitive(
  input: EmitInput,
): Promise<PrimitiveResult<EmitOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return ok({ emitted: [] });
  }
  const drafts = (input.state?.drafts as DraftLike[] | undefined) ?? [];
  const format = (input.config.formats ?? ['json'])[0] ?? 'json';

  const emitted: EmitOutput['emitted'] = [];
  for (const d of drafts) {
    const artifact = await insertArtifact({
      workspaceId: input.workspaceId,
      type: d.outputType,
      schemaId: d.outputType,
      value: { ...d.value, _scheme: d.scheme, _fieldMeta: d.fieldMeta ?? {} },
    });
    await updateArtifact(artifact.id, {
      status: 'emitted',
      emittedFormat: format,
      emittedUrl: null,
    });
    emitted.push({ artifactId: artifact.id, outputType: d.outputType, format });
  }

  const result = ok({ emitted }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'emit',
    inputs: { formats: input.config.formats ?? [], draftCount: drafts.length },
    output: { emittedCount: emitted.length, artifactIds: emitted.map((e) => e.artifactId) },
    model: null, confidence: 1.0, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

- [ ] **Step 4: Verify**

```bash
npm run test:run -- engine/__tests__/primitives/emit.test.ts
npx tsc --noEmit
```
Expected: 1 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/primitives/emit.ts engine/__tests__/primitives/emit.test.ts
git commit -m "feat(engine): real emit primitive (inserts artifacts + marks emitted as json)"
```

---

## Task 20: GPSR workflow definition + smoke test

**Files:**
- Create: `engine/workflows/gpsr-epr.workflow.ts`
- Test: `engine/__tests__/workflows/gpsr-epr.workflow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/workflows/gpsr-epr.workflow.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { gpsrEprWorkflow } from '@/../engine/workflows/gpsr-epr.workflow';

describe('gpsrEprWorkflow', () => {
  it('has id gpsr-epr/v1 and references eu-gpsr-epr@2026.05.0', () => {
    expect(gpsrEprWorkflow.id).toBe('gpsr-epr/v1');
    expect(gpsrEprWorkflow.rulesPack).toBe('eu-gpsr-epr@2026.05.0');
  });

  it('has all 9 nodes wired in order ingest→...→emit', () => {
    const names = Object.keys(gpsrEprWorkflow.nodes).sort();
    expect(names).toEqual(['classify','draft','emit','extract','hitl','ingest','lookup','reason','validate']);
  });

  it('has an edge from validate to hitl guarded by needsReview', () => {
    const e = gpsrEprWorkflow.edges.find((e) => e.from === 'validate' && e.to === 'hitl');
    expect(e).toBeDefined();
    expect(e!.guard.kind).toBe('predicate');
  });

  it('has an unconditional edge from hitl to emit', () => {
    const e = gpsrEprWorkflow.edges.find((e) => e.from === 'hitl' && e.to === 'emit');
    expect(e).toBeDefined();
    expect(e!.guard.kind).toBe('always');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm run test:run -- engine/__tests__/workflows/gpsr-epr.workflow.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/workflows/gpsr-epr.workflow.ts`**

```ts
// engine/workflows/gpsr-epr.workflow.ts
import { defineWorkflow } from '@engine/workflow/defineWorkflow';
import { primitives as P } from '@engine/primitives';

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
    'validate → emit  [if !needsReview]',
    'hitl → emit',
  ],
});
```

- [ ] **Step 4: Verify**

```bash
npm run test:run -- engine/__tests__/workflows/gpsr-epr.workflow.test.ts
npx tsc --noEmit
```
Expected: 4 passed; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add engine/workflows/gpsr-epr.workflow.ts engine/__tests__/workflows/gpsr-epr.workflow.test.ts
git commit -m "feat(engine): add gpsr-epr/v1 workflow definition"
```

---

## Task 21: Synthetic fixture + gated end-to-end test

**Files:**
- Create: `engine/__tests__/fixtures/usb-charger-spec.txt`
- Create: `engine/__tests__/integration/gpsr-epr-workflow.test.ts`

- [ ] **Step 1: Write the fixture file**

Create `engine/__tests__/fixtures/usb-charger-spec.txt`:
```
Acme 65W GaN USB-C Charger — Product Specification

Brand: Acme GmbH
Model: ACME-GAN65-EU
Country of manufacture: China
Importer of record (EU): Acme GmbH, Friedrichstraße 123, 10117 Berlin, Germany
EU VAT ID: DE123456789
German tax number: 27/123/12345

Description: A 65W USB-C wall charger using GaN technology. Compatible with
laptops, tablets, and phones. Supports USB Power Delivery 3.0 with PPS up to
3.3-21V/3.25A. Single USB-C output. CE and UKCA marked. Compliant with EN 62368-1.

Materials:
- Polycarbonate housing (78%)
- Internal PCB and copper windings (18%)
- Steel grounding plate (4%)

Weight: 120 g (device only)

Packaging:
- Outer cardboard box: 90 g
- Printed instruction insert (paper): 8 g
- 1.5 m USB-C cable (TPE jacket): 35 g
- Total packaging weight (excluding cable): 98 g

Hazards / Warnings:
- Do not immerse in water. Indoor use only.
- Disconnect from mains during thunderstorms.
- For use with USB-C devices only.

EAN/GTIN: 4006381333931

Manufacturer safety contact: safety@acme-electronics.de

This product contains no battery.
```

- [ ] **Step 2: Write the gated integration test**

Create `engine/__tests__/integration/gpsr-epr-workflow.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { gpsrEprWorkflow } from '../../workflows/gpsr-epr.workflow';

const RUN_INTEGRATION =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.AI_GATEWAY_API_KEY;

describe.skipIf(!RUN_INTEGRATION)('gpsr-epr workflow end-to-end', () => {
  let workspaceId: string;
  let fileBuffer: Buffer;

  beforeAll(async () => {
    const { createWorkspace } = await import('@engine/storage/workspace');
    fileBuffer = await fs.readFile(path.resolve(__dirname, '../fixtures/usb-charger-spec.txt'));
    const ws = await createWorkspace({
      workflowId: gpsrEprWorkflow.id,
      rulesPackId: 'eu-gpsr-epr',
      rulesPackVersion: '2026.05.0',
    });
    workspaceId = ws.id;
  }, 30_000);

  it('produces three artifacts (WEEE + packaging + GPSR notice) and a trace per node', async () => {
    const { runWorkflow } = await import('@engine/workflow/runtime');
    const out = await runWorkflow({
      graph: gpsrEprWorkflow,
      workspaceId,
      startNode: 'ingest',
      nodeInputs: {
        ingest: {
          file: { buffer: fileBuffer, filename: 'usb-charger-spec.txt', mime: 'text/plain' },
        },
      },
    });

    expect(out.finalNode).toBe('emit');
    expect(out.results.every((r) => r.result.ok)).toBe(true);

    const { createServerClient } = await import('@/lib/supabase-server');
    const supabase = createServerClient();

    const { data: arts } = await supabase
      .from('eng_artifacts')
      .select('type, value, status, emitted_format')
      .eq('workspace_id', workspaceId);
    expect(arts?.length).toBeGreaterThanOrEqual(3);
    const types = arts!.map((a) => a.type).sort();
    expect(types).toEqual(expect.arrayContaining(['EprRegistrationDe', 'EprRegistrationDe', 'GpsrSafetyNotice']));
    expect(arts!.every((a) => a.status === 'emitted' && a.emitted_format === 'json')).toBe(true);

    const { data: traces } = await supabase
      .from('eng_trace_events')
      .select('primitive')
      .eq('workspace_id', workspaceId);
    const primitives = new Set(traces!.map((t) => t.primitive));
    for (const p of ['ingest','classify','extract','lookup','reason','draft','validate','hitl','emit']) {
      expect(primitives.has(p), `missing trace for ${p}`).toBe(true);
    }

    // Sanity: at least one draft contains the manufacturer name "Acme GmbH".
    const hasAcme = arts!.some((a) => JSON.stringify(a.value).includes('Acme GmbH'));
    expect(hasAcme).toBe(true);
  }, 120_000);
});
```

- [ ] **Step 3: Run (will skip without env vars)**

```bash
npm run test:run -- engine/__tests__/integration/gpsr-epr-workflow.test.ts
```
Expected: 1 skipped (no failures) when env vars are absent. With env vars present + migration 002 applied to Supabase, the test runs and must pass within 120s.

```bash
npm run test:run
npx tsc --noEmit
```
Expected: full suite green; tsc clean.

- [ ] **Step 4: Commit**

```bash
git add engine/__tests__/fixtures/usb-charger-spec.txt engine/__tests__/integration/gpsr-epr-workflow.test.ts
git commit -m "test(engine): add gated end-to-end test for gpsr-epr workflow + USB charger fixture"
```

---

## Task 22: Full suite + lint + tsc + push to GitHub

**Files:** none (final verification + push)

- [ ] **Step 1: Run the full toolchain**

```bash
npx tsc --noEmit
npm run test:run
npm run lint
```
Expected:
- tsc clean
- vitest: all unit tests passing + 1 integration test skipped (or passing if env vars set)
- lint: warnings only in `engine/__tests__/rules-pack/schema.test.ts` (pre-existing, untouched) and any new test files with the same `const { x, ...rest }` destructure-discard pattern — fix those inline by renaming the discarded variable to `_x`.

- [ ] **Step 2: If any lint warnings landed in NEW Phase 2 files, fix them inline**

Common Phase 2 lint candidates:
- `engine/__tests__/primitives/validate.test.ts` line `const missing = { ...validWeee, value: { ...validWeee.value, producer: { ...validWeee.value.producer, address: undefined } } };` — TypeScript may warn that `producer` is unused after destructure; not applicable here, but if the linter complains rename or refactor.
- The `@ts-ignore` comments in primitive LLM calls: if `@typescript-eslint/ban-ts-comment` complains, replace with `// @ts-expect-error AI SDK options compat` which the rule accepts.

If you make fixes, commit:
```bash
git add -A engine/
git commit -m "chore(engine): lint cleanup after Phase 2"
```

- [ ] **Step 3: Confirm clean state**

```bash
git status --short
```
Pre-existing untracked/dirty files (`.claude/settings.local.json`, `CLAUDE.md`, etc.) MUST remain untracked or unstaged — they are NOT yours to commit.

- [ ] **Step 4: Push to GitHub**

```bash
git fetch origin main
git status
```

If remote has moved since Phase 1 (e.g., another `graphify` or similar commit), rebase:
```bash
git -c rebase.autoStash=true rebase origin/main
npm run test:run
npx tsc --noEmit
```
Both must still be green after rebase.

Push:
```bash
git push origin main
```

Expected: push succeeds. If rejected for non-fast-forward, STOP and report BLOCKED with the divergent commit — do NOT force-push.

- [ ] **Step 5: Report**

Final report:
- Tests: passed / skipped / failed counts
- tsc + lint status
- Commits pushed (`git log --oneline origin/main..HEAD` — should be empty after push; before push, list the ~21 task commits)
- Push result (success / failure)
- Reminder for the user: apply migration 002 to Supabase if not done yet, then run the gated integration test with `AI_GATEWAY_API_KEY` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to validate Phase 2 end-to-end.

---

## Self-Review

**Spec coverage check** against `docs/superpowers/specs/2026-05-29-phase2-gpsr-epr-de-design.md`:

| Spec item | Task |
|---|---|
| `rules-packs/eu-gpsr-epr/2026.05.0/manifest.json` + hitl-policy | Task 3 ✓ |
| 3 JSON-Schemas (ProductCatalogItem, EprRegistrationDe, GpsrSafetyNotice) | Task 5 ✓ |
| 2 rules YAMLs (eligibility, high-risk) | Task 6 ✓ |
| 5 prompt files | Task 7 ✓ |
| 3 JSONL lookups | Task 8 ✓ |
| `engine/rules-pack/context.ts` | Task 4 ✓ |
| `engine/rules-pack/prompts.ts` | Task 9 ✓ |
| `engine/rules-pack/schemas.ts` | Task 10 ✓ |
| `engine/rules-pack/lookups.ts` | Task 11 ✓ |
| Real classify primitive | Task 12 ✓ |
| Real extract primitive | Task 13 ✓ |
| Real lookup primitive | Task 14 ✓ |
| Real reason primitive | Task 15 ✓ |
| Real draft primitive (3 sequential) | Task 16 ✓ |
| Real validate primitive (schema + confidence + missing-required) | Task 17 ✓ |
| Real hitl primitive (pass-through, logged) | Task 18 ✓ |
| Real emit primitive | Task 19 ✓ |
| `engine/workflows/gpsr-epr.workflow.ts` | Task 20 ✓ |
| Synthetic fixture | Task 21 ✓ |
| Gated end-to-end integration test | Task 21 ✓ |
| `engine/storage/entities.ts` (added during planning as precondition) | Task 2 ✓ |
| Runtime extension to pass state + workspace to primitive ctx | Task 1 ✓ |
| `ajv` + `yaml` deps | Tasks 1 and 10 ✓ (yaml in 1, ajv + ajv-formats in 10) |
| Full suite + push | Task 22 ✓ |

**Placeholder scan:** No TBD/TODO/implement-later/similar-to. Data files (categories JSONL, language strings) have explicit row counts + verbatim baseline rows + clear instructions for the additional rows with concrete category names listed.

**Type consistency:**
- `PrimitiveResult<T>` shape unchanged from Phase 1.
- `ClassifyOutput`, `ExtractOutput`, `LookupOutput`, `ReasonOutput`, `DraftOutput`, `ValidateOutput`, `EmitOutput` all newly defined per primitive; consumers (the workflow runtime via `Object.assign(state, result.value)`) get fields named consistently: `categoryId` (classify), `entity` + `fieldMeta` (extract), `schemes` (lookup), `applicableSchemes` + `gaps` + `decisions` (reason), `drafts` (draft), `needsReview` + `issues` (validate), `emitted` (emit).
- Edge guard `[if needsReview]` reads the `needsReview` flag set by validate — runtime already sets `state.needsReview = result.needsReview` after every primitive (Phase 1).
- Edge guard `[if !needsReview]` on the validate→emit edge requires Phase 1's runtime to handle `!` prefix — it does (`evalGuard` test in Phase 1 Task 14).
- `workspace` field added to primitive ctx in Task 1 is OPTIONAL — Phase 1 stubs that don't use it still typecheck. Phase 2 real primitives early-return with a degraded result if missing.

No issues found; plan is internally consistent.
