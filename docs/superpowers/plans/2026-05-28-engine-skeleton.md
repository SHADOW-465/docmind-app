# Engine Skeleton + Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the vertical-agnostic engine skeleton — typed data model, 10 primitive stubs, declarative workflow DSL + runtime, rules-pack loader, Supabase schema, and a no-op end-to-end integration test that runs `ingest → emit` and writes a `TraceEvent`. No real GPSR content, no HITL UI, no PDF rendering yet.

**Architecture:** New top-level `engine/` directory (sibling to `src/`) holding the engine kernel. Engine code stays framework-agnostic; Next.js consumes it via plain imports later. Storage layer wraps `createServerClient()` from `src/lib/supabase-server.ts`. Provider layer abstracts model calls behind Vercel AI Gateway so verticals can mix Groq + Claude + Mistral OCR through `"provider/model"` strings.

**Tech Stack:** TypeScript 5 (strict), Vitest 4 (existing config), Supabase Postgres, Next.js 16 (consumers only, not engine kernel), AI SDK v6 with `@ai-sdk/gateway`. Reuses existing `src/lib/extractor.ts` for ingest.

---

## File Structure

```
engine/                                  # NEW top-level kernel, framework-agnostic
├── types.ts                             # All first-class types in one file (small, central)
├── result.ts                            # PrimitiveResult envelope helper
├── providers/
│   └── gateway.ts                       # Vercel AI Gateway wrapper (model("provider/id"))
├── primitives/
│   ├── index.ts                         # Re-exports the `primitives` namespace
│   ├── ingest.ts                        # Wraps src/lib/extractor.ts → Source rows
│   ├── classify.ts                      # LLM classification stub
│   ├── extract.ts                       # Entity extraction stub
│   ├── lookup.ts                        # Rules/code lookup stub
│   ├── reason.ts                        # Rule application stub
│   ├── draft.ts                         # Artifact drafting stub
│   ├── validate.ts                      # Schema + rules validation stub
│   ├── hitl.ts                          # HITL gate (no-op pass-through in skeleton)
│   ├── emit.ts                          # Output rendering stub
│   └── trace.ts                         # TraceEvent writer (used by every primitive)
├── workflow/
│   ├── defineWorkflow.ts                # Public API: defineWorkflow({...})
│   ├── dsl.ts                           # Edge-string parser (e.g. "validate → hitl [if needsReview]")
│   └── runtime.ts                       # Executes a WorkflowGraph against a Workspace
├── rules-pack/
│   ├── schema.ts                        # Zod schemas for manifest, rules, lookups
│   ├── version.ts                       # Semver pinning + "<id>@<version>" parsing
│   └── loader.ts                        # Filesystem loader
└── storage/
    ├── workspace.ts                     # Workspace + Source CRUD (Supabase)
    ├── artifact.ts                      # Artifact CRUD (Supabase)
    └── trace.ts                         # Append-only TraceEvent writer (Supabase)

engine/__tests__/                        # Engine unit + integration tests
├── result.test.ts
├── workflow/dsl.test.ts
├── workflow/runtime.test.ts
├── rules-pack/version.test.ts
├── rules-pack/schema.test.ts
├── rules-pack/loader.test.ts
├── primitives/trace.test.ts
├── primitives/ingest.test.ts
└── integration/noop-workflow.test.ts    # End-to-end ingest→emit

engine/workflows/
└── noop.workflow.ts                     # The Phase-1 proof workflow (used by integration test)

rules-packs/                             # NEW top-level for rules packs
└── noop/1.0.0/
    ├── manifest.json
    ├── schemas/.gitkeep
    ├── rules/.gitkeep
    ├── lookups/.gitkeep
    └── templates/.gitkeep

supabase/migrations/
└── 002_engine_schema.sql                # New tables; legacy tables left intact for now

package.json                             # Add: zod, @ai-sdk/gateway
tsconfig.json                            # Add path alias "@engine/*" -> "engine/*"
vitest.config.ts                         # Add alias "@engine" + include engine/** in tests
```

**Decomposition rationale:**
- `engine/` is sibling-of-`src/`, not under it, to signal it's framework-agnostic and can be extracted to its own package later.
- Each primitive is its own file so primitives can be replaced/extended independently. They all share `engine/result.ts` and `engine/primitives/trace.ts`.
- Workflow `dsl.ts` and `runtime.ts` are split because the parser is pure/easy to unit-test while the runtime touches storage.
- Storage split by aggregate root (workspace, artifact, trace) — files that change together stay together.
- Legacy `documents` / `chat_messages` / `generated_outputs` tables are **left in place** for now. A future migration in a later phase will drop them after the legacy UI is retired. This avoids breaking the existing app mid-pivot.

---

## Task 1: Repo scaffolding — directories, deps, aliases

**Files:**
- Create: `engine/.gitkeep`, `engine/__tests__/.gitkeep`, `rules-packs/.gitkeep`
- Modify: `package.json` (add deps)
- Modify: `tsconfig.json` (add `@engine/*` alias and include engine)
- Modify: `vitest.config.ts` (add `@engine` alias)

- [ ] **Step 1: Create empty engine + rules-packs directories**

```bash
mkdir -p engine/__tests__ engine/primitives engine/workflow engine/rules-pack engine/storage engine/providers engine/workflows engine/__tests__/workflow engine/__tests__/rules-pack engine/__tests__/primitives engine/__tests__/integration
mkdir -p rules-packs
touch engine/.gitkeep rules-packs/.gitkeep
```

- [ ] **Step 2: Install runtime + dev deps**

Run:
```bash
npm install zod @ai-sdk/gateway
```

Expected: both packages added to `dependencies` in `package.json`.

- [ ] **Step 3: Add `@engine/*` path alias to `tsconfig.json`**

Modify `tsconfig.json` — under `compilerOptions.paths`, replace:
```json
"paths": {
  "@/*": ["./src/*"]
}
```
with:
```json
"paths": {
  "@/*": ["./src/*"],
  "@engine/*": ["./engine/*"]
}
```

Also under `include`, ensure `engine/**/*.ts` is covered. The existing `"**/*.ts"` glob already covers it, but add an explicit entry for clarity:
```json
"include": [
  "next-env.d.ts",
  "**/*.ts",
  "**/*.tsx",
  ".next/types/**/*.ts",
  ".next/dev/types/**/*.ts",
  "**/*.mts",
  "engine/**/*.ts"
]
```

- [ ] **Step 4: Add `@engine` alias to `vitest.config.ts`**

Modify `vitest.config.ts` — replace the `resolve.alias` block:
```ts
resolve: {
  alias: { '@': path.resolve(__dirname, './src') },
},
```
with:
```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@engine': path.resolve(__dirname, './engine'),
  },
},
```

- [ ] **Step 5: Verify TS + tests still pass**

Run:
```bash
npx tsc --noEmit
npm run test:run
```
Expected: tsc clean exit, vitest "passed (with no tests in new dirs)".

- [ ] **Step 6: Commit**

```bash
git add engine rules-packs package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "feat(engine): scaffold engine/ + rules-packs/ directories, add zod and @ai-sdk/gateway"
```

---

## Task 2: Core types (`engine/types.ts`)

**Files:**
- Create: `engine/types.ts`
- Test: none (pure type file — exercised by downstream tests)

- [ ] **Step 1: Write `engine/types.ts`**

```ts
// engine/types.ts
// All first-class engine types. Keep small and dependency-free.

export type UUID = string;
export type ISODate = string;

// ---------- Citations & provenance ----------

export interface SourceRef {
  sourceId: UUID;
  page?: number;
  bbox?: { x: number; y: number; w: number; h: number };
  charSpan?: { start: number; end: number };
}

export interface RuleRef {
  rulesPackId: string;          // e.g. "eu-gpsr-epr"
  rulesPackVersion: string;     // e.g. "2026.03.0"
  ruleId: string;               // pack-local id
}

export interface ModelRef {
  name: string;                 // provider/model, e.g. "groq/llama-3.3-70b-versatile"
  promptHash?: string;
  tokens?: { input: number; output: number };
}

export interface CitationAnchor {
  sources: SourceRef[];
  rules: RuleRef[];
  confidence: number;           // 0..1, calibrated
  model?: ModelRef;
}

// ---------- First-class aggregates ----------

export type WorkspaceStatus = 'open' | 'awaiting_review' | 'emitted' | 'archived';

export interface Workspace {
  id: UUID;
  orgId: UUID;
  ownerId: UUID | null;
  workflowId: string;           // e.g. "gpsr-epr/v1"
  rulesPackId: string;
  rulesPackVersion: string;
  status: WorkspaceStatus;
  createdAt: ISODate;
}

export interface Source {
  id: UUID;
  workspaceId: UUID;
  filename: string;
  mime: string;
  storageUrl: string | null;    // null if held only in typedRep (local fallback)
  typedRep: TypedRep;
  isLarge: boolean;
}

export interface TypedRep {
  // Output shape of Primitive 1 (Ingest). Keep stable; verticals depend on it.
  text: string;
  pageCount: number;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'image' | 'txt';
  language?: string;            // ISO-639-1, detected (optional in skeleton)
  structureHints?: Record<string, unknown>;
}

export interface CanonicalEntity {
  id: UUID;
  workspaceId: UUID;
  type: string;                 // pack-defined (e.g. "ProductCatalogItem")
  value: Record<string, unknown>;
  citations: CitationAnchor[];
}

export interface WorkflowRun {
  id: UUID;
  workspaceId: UUID;
  graphId: string;
  currentNode: string | null;   // null when not started / complete
  state: Record<string, unknown>;
  updatedAt: ISODate;
}

export type ArtifactStatus = 'draft' | 'awaiting_review' | 'approved' | 'emitted';

export interface Artifact {
  id: UUID;
  workspaceId: UUID;
  type: string;                 // pack-defined schema id
  schemaId: string;
  value: Record<string, unknown>;
  status: ArtifactStatus;
  emittedFormat: string | null;
  emittedUrl: string | null;
}

// ---------- Trace ----------

export type PrimitiveName =
  | 'ingest' | 'classify' | 'extract' | 'lookup' | 'reason'
  | 'draft'  | 'validate' | 'hitl'    | 'emit'   | 'trace';

export interface TraceEvent {
  id: UUID;
  workspaceId: UUID;
  workflowRunId: UUID | null;
  nodeId: string | null;
  primitive: PrimitiveName;
  inputs: Record<string, unknown>;
  output: Record<string, unknown> | { error: string };
  model: ModelRef | null;
  confidence: number | null;
  latencyMs: number;
  costUsd: number | null;
  reviewer: { userId: UUID; action: string; editDiff?: unknown } | null;
  createdAt: ISODate;
}

// ---------- Rules pack ----------

export interface RulesPackManifest {
  id: string;                   // "eu-gpsr-epr"
  version: string;              // semver "2026.03.0"
  displayName: string;
  locales: string[];            // ["de", "fr", "it", ...]
  schemas: string[];            // file paths inside the pack
  rules: string[];
  lookups: string[];
  templates: string[];
  hitlPolicy: string;           // file path
}

export interface RulesPack {
  manifest: RulesPackManifest;
  rootDir: string;              // absolute path on disk
}

// ---------- Workflow graph ----------

export type EdgeGuard =
  | { kind: 'always' }
  | { kind: 'predicate'; expr: string };  // raw expression string, evaluated by runtime

export interface WorkflowEdge {
  from: string;
  to: string;
  guard: EdgeGuard;
  maxLoops?: number;
}

export type PrimitiveNodeDef = {
  primitive: PrimitiveName;
  config: Record<string, unknown>;
};

export interface WorkflowGraph {
  id: string;
  rulesPack: string;            // "<id>@<version>"
  nodes: Record<string, PrimitiveNodeDef>;
  edges: WorkflowEdge[];
}

// ---------- Primitive result envelope ----------

export interface PrimitiveResult<T = unknown> {
  ok: boolean;
  value: T;
  confidence: number;           // 0..1
  citations: CitationAnchor[];
  needsReview: boolean;
  error?: { code: string; message: string };
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add engine/types.ts
git commit -m "feat(engine): add core types (Workspace, RulesPack, WorkflowGraph, TraceEvent, CitationAnchor, PrimitiveResult)"
```

---

## Task 3: Result envelope helpers (`engine/result.ts`)

**Files:**
- Create: `engine/result.ts`
- Test: `engine/__tests__/result.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/result.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ok, fail, needsReview } from '@engine/result';

describe('result helpers', () => {
  it('ok() returns ok=true with value and confidence', () => {
    const r = ok({ foo: 'bar' }, { confidence: 0.92 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ foo: 'bar' });
    expect(r.confidence).toBe(0.92);
    expect(r.needsReview).toBe(false);
    expect(r.citations).toEqual([]);
  });

  it('ok() defaults confidence to 1.0 and citations to []', () => {
    const r = ok('anything');
    expect(r.confidence).toBe(1.0);
    expect(r.citations).toEqual([]);
  });

  it('fail() returns ok=false with error and confidence 0', () => {
    const r = fail('E_TEST', 'broken');
    expect(r.ok).toBe(false);
    expect(r.error).toEqual({ code: 'E_TEST', message: 'broken' });
    expect(r.confidence).toBe(0);
  });

  it('needsReview() flips needsReview flag', () => {
    const r = needsReview(ok({}, { confidence: 0.5 }));
    expect(r.needsReview).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- engine/__tests__/result.test.ts`
Expected: FAIL — `Cannot find module '@engine/result'`.

- [ ] **Step 3: Implement `engine/result.ts`**

```ts
// engine/result.ts
import type { PrimitiveResult, CitationAnchor } from '@engine/types';

export function ok<T>(
  value: T,
  opts: { confidence?: number; citations?: CitationAnchor[] } = {},
): PrimitiveResult<T> {
  return {
    ok: true,
    value,
    confidence: opts.confidence ?? 1.0,
    citations: opts.citations ?? [],
    needsReview: false,
  };
}

export function fail(code: string, message: string): PrimitiveResult<null> {
  return {
    ok: false,
    value: null,
    confidence: 0,
    citations: [],
    needsReview: false,
    error: { code, message },
  };
}

export function needsReview<T>(r: PrimitiveResult<T>): PrimitiveResult<T> {
  return { ...r, needsReview: true };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm run test:run -- engine/__tests__/result.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add engine/result.ts engine/__tests__/result.test.ts
git commit -m "feat(engine): add PrimitiveResult helpers (ok, fail, needsReview)"
```

---

## Task 4: Supabase migration (`002_engine_schema.sql`)

**Files:**
- Create: `supabase/migrations/002_engine_schema.sql`
- Modify: `supabase_schema.sql` (root convenience copy — append the same DDL so contributors can re-bootstrap)

- [ ] **Step 1: Write `supabase/migrations/002_engine_schema.sql`**

```sql
-- Engine schema (Phase 1). Legacy tables from 001 remain in place; a later
-- migration will retire them once the legacy UI is removed.

-- ---------- Multi-tenant scaffolding ----------

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- Seed a default org so single-tenant local dev works without auth UI.
insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Org')
on conflict (id) do nothing;

create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null,
  role        text not null default 'member' check (role in ('owner','admin','member','reviewer')),
  created_at  timestamptz default now(),
  unique (org_id, user_id)
);

-- ---------- Rules packs (registry of installed packs) ----------

create table if not exists rules_packs (
  id              text not null,
  version         text not null,
  manifest        jsonb not null,
  storage_prefix  text not null,
  installed_at    timestamptz default now(),
  primary key (id, version)
);

-- ---------- Workspaces ----------

create table if not exists eng_workspaces (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id) on delete cascade,
  owner_id              uuid,
  workflow_id           text not null,
  rules_pack_id         text not null,
  rules_pack_version    text not null,
  status                text not null default 'open'
                          check (status in ('open','awaiting_review','emitted','archived')),
  created_at            timestamptz default now()
);
create index if not exists eng_workspaces_org_idx on eng_workspaces(org_id);

-- ---------- Sources (uploaded docs per workspace) ----------

create table if not exists eng_sources (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references eng_workspaces(id) on delete cascade,
  filename      text not null,
  mime          text not null,
  storage_url   text,
  typed_rep     jsonb not null,
  is_large      boolean not null default false,
  created_at    timestamptz default now()
);
create index if not exists eng_sources_workspace_idx on eng_sources(workspace_id);

-- ---------- Canonical entities ----------

create table if not exists eng_canonical_entities (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references eng_workspaces(id) on delete cascade,
  type              text not null,
  value             jsonb not null,
  citations         jsonb not null default '[]',
  created_at        timestamptz default now()
);
create index if not exists eng_entities_workspace_idx on eng_canonical_entities(workspace_id);

-- ---------- Workflow runs ----------

create table if not exists eng_workflow_runs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references eng_workspaces(id) on delete cascade,
  graph_id        text not null,
  current_node    text,
  state           jsonb not null default '{}',
  updated_at      timestamptz default now()
);
create index if not exists eng_runs_workspace_idx on eng_workflow_runs(workspace_id);

-- ---------- Artifacts ----------

create table if not exists eng_artifacts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references eng_workspaces(id) on delete cascade,
  type              text not null,
  schema_id         text not null,
  value             jsonb not null,
  status            text not null default 'draft'
                      check (status in ('draft','awaiting_review','approved','emitted')),
  emitted_format    text,
  emitted_url       text,
  created_at        timestamptz default now()
);
create index if not exists eng_artifacts_workspace_idx on eng_artifacts(workspace_id);

-- ---------- Trace events (append-only) ----------
-- Declarative partitioning by workspace_id hash; 8 partitions is enough for now.

create table if not exists eng_trace_events (
  id                uuid not null default gen_random_uuid(),
  workspace_id      uuid not null,
  workflow_run_id   uuid,
  node_id           text,
  primitive         text not null,
  inputs            jsonb not null default '{}',
  output            jsonb not null default '{}',
  model             jsonb,
  confidence        numeric,
  latency_ms        integer not null default 0,
  cost_usd          numeric,
  reviewer          jsonb,
  created_at        timestamptz not null default now(),
  primary key (id, workspace_id)
) partition by hash (workspace_id);

do $$
begin
  for i in 0..7 loop
    execute format(
      'create table if not exists eng_trace_events_p%1$s partition of eng_trace_events for values with (modulus 8, remainder %1$s)',
      i
    );
  end loop;
end$$;

create index if not exists eng_trace_workspace_idx on eng_trace_events(workspace_id, created_at desc);
```

- [ ] **Step 2: Append the same DDL to `supabase_schema.sql`**

Open `supabase_schema.sql`, append a blank line then the entire contents of `supabase/migrations/002_engine_schema.sql` so the convenience bootstrap file stays in sync.

- [ ] **Step 3: Apply the migration to your local/dev Supabase**

If you have the Supabase CLI configured:
```bash
supabase db push
```
Otherwise paste the SQL into the Supabase SQL editor for your dev project.

- [ ] **Step 4: Smoke-check tables exist**

Run a quick query in the SQL editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'eng_%';
```
Expected: 6 rows (`eng_workspaces`, `eng_sources`, `eng_canonical_entities`, `eng_workflow_runs`, `eng_artifacts`, `eng_trace_events`) plus 8 partitions `eng_trace_events_p0..p7`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/002_engine_schema.sql supabase_schema.sql
git commit -m "feat(db): add engine schema migration (workspaces, sources, entities, runs, artifacts, trace events)"
```

---

## Task 5: Trace storage + writer (`engine/storage/trace.ts`, `engine/primitives/trace.ts`)

**Files:**
- Create: `engine/storage/trace.ts`
- Create: `engine/primitives/trace.ts`
- Test: `engine/__tests__/primitives/trace.test.ts`

- [ ] **Step 1: Write the failing test**

Create `engine/__tests__/primitives/trace.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeTrace } from '@engine/primitives/trace';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  insertMock.mockClear();
  fromMock.mockClear();
});

describe('writeTrace', () => {
  it('inserts into eng_trace_events with snake_case columns', async () => {
    await writeTrace({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'classify',
      primitive: 'classify',
      inputs: { foo: 1 },
      output: { bar: 2 },
      model: { name: 'groq/llama-3.3-70b-versatile' },
      confidence: 0.9,
      latencyMs: 42,
      costUsd: 0.001,
      reviewer: null,
    });

    expect(fromMock).toHaveBeenCalledWith('eng_trace_events');
    const row = insertMock.mock.calls[0][0];
    expect(row.workspace_id).toBe('ws-1');
    expect(row.workflow_run_id).toBe('run-1');
    expect(row.node_id).toBe('classify');
    expect(row.primitive).toBe('classify');
    expect(row.latency_ms).toBe(42);
    expect(row.cost_usd).toBe(0.001);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- engine/__tests__/primitives/trace.test.ts`
Expected: FAIL — `Cannot find module '@engine/primitives/trace'`.

- [ ] **Step 3: Implement `engine/storage/trace.ts`**

```ts
// engine/storage/trace.ts
import { createServerClient } from '@/lib/supabase-server';
import type { TraceEvent } from '@engine/types';

export type NewTraceEvent = Omit<TraceEvent, 'id' | 'createdAt'>;

export async function insertTraceEvent(event: NewTraceEvent): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('eng_trace_events').insert({
    workspace_id: event.workspaceId,
    workflow_run_id: event.workflowRunId,
    node_id: event.nodeId,
    primitive: event.primitive,
    inputs: event.inputs,
    output: event.output,
    model: event.model,
    confidence: event.confidence,
    latency_ms: event.latencyMs,
    cost_usd: event.costUsd,
    reviewer: event.reviewer,
  });
  if (error) {
    // Trace writes must never crash the workflow. Log and continue.
    console.error('[trace] insert failed:', error.message);
  }
}
```

- [ ] **Step 4: Implement `engine/primitives/trace.ts`**

```ts
// engine/primitives/trace.ts
import { insertTraceEvent, type NewTraceEvent } from '@engine/storage/trace';

/**
 * The trace "primitive" is special: it doesn't appear in WorkflowGraph nodes.
 * It is the sink called by every other primitive (and by the runtime) to
 * record what happened. Kept in primitives/ for proximity to its callers.
 */
export async function writeTrace(event: NewTraceEvent): Promise<void> {
  await insertTraceEvent(event);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run test:run -- engine/__tests__/primitives/trace.test.ts`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add engine/storage/trace.ts engine/primitives/trace.ts engine/__tests__/primitives/trace.test.ts
git commit -m "feat(engine): add trace writer (storage + primitive sink)"
```

---

## Task 6: Workspace storage (`engine/storage/workspace.ts`)

**Files:**
- Create: `engine/storage/workspace.ts`
- Test: deferred — covered by the integration test in Task 13. Pure CRUD is low-value to unit test against a mocked Supabase client.

- [ ] **Step 1: Implement `engine/storage/workspace.ts`**

```ts
// engine/storage/workspace.ts
import { createServerClient } from '@/lib/supabase-server';
import type { Workspace, Source, WorkspaceStatus, TypedRep } from '@engine/types';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export async function createWorkspace(input: {
  workflowId: string;
  rulesPackId: string;
  rulesPackVersion: string;
  orgId?: string;
  ownerId?: string | null;
}): Promise<Workspace> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_workspaces')
    .insert({
      org_id: input.orgId ?? DEFAULT_ORG_ID,
      owner_id: input.ownerId ?? null,
      workflow_id: input.workflowId,
      rules_pack_id: input.rulesPackId,
      rules_pack_version: input.rulesPackVersion,
      status: 'open' satisfies WorkspaceStatus,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createWorkspace failed: ${error?.message}`);
  return rowToWorkspace(data);
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_workspaces')
    .select()
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getWorkspace failed: ${error.message}`);
  return data ? rowToWorkspace(data) : null;
}

export async function updateWorkspaceStatus(id: string, status: WorkspaceStatus): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('eng_workspaces').update({ status }).eq('id', id);
  if (error) throw new Error(`updateWorkspaceStatus failed: ${error.message}`);
}

export async function insertSource(input: {
  workspaceId: string;
  filename: string;
  mime: string;
  storageUrl: string | null;
  typedRep: TypedRep;
  isLarge: boolean;
}): Promise<Source> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_sources')
    .insert({
      workspace_id: input.workspaceId,
      filename: input.filename,
      mime: input.mime,
      storage_url: input.storageUrl,
      typed_rep: input.typedRep,
      is_large: input.isLarge,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`insertSource failed: ${error?.message}`);
  return rowToSource(data);
}

export async function listSources(workspaceId: string): Promise<Source[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_sources')
    .select()
    .eq('workspace_id', workspaceId);
  if (error) throw new Error(`listSources failed: ${error.message}`);
  return (data ?? []).map(rowToSource);
}

// ---------- row -> domain mappers ----------

type WorkspaceRow = {
  id: string; org_id: string; owner_id: string | null;
  workflow_id: string; rules_pack_id: string; rules_pack_version: string;
  status: WorkspaceStatus; created_at: string;
};

function rowToWorkspace(r: WorkspaceRow): Workspace {
  return {
    id: r.id, orgId: r.org_id, ownerId: r.owner_id,
    workflowId: r.workflow_id, rulesPackId: r.rules_pack_id, rulesPackVersion: r.rules_pack_version,
    status: r.status, createdAt: r.created_at,
  };
}

type SourceRow = {
  id: string; workspace_id: string; filename: string; mime: string;
  storage_url: string | null; typed_rep: TypedRep; is_large: boolean;
};

function rowToSource(r: SourceRow): Source {
  return {
    id: r.id, workspaceId: r.workspace_id, filename: r.filename, mime: r.mime,
    storageUrl: r.storage_url, typedRep: r.typed_rep, isLarge: r.is_large,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add engine/storage/workspace.ts
git commit -m "feat(engine): add workspace + source storage layer"
```

---

## Task 7: Artifact storage (`engine/storage/artifact.ts`)

**Files:**
- Create: `engine/storage/artifact.ts`

- [ ] **Step 1: Implement `engine/storage/artifact.ts`**

```ts
// engine/storage/artifact.ts
import { createServerClient } from '@/lib/supabase-server';
import type { Artifact, ArtifactStatus } from '@engine/types';

export async function insertArtifact(input: {
  workspaceId: string;
  type: string;
  schemaId: string;
  value: Record<string, unknown>;
}): Promise<Artifact> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_artifacts')
    .insert({
      workspace_id: input.workspaceId,
      type: input.type,
      schema_id: input.schemaId,
      value: input.value,
      status: 'draft' satisfies ArtifactStatus,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`insertArtifact failed: ${error?.message}`);
  return rowToArtifact(data);
}

export async function updateArtifact(
  id: string,
  patch: Partial<Pick<Artifact, 'value' | 'status' | 'emittedFormat' | 'emittedUrl'>>,
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('eng_artifacts')
    .update({
      ...(patch.value !== undefined && { value: patch.value }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.emittedFormat !== undefined && { emitted_format: patch.emittedFormat }),
      ...(patch.emittedUrl !== undefined && { emitted_url: patch.emittedUrl }),
    })
    .eq('id', id);
  if (error) throw new Error(`updateArtifact failed: ${error.message}`);
}

export async function listArtifacts(workspaceId: string): Promise<Artifact[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eng_artifacts').select().eq('workspace_id', workspaceId);
  if (error) throw new Error(`listArtifacts failed: ${error.message}`);
  return (data ?? []).map(rowToArtifact);
}

type ArtifactRow = {
  id: string; workspace_id: string; type: string; schema_id: string;
  value: Record<string, unknown>; status: ArtifactStatus;
  emitted_format: string | null; emitted_url: string | null;
};

function rowToArtifact(r: ArtifactRow): Artifact {
  return {
    id: r.id, workspaceId: r.workspace_id, type: r.type, schemaId: r.schema_id,
    value: r.value, status: r.status,
    emittedFormat: r.emitted_format, emittedUrl: r.emitted_url,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add engine/storage/artifact.ts
git commit -m "feat(engine): add artifact storage layer"
```

---

## Task 8: Rules-pack version parsing (`engine/rules-pack/version.ts`)

**Files:**
- Create: `engine/rules-pack/version.ts`
- Test: `engine/__tests__/rules-pack/version.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// engine/__tests__/rules-pack/version.test.ts
import { describe, it, expect } from 'vitest';
import { parsePackRef, formatPackRef, satisfies } from '@engine/rules-pack/version';

describe('parsePackRef', () => {
  it('parses "id@version" into parts', () => {
    expect(parsePackRef('eu-gpsr-epr@2026.03.0')).toEqual({
      id: 'eu-gpsr-epr', version: '2026.03.0',
    });
  });

  it('throws on missing @', () => {
    expect(() => parsePackRef('eu-gpsr-epr')).toThrow(/expected "id@version"/);
  });

  it('throws on empty id or version', () => {
    expect(() => parsePackRef('@1.0.0')).toThrow();
    expect(() => parsePackRef('foo@')).toThrow();
  });
});

describe('formatPackRef', () => {
  it('round-trips', () => {
    expect(formatPackRef('foo', '1.2.3')).toBe('foo@1.2.3');
  });
});

describe('satisfies', () => {
  it('returns true for exact match', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
  });
  it('returns false for any mismatch (skeleton supports only exact pinning)', () => {
    expect(satisfies('1.2.3', '1.2.4')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- engine/__tests__/rules-pack/version.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/rules-pack/version.ts`**

```ts
// engine/rules-pack/version.ts

export interface PackRef {
  id: string;
  version: string;
}

const REF_RE = /^([a-z0-9][a-z0-9-]*)@(\d+\.\d+\.\d+)$/;

export function parsePackRef(ref: string): PackRef {
  const m = REF_RE.exec(ref);
  if (!m) throw new Error(`Invalid pack ref "${ref}": expected "id@version" (semver)`);
  return { id: m[1], version: m[2] };
}

export function formatPackRef(id: string, version: string): string {
  return `${id}@${version}`;
}

/**
 * Skeleton-only: strict equality. A later phase can swap in a real semver range check.
 */
export function satisfies(actual: string, required: string): boolean {
  return actual === required;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:run -- engine/__tests__/rules-pack/version.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add engine/rules-pack/version.ts engine/__tests__/rules-pack/version.test.ts
git commit -m "feat(engine): add rules-pack version parser (id@version, strict-pin satisfies)"
```

---

## Task 9: Rules-pack manifest schema (`engine/rules-pack/schema.ts`)

**Files:**
- Create: `engine/rules-pack/schema.ts`
- Test: `engine/__tests__/rules-pack/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// engine/__tests__/rules-pack/schema.test.ts
import { describe, it, expect } from 'vitest';
import { manifestSchema, parseManifest } from '@engine/rules-pack/schema';

const valid = {
  id: 'noop',
  version: '1.0.0',
  displayName: 'No-op pack',
  locales: ['en'],
  schemas: [],
  rules: [],
  lookups: [],
  templates: [],
  hitlPolicy: 'hitl-policy.yaml',
};

describe('manifestSchema', () => {
  it('accepts a valid manifest', () => {
    expect(() => manifestSchema.parse(valid)).not.toThrow();
  });

  it('rejects missing id', () => {
    const { id, ...bad } = valid;
    expect(() => manifestSchema.parse(bad)).toThrow();
  });

  it('rejects non-semver version', () => {
    expect(() => manifestSchema.parse({ ...valid, version: 'banana' })).toThrow();
  });

  it('parseManifest returns typed object', () => {
    const m = parseManifest(valid);
    expect(m.id).toBe('noop');
    expect(m.version).toBe('1.0.0');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- engine/__tests__/rules-pack/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/rules-pack/schema.ts`**

```ts
// engine/rules-pack/schema.ts
import { z } from 'zod';
import type { RulesPackManifest } from '@engine/types';

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be kebab-case'),
  version: z.string().regex(SEMVER_RE, 'version must be semver MAJOR.MINOR.PATCH'),
  displayName: z.string().min(1),
  locales: z.array(z.string().regex(/^[a-z]{2}$/)).min(1),
  schemas: z.array(z.string()),
  rules: z.array(z.string()),
  lookups: z.array(z.string()),
  templates: z.array(z.string()),
  hitlPolicy: z.string().min(1),
}) satisfies z.ZodType<RulesPackManifest>;

export function parseManifest(input: unknown): RulesPackManifest {
  return manifestSchema.parse(input);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:run -- engine/__tests__/rules-pack/schema.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add engine/rules-pack/schema.ts engine/__tests__/rules-pack/schema.test.ts
git commit -m "feat(engine): add rules-pack manifest zod schema + parser"
```

---

## Task 10: Rules-pack loader (`engine/rules-pack/loader.ts`) + noop pack fixture

**Files:**
- Create: `engine/rules-pack/loader.ts`
- Create: `rules-packs/noop/1.0.0/manifest.json`
- Create: `rules-packs/noop/1.0.0/{schemas,rules,lookups,templates}/.gitkeep`
- Create: `rules-packs/noop/1.0.0/hitl-policy.yaml`
- Test: `engine/__tests__/rules-pack/loader.test.ts`

- [ ] **Step 1: Create the noop rules pack fixture**

```bash
mkdir -p rules-packs/noop/1.0.0/schemas rules-packs/noop/1.0.0/rules rules-packs/noop/1.0.0/lookups rules-packs/noop/1.0.0/templates
touch rules-packs/noop/1.0.0/schemas/.gitkeep rules-packs/noop/1.0.0/rules/.gitkeep rules-packs/noop/1.0.0/lookups/.gitkeep rules-packs/noop/1.0.0/templates/.gitkeep
```

Create `rules-packs/noop/1.0.0/manifest.json`:
```json
{
  "id": "noop",
  "version": "1.0.0",
  "displayName": "No-op Pack",
  "locales": ["en"],
  "schemas": [],
  "rules": [],
  "lookups": [],
  "templates": [],
  "hitlPolicy": "hitl-policy.yaml"
}
```

Create `rules-packs/noop/1.0.0/hitl-policy.yaml`:
```yaml
# Phase-1 skeleton: no HITL gates.
gates: []
```

- [ ] **Step 2: Write the failing test**

```ts
// engine/__tests__/rules-pack/loader.test.ts
import { describe, it, expect } from 'vitest';
import path from 'path';
import { loadRulesPack } from '@engine/rules-pack/loader';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

describe('loadRulesPack', () => {
  it('loads the noop pack from disk', async () => {
    const pack = await loadRulesPack('noop', '1.0.0', PACKS_DIR);
    expect(pack.manifest.id).toBe('noop');
    expect(pack.manifest.version).toBe('1.0.0');
    expect(pack.rootDir.endsWith(path.join('rules-packs', 'noop', '1.0.0'))).toBe(true);
  });

  it('throws when manifest is missing', async () => {
    await expect(loadRulesPack('does-not-exist', '1.0.0', PACKS_DIR))
      .rejects.toThrow(/manifest/i);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:run -- engine/__tests__/rules-pack/loader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `engine/rules-pack/loader.ts`**

```ts
// engine/rules-pack/loader.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { RulesPack } from '@engine/types';
import { parseManifest } from '@engine/rules-pack/schema';

export async function loadRulesPack(
  id: string,
  version: string,
  packsDir: string,
): Promise<RulesPack> {
  const rootDir = path.join(packsDir, id, version);
  const manifestPath = path.join(rootDir, 'manifest.json');
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    throw new Error(`Rules pack manifest not found at ${manifestPath}: ${(err as Error).message}`);
  }
  const json: unknown = JSON.parse(raw);
  const manifest = parseManifest(json);
  if (manifest.id !== id || manifest.version !== version) {
    throw new Error(
      `Manifest mismatch: directory says ${id}@${version}, manifest says ${manifest.id}@${manifest.version}`,
    );
  }
  return { manifest, rootDir };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm run test:run -- engine/__tests__/rules-pack/loader.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add engine/rules-pack/loader.ts rules-packs/noop
git commit -m "feat(engine): add rules-pack filesystem loader + noop pack fixture"
```

---

## Task 11: Workflow DSL edge parser (`engine/workflow/dsl.ts`)

**Files:**
- Create: `engine/workflow/dsl.ts`
- Test: `engine/__tests__/workflow/dsl.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// engine/__tests__/workflow/dsl.test.ts
import { describe, it, expect } from 'vitest';
import { parseEdges } from '@engine/workflow/dsl';

describe('parseEdges', () => {
  it('parses a linear chain', () => {
    const edges = parseEdges(['ingest → classify → emit']);
    expect(edges).toEqual([
      { from: 'ingest', to: 'classify', guard: { kind: 'always' } },
      { from: 'classify', to: 'emit', guard: { kind: 'always' } },
    ]);
  });

  it('parses a guarded edge', () => {
    const edges = parseEdges(['validate → hitl [if needsReview]']);
    expect(edges).toEqual([
      { from: 'validate', to: 'hitl', guard: { kind: 'predicate', expr: 'needsReview' } },
    ]);
  });

  it('parses a guarded edge with max loops', () => {
    const edges = parseEdges(['hitl → draft [if reviewer.action == "regenerate", max 3 loops]']);
    expect(edges).toEqual([
      {
        from: 'hitl',
        to: 'draft',
        guard: { kind: 'predicate', expr: 'reviewer.action == "regenerate"' },
        maxLoops: 3,
      },
    ]);
  });

  it('accepts ASCII arrow "->" as well as "→"', () => {
    expect(parseEdges(['a -> b'])).toEqual([
      { from: 'a', to: 'b', guard: { kind: 'always' } },
    ]);
  });

  it('throws on malformed lines', () => {
    expect(() => parseEdges(['not an edge'])).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- engine/__tests__/workflow/dsl.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `engine/workflow/dsl.ts`**

```ts
// engine/workflow/dsl.ts
import type { WorkflowEdge } from '@engine/types';

const ARROW = /\s*(?:→|->)\s*/;
const GUARD_RE = /\[\s*if\s+(.+?)(?:\s*,\s*max\s+(\d+)\s+loops)?\s*\]\s*$/i;
const NODE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEdges(lines: string[]): WorkflowEdge[] {
  const out: WorkflowEdge[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    out.push(...parseLine(line));
  }
  return out;
}

function parseLine(line: string): WorkflowEdge[] {
  // Pull off an optional trailing [if ...] guard once.
  let body = line;
  let guardExpr: string | null = null;
  let maxLoops: number | undefined;
  const guardMatch = body.match(GUARD_RE);
  if (guardMatch) {
    guardExpr = guardMatch[1].trim();
    if (guardMatch[2]) maxLoops = parseInt(guardMatch[2], 10);
    body = body.slice(0, guardMatch.index).trim();
  }

  const parts = body.split(ARROW).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Invalid edge line: "${line}" (expected "a → b")`);
  }
  for (const p of parts) {
    if (!NODE_RE.test(p)) {
      throw new Error(`Invalid node name "${p}" in edge line "${line}"`);
    }
  }

  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const isLastEdge = i === parts.length - 2;
    edges.push({
      from: parts[i],
      to: parts[i + 1],
      guard: isLastEdge && guardExpr
        ? { kind: 'predicate', expr: guardExpr }
        : { kind: 'always' },
      ...(isLastEdge && maxLoops !== undefined ? { maxLoops } : {}),
    });
  }
  return edges;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:run -- engine/__tests__/workflow/dsl.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add engine/workflow/dsl.ts engine/__tests__/workflow/dsl.test.ts
git commit -m "feat(engine): add workflow edge DSL parser (chains, predicate guards, max-loops)"
```

---

## Task 12: `defineWorkflow` public API (`engine/workflow/defineWorkflow.ts`)

**Files:**
- Create: `engine/workflow/defineWorkflow.ts`

- [ ] **Step 1: Implement `engine/workflow/defineWorkflow.ts`**

```ts
// engine/workflow/defineWorkflow.ts
import { parseEdges } from '@engine/workflow/dsl';
import type { PrimitiveNodeDef, WorkflowGraph } from '@engine/types';

export interface DefineWorkflowInput {
  id: string;
  rulesPack: string;                       // "<id>@<version>"
  nodes: Record<string, PrimitiveNodeDef>;
  edges: string[];                         // DSL strings, see dsl.ts
}

export function defineWorkflow(input: DefineWorkflowInput): WorkflowGraph {
  const edges = parseEdges(input.edges);
  // Validate every edge node exists in nodes map.
  for (const e of edges) {
    if (!input.nodes[e.from]) throw new Error(`Edge references unknown node "${e.from}"`);
    if (!input.nodes[e.to]) throw new Error(`Edge references unknown node "${e.to}"`);
  }
  return {
    id: input.id,
    rulesPack: input.rulesPack,
    nodes: input.nodes,
    edges,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add engine/workflow/defineWorkflow.ts
git commit -m "feat(engine): add defineWorkflow() public API"
```

---

## Task 13: Primitive stubs + the `primitives` namespace

**Files:**
- Create: `engine/primitives/ingest.ts`
- Create: `engine/primitives/classify.ts`
- Create: `engine/primitives/extract.ts`
- Create: `engine/primitives/lookup.ts`
- Create: `engine/primitives/reason.ts`
- Create: `engine/primitives/draft.ts`
- Create: `engine/primitives/validate.ts`
- Create: `engine/primitives/hitl.ts`
- Create: `engine/primitives/emit.ts`
- Create: `engine/primitives/index.ts`
- Test: `engine/__tests__/primitives/ingest.test.ts`

Pattern: every non-ingest primitive in Phase 1 is a no-op stub that returns `ok({})` and writes a `TraceEvent`. The real logic lands in later phases.

- [ ] **Step 1: Write the failing test for Ingest**

```ts
// engine/__tests__/primitives/ingest.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ingestPrimitive } from '@engine/primitives/ingest';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({
        data: {
          id: 'src-1', workspace_id: 'ws-1', filename: 'hello.txt',
          mime: 'text/plain', storage_url: null,
          typed_rep: { text: 'hi', pageCount: 1, fileType: 'txt' },
          is_large: false,
        },
        error: null,
      }) }) }),
    }),
  }),
}));

describe('ingestPrimitive', () => {
  it('runs extractor on a buffer and returns a Source result', async () => {
    const buf = Buffer.from('hi', 'utf-8');
    const result = await ingestPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: null,
      nodeId: 'ingest',
      file: { buffer: buf, filename: 'hello.txt', mime: 'text/plain' },
    });
    expect(result.ok).toBe(true);
    expect(result.value.source.id).toBe('src-1');
    expect(result.value.source.typedRep.fileType).toBe('txt');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- engine/__tests__/primitives/ingest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `engine/primitives/ingest.ts`**

```ts
// engine/primitives/ingest.ts
import { extractFromBuffer } from '@/lib/extractor';
import { insertSource } from '@engine/storage/workspace';
import { writeTrace } from '@engine/primitives/trace';
import { ok, fail } from '@engine/result';
import type { PrimitiveResult, Source } from '@engine/types';

export interface IngestInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  file: { buffer: Buffer; filename: string; mime: string };
  storageUrl?: string | null;
}

export interface IngestOutput {
  source: Source;
}

export async function ingestPrimitive(input: IngestInput): Promise<PrimitiveResult<IngestOutput>> {
  const t0 = Date.now();
  try {
    const extraction = await extractFromBuffer(input.file.buffer, input.file.filename);
    const source = await insertSource({
      workspaceId: input.workspaceId,
      filename: input.file.filename,
      mime: input.file.mime,
      storageUrl: input.storageUrl ?? null,
      typedRep: {
        text: extraction.text,
        pageCount: extraction.pageCount,
        fileType: extraction.fileType,
      },
      isLarge: extraction.isLarge,
    });
    const result = ok({ source } as IngestOutput, { confidence: 1.0 });
    await writeTrace({
      workspaceId: input.workspaceId,
      workflowRunId: input.workflowRunId,
      nodeId: input.nodeId,
      primitive: 'ingest',
      inputs: { filename: input.file.filename, mime: input.file.mime, bytes: input.file.buffer.length },
      output: { sourceId: source.id, fileType: source.typedRep.fileType, pageCount: source.typedRep.pageCount },
      model: null,
      confidence: result.confidence,
      latencyMs: Date.now() - t0,
      costUsd: null,
      reviewer: null,
    });
    return result;
  } catch (err) {
    const failure = fail('E_INGEST', (err as Error).message);
    await writeTrace({
      workspaceId: input.workspaceId,
      workflowRunId: input.workflowRunId,
      nodeId: input.nodeId,
      primitive: 'ingest',
      inputs: { filename: input.file.filename },
      output: { error: (err as Error).message },
      model: null,
      confidence: 0,
      latencyMs: Date.now() - t0,
      costUsd: null,
      reviewer: null,
    });
    return failure;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:run -- engine/__tests__/primitives/ingest.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Create the 8 stub primitives**

Each follows the same pattern: take `{ workspaceId, workflowRunId, nodeId, ... }`, write one `TraceEvent`, return `ok({})`.

Create `engine/primitives/classify.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface ClassifyInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { taxonomy?: string };
}

export async function classifyPrimitive(input: ClassifyInput): Promise<PrimitiveResult<{ class: string }>> {
  const t0 = Date.now();
  const result = ok({ class: 'unknown' }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'classify',
    inputs: { taxonomy: input.config.taxonomy ?? null },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

Create `engine/primitives/extract.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface ExtractInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { schema?: string };
}

export async function extractPrimitive(input: ExtractInput): Promise<PrimitiveResult<{ entities: unknown[] }>> {
  const t0 = Date.now();
  const result = ok({ entities: [] as unknown[] }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'extract',
    inputs: { schema: input.config.schema ?? null },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

Create `engine/primitives/lookup.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface LookupInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { indexes?: string[] };
}

export async function lookupPrimitive(input: LookupInput): Promise<PrimitiveResult<{ matches: unknown[] }>> {
  const t0 = Date.now();
  const result = ok({ matches: [] as unknown[] }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'lookup',
    inputs: { indexes: input.config.indexes ?? [] },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

Create `engine/primitives/reason.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface ReasonInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { task?: string };
}

export async function reasonPrimitive(input: ReasonInput): Promise<PrimitiveResult<{ decisions: unknown[] }>> {
  const t0 = Date.now();
  const result = ok({ decisions: [] as unknown[] }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'reason',
    inputs: { task: input.config.task ?? null },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

Create `engine/primitives/draft.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface DraftInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { outputs?: string[] };
}

export async function draftPrimitive(input: DraftInput): Promise<PrimitiveResult<{ drafts: unknown[] }>> {
  const t0 = Date.now();
  const result = ok({ drafts: [] as unknown[] }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'draft',
    inputs: { outputs: input.config.outputs ?? [] },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

Create `engine/primitives/validate.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface ValidateInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { against?: string };
}

export async function validatePrimitive(
  input: ValidateInput,
): Promise<PrimitiveResult<{ needsReview: boolean; issues: unknown[] }>> {
  const t0 = Date.now();
  // Skeleton: always passes, never needs review.
  const result = ok({ needsReview: false, issues: [] as unknown[] }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'validate',
    inputs: { against: input.config.against ?? null },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

Create `engine/primitives/hitl.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface HitlInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { when?: string };
}

export async function hitlPrimitive(
  input: HitlInput,
): Promise<PrimitiveResult<{ reviewer: { action: 'approve' } }>> {
  const t0 = Date.now();
  // Skeleton: auto-approves so the runtime can be exercised without a real reviewer.
  const result = ok({ reviewer: { action: 'approve' as const } }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'hitl',
    inputs: { when: input.config.when ?? null },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: { userId: '00000000-0000-0000-0000-000000000000', action: 'auto-approve' },
  });
  return result;
}
```

Create `engine/primitives/emit.ts`:
```ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface EmitInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { formats?: string[] };
}

export async function emitPrimitive(
  input: EmitInput,
): Promise<PrimitiveResult<{ emitted: string[] }>> {
  const t0 = Date.now();
  const formats = input.config.formats ?? [];
  const result = ok({ emitted: formats }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'emit',
    inputs: { formats },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
```

Create `engine/primitives/index.ts` — the `primitives as P` namespace exposed to workflow files:
```ts
// engine/primitives/index.ts
import type { PrimitiveNodeDef } from '@engine/types';

// Each factory returns a PrimitiveNodeDef so workflows are pure data structures.
// The runtime resolves the `primitive` field to the actual implementation in primitives/<name>.ts.

export const primitives = {
  ingest:   (config: { accept?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'ingest',   config }),
  classify: (config: { taxonomy?: string } = {}): PrimitiveNodeDef => ({ primitive: 'classify', config }),
  extract:  (config: { schema?: string }   = {}): PrimitiveNodeDef => ({ primitive: 'extract',  config }),
  lookup:   (config: { indexes?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'lookup',   config }),
  reason:   (config: { task?: string }     = {}): PrimitiveNodeDef => ({ primitive: 'reason',   config }),
  draft:    (config: { outputs?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'draft',    config }),
  validate: (config: { against?: string }  = {}): PrimitiveNodeDef => ({ primitive: 'validate', config }),
  hitl:     (config: { when?: string }     = {}): PrimitiveNodeDef => ({ primitive: 'hitl',     config }),
  emit:     (config: { formats?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'emit',     config }),
};
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit && npm run test:run -- engine/__tests__/primitives/ingest.test.ts`
Expected: tsc clean, ingest test still passes.

- [ ] **Step 7: Commit**

```bash
git add engine/primitives
git commit -m "feat(engine): add ingest primitive (wires extractor) + 8 stub primitives + primitives namespace"
```

---

## Task 14: Workflow runtime (`engine/workflow/runtime.ts`)

**Files:**
- Create: `engine/workflow/runtime.ts`
- Test: `engine/__tests__/workflow/runtime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// engine/__tests__/workflow/runtime.test.ts
import { describe, it, expect } from 'vitest';
import { pickNextNode, evalGuard } from '@engine/workflow/runtime';
import type { WorkflowEdge } from '@engine/types';

describe('evalGuard', () => {
  it('always-guards return true', () => {
    expect(evalGuard({ kind: 'always' }, {})).toBe(true);
  });

  it('predicate guard reads boolean from state by key', () => {
    expect(evalGuard({ kind: 'predicate', expr: 'needsReview' }, { needsReview: true })).toBe(true);
    expect(evalGuard({ kind: 'predicate', expr: 'needsReview' }, { needsReview: false })).toBe(false);
  });

  it('predicate guard supports negation', () => {
    expect(evalGuard({ kind: 'predicate', expr: '!needsReview' }, { needsReview: false })).toBe(true);
    expect(evalGuard({ kind: 'predicate', expr: '!needsReview' }, { needsReview: true })).toBe(false);
  });
});

describe('pickNextNode', () => {
  const edges: WorkflowEdge[] = [
    { from: 'a', to: 'b', guard: { kind: 'predicate', expr: 'go' } },
    { from: 'a', to: 'c', guard: { kind: 'predicate', expr: '!go' } },
  ];
  it('picks the first matching edge', () => {
    expect(pickNextNode('a', edges, { go: true })).toBe('b');
    expect(pickNextNode('a', edges, { go: false })).toBe('c');
  });
  it('returns null when no edge matches (terminal node)', () => {
    expect(pickNextNode('z', edges, {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- engine/__tests__/workflow/runtime.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `engine/workflow/runtime.ts`**

```ts
// engine/workflow/runtime.ts
import { createServerClient } from '@/lib/supabase-server';
import type {
  EdgeGuard, PrimitiveResult, WorkflowEdge, WorkflowGraph, WorkflowRun,
} from '@engine/types';

import { ingestPrimitive,   type IngestInput }   from '@engine/primitives/ingest';
import { classifyPrimitive } from '@engine/primitives/classify';
import { extractPrimitive }  from '@engine/primitives/extract';
import { lookupPrimitive }   from '@engine/primitives/lookup';
import { reasonPrimitive }   from '@engine/primitives/reason';
import { draftPrimitive }    from '@engine/primitives/draft';
import { validatePrimitive } from '@engine/primitives/validate';
import { hitlPrimitive }     from '@engine/primitives/hitl';
import { emitPrimitive }     from '@engine/primitives/emit';

// ---------- pure helpers (unit-tested) ----------

export function evalGuard(guard: EdgeGuard, state: Record<string, unknown>): boolean {
  if (guard.kind === 'always') return true;
  const expr = guard.expr.trim();
  if (expr.startsWith('!')) {
    return !truthy(state[expr.slice(1).trim()]);
  }
  return truthy(state[expr]);
}

function truthy(v: unknown): boolean {
  return v !== undefined && v !== null && v !== false && v !== 0 && v !== '';
}

export function pickNextNode(
  current: string,
  edges: WorkflowEdge[],
  state: Record<string, unknown>,
): string | null {
  for (const e of edges) {
    if (e.from !== current) continue;
    if (evalGuard(e.guard, state)) return e.to;
  }
  return null;
}

// ---------- runtime ----------

export interface RunWorkflowInput {
  graph: WorkflowGraph;
  workspaceId: string;
  startNode: string;
  initialState?: Record<string, unknown>;
  // Per-node side inputs (e.g. ingest needs a file). Keyed by node name.
  nodeInputs?: Record<string, Record<string, unknown>>;
}

export interface RunWorkflowOutput {
  run: WorkflowRun;
  finalNode: string;
  state: Record<string, unknown>;
  results: Array<{ node: string; result: PrimitiveResult }>;
}

export async function runWorkflow(input: RunWorkflowInput): Promise<RunWorkflowOutput> {
  const supabase = createServerClient();
  // Create the WorkflowRun row.
  const { data: runRow, error: runErr } = await supabase
    .from('eng_workflow_runs')
    .insert({
      workspace_id: input.workspaceId,
      graph_id: input.graph.id,
      current_node: input.startNode,
      state: input.initialState ?? {},
    })
    .select()
    .single();
  if (runErr || !runRow) throw new Error(`runWorkflow: create run failed: ${runErr?.message}`);

  const run: WorkflowRun = {
    id: runRow.id, workspaceId: runRow.workspace_id, graphId: runRow.graph_id,
    currentNode: runRow.current_node, state: runRow.state, updatedAt: runRow.updated_at,
  };

  const state: Record<string, unknown> = { ...(input.initialState ?? {}) };
  const results: Array<{ node: string; result: PrimitiveResult }> = [];

  // Track per-edge loop counts so maxLoops can be enforced.
  const loopCounts = new Map<string, number>();
  const edgeKey = (from: string, to: string) => `${from}->${to}`;

  let current: string | null = input.startNode;
  let lastNode = current;
  while (current) {
    const nodeDef = input.graph.nodes[current];
    if (!nodeDef) throw new Error(`runWorkflow: unknown node "${current}"`);

    const sideInput = input.nodeInputs?.[current] ?? {};
    const result = await invokePrimitive(nodeDef.primitive, {
      workspaceId: input.workspaceId,
      workflowRunId: run.id,
      nodeId: current,
      config: nodeDef.config,
      ...sideInput,
    });
    results.push({ node: current, result });

    // Merge primitive output into state for guard evaluation.
    if (result.ok && result.value && typeof result.value === 'object') {
      Object.assign(state, result.value);
    }
    state['needsReview'] = result.needsReview;

    // Persist run state.
    await supabase
      .from('eng_workflow_runs')
      .update({ current_node: current, state })
      .eq('id', run.id);

    lastNode = current;
    const next: string | null = pickNextNode(current, input.graph.edges, state);
    if (!next) break;

    // Enforce maxLoops on the chosen edge.
    const edge = input.graph.edges.find((e) => e.from === current && e.to === next)!;
    if (edge.maxLoops !== undefined) {
      const key = edgeKey(current, next);
      const count = (loopCounts.get(key) ?? 0) + 1;
      loopCounts.set(key, count);
      if (count > edge.maxLoops) {
        throw new Error(`runWorkflow: edge ${key} exceeded maxLoops=${edge.maxLoops}`);
      }
    }
    current = next;
  }

  return { run, finalNode: lastNode, state, results };
}

// ---------- primitive dispatch ----------

async function invokePrimitive(
  name: string,
  ctx: Record<string, unknown>,
): Promise<PrimitiveResult> {
  switch (name) {
    case 'ingest':   return ingestPrimitive(ctx as unknown as IngestInput) as Promise<PrimitiveResult>;
    case 'classify': return classifyPrimitive(ctx as Parameters<typeof classifyPrimitive>[0]);
    case 'extract':  return extractPrimitive(ctx as Parameters<typeof extractPrimitive>[0]);
    case 'lookup':   return lookupPrimitive(ctx as Parameters<typeof lookupPrimitive>[0]);
    case 'reason':   return reasonPrimitive(ctx as Parameters<typeof reasonPrimitive>[0]);
    case 'draft':    return draftPrimitive(ctx as Parameters<typeof draftPrimitive>[0]);
    case 'validate': return validatePrimitive(ctx as Parameters<typeof validatePrimitive>[0]);
    case 'hitl':     return hitlPrimitive(ctx as Parameters<typeof hitlPrimitive>[0]);
    case 'emit':     return emitPrimitive(ctx as Parameters<typeof emitPrimitive>[0]);
    default: throw new Error(`Unknown primitive "${name}"`);
  }
}
```

- [ ] **Step 4: Run to verify pure-helper tests pass**

Run: `npm run test:run -- engine/__tests__/workflow/runtime.test.ts`
Expected: 5 passed (only pure helpers — the full `runWorkflow` is exercised by Task 16's integration test).

- [ ] **Step 5: Commit**

```bash
git add engine/workflow/runtime.ts engine/__tests__/workflow/runtime.test.ts
git commit -m "feat(engine): add workflow runtime (guard eval, node picker, primitive dispatch)"
```

---

## Task 15: AI Gateway provider wrapper (`engine/providers/gateway.ts`)

**Files:**
- Create: `engine/providers/gateway.ts`
- Test: deferred — wrapper is a thin pass-through that's better tested via Phase-2 reasoning code where it's actually exercised.

- [ ] **Step 1: Implement `engine/providers/gateway.ts`**

```ts
// engine/providers/gateway.ts
// Vercel AI Gateway wrapper. Lets callers pass "provider/model" strings
// (e.g. "groq/llama-3.3-70b-versatile", "anthropic/claude-sonnet-4-5",
// "mistral/mistral-ocr-latest") without per-provider SDK imports.
//
// In Phase 1 this is a tiny façade. Real reasoning code lands in later phases.

import { gateway } from '@ai-sdk/gateway';

export type ModelId = string; // e.g. "groq/llama-3.3-70b-versatile"

/**
 * Returns an AI SDK model handle. Pass straight to generateText / streamText.
 *
 * Auth: requires AI_GATEWAY_API_KEY in the environment, or — when deployed on
 * Vercel — uses the project's OIDC token automatically.
 */
export function model(id: ModelId) {
  return gateway(id);
}

export const DEFAULT_FAST_MODEL: ModelId = 'groq/llama-3.3-70b-versatile';
export const DEFAULT_REASONING_MODEL: ModelId = 'anthropic/claude-sonnet-4-5';
export const DEFAULT_OCR_MODEL: ModelId = 'mistral/mistral-ocr-latest';
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean. If `@ai-sdk/gateway` has a different export name in the installed version, adjust the import to match what `node_modules/@ai-sdk/gateway/dist/index.d.ts` exposes (some versions export `createGateway`).

- [ ] **Step 3: Commit**

```bash
git add engine/providers/gateway.ts
git commit -m "feat(engine): add Vercel AI Gateway provider wrapper"
```

---

## Task 16: No-op workflow + end-to-end integration test

**Files:**
- Create: `engine/workflows/noop.workflow.ts`
- Test: `engine/__tests__/integration/noop-workflow.test.ts`

This is the Phase-1 acceptance gate: a real Supabase round-trip that exercises the runtime, primitives, and trace writer in concert.

- [ ] **Step 1: Implement `engine/workflows/noop.workflow.ts`**

```ts
// engine/workflows/noop.workflow.ts
import { defineWorkflow } from '@engine/workflow/defineWorkflow';
import { primitives as P } from '@engine/primitives';

export const noopWorkflow = defineWorkflow({
  id: 'noop/v1',
  rulesPack: 'noop@1.0.0',
  nodes: {
    ingest: P.ingest({ accept: ['txt'] }),
    emit:   P.emit({ formats: ['noop'] }),
  },
  edges: [
    'ingest → emit',
  ],
});
```

- [ ] **Step 2: Write the integration test**

```ts
// engine/__tests__/integration/noop-workflow.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createServerClient } from '@/lib/supabase-server';
import { createWorkspace } from '@engine/storage/workspace';
import { runWorkflow } from '@engine/workflow/runtime';
import { noopWorkflow } from '../../workflows/noop.workflow';

const RUN_INTEGRATION = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!RUN_INTEGRATION)('noop workflow end-to-end', () => {
  let workspaceId: string;

  beforeAll(async () => {
    const ws = await createWorkspace({
      workflowId: noopWorkflow.id,
      rulesPackId: 'noop',
      rulesPackVersion: '1.0.0',
    });
    workspaceId = ws.id;
  });

  it('runs ingest → emit and writes a trace event per node', async () => {
    const out = await runWorkflow({
      graph: noopWorkflow,
      workspaceId,
      startNode: 'ingest',
      nodeInputs: {
        ingest: {
          file: {
            buffer: Buffer.from('hello world', 'utf-8'),
            filename: 'hello.txt',
            mime: 'text/plain',
          },
        },
      },
    });

    expect(out.finalNode).toBe('emit');
    expect(out.results.map((r) => r.node)).toEqual(['ingest', 'emit']);
    expect(out.results.every((r) => r.result.ok)).toBe(true);

    // Verify trace events were written.
    const supabase = createServerClient();
    const { data: traces, error } = await supabase
      .from('eng_trace_events')
      .select('primitive, node_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    expect(error).toBeNull();
    expect(traces?.length).toBeGreaterThanOrEqual(2);
    expect(traces?.map((t) => t.primitive)).toEqual(expect.arrayContaining(['ingest', 'emit']));
  });
});
```

- [ ] **Step 3: Run the integration test against your dev Supabase**

Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in your shell (or `.env.local` loaded by your test environment). Then:
```bash
npm run test:run -- engine/__tests__/integration/noop-workflow.test.ts
```
Expected: 1 passed (skipped only when env vars are absent).

If env vars are absent the test is skipped — that's intentional so CI without Supabase access still goes green. Confirm locally before declaring done.

- [ ] **Step 4: Commit**

```bash
git add engine/workflows/noop.workflow.ts engine/__tests__/integration/noop-workflow.test.ts
git commit -m "feat(engine): add noop workflow + end-to-end ingest→emit integration test"
```

---

## Task 17: Full test suite + lint + tsc

**Files:** none

- [ ] **Step 1: Run the whole suite**

```bash
npm run test:run
npx tsc --noEmit
npm run lint
```
Expected: all green. Any lint errors in `engine/` should be fixed inline.

- [ ] **Step 2: If lint complains about unused imports or `any`, fix them inline and re-commit**

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore(engine): lint cleanup after Phase 1"
```

---

## Self-review (executed inline)

**Spec coverage check** against `C:\Users\acer\.claude\plans\your-current-docmind-direction-partitioned-noodle.md` § "Critical files to create / modify":

| Spec item | Task |
|---|---|
| `engine/types.ts` | Task 2 ✓ |
| `engine/primitives/{ingest,classify,extract,lookup,reason,draft,validate,hitl,emit,trace}.ts` | Tasks 5 (trace), 13 (the other 9) ✓ |
| `engine/workflow/{defineWorkflow.ts, runtime.ts, dsl.ts}` | Tasks 11, 12, 14 ✓ |
| `engine/rules-pack/{loader.ts, schema.ts, version.ts}` | Tasks 8, 9, 10 ✓ |
| `engine/storage/{workspace.ts, trace.ts, artifact.ts}` | Tasks 5, 6, 7 ✓ |
| Supabase migration (orgs, memberships, workspaces, sources, canonical_entities, workflow_runs, artifacts, trace_events partitioned, rules_packs) | Task 4 ✓ |
| No-op workflow + integration test | Task 16 ✓ |
| Vercel AI Gateway provider abstraction | Task 15 ✓ |
| Constraints: `runtime='nodejs'` + `maxDuration=60` | Not applicable in Phase 1 — no new API routes ship this phase. The constraint applies starting Phase 2 (workspace API). Noted for the next plan. |
| Constraints: sequential Groq | Not applicable in Phase 1 — no Groq calls in skeleton primitives. Applies starting Phase 2. |
| Constraints: `I.*` icons, dual-source pattern, is_large | Inherited by future UI/API phases; no UI in Phase 1. `is_large` IS preserved in the new `eng_sources` table. ✓ |

**Placeholder scan:** Searched for "TBD", "TODO", "implement later", "similar to" — none present. Every code step shows full code.

**Type-consistency check:** `PrimitiveResult` shape is defined in Task 2 and used identically by Tasks 3, 13, 14. `WorkflowEdge` / `EdgeGuard` defined in Task 2, used by Tasks 11, 12, 14. Storage row mappers in Tasks 5, 6, 7 all map snake_case → camelCase consistently. Trace writer column names in Task 5 match the SQL columns in Task 4. ✓

**Gap fix:** Initially missed that `validate` primitive sets `state.needsReview` for the `hitl` guard. The runtime in Task 14 explicitly does `state['needsReview'] = result.needsReview` after each primitive, so HITL routing works even though Phase-1 stubs always set `needsReview=false`. Documented in Task 14 implementation.

---

## How this maps to the spec verification list

| Spec verification step | Where validated in this plan |
|---|---|
| 1. Smoke (engine alone) — unit tests per primitive | Tasks 3, 5, 8, 9, 10, 11, 13, 14 |
| 1. Smoke — integration test ingest→emit + one TraceEvent | Task 16 ✓ |
| 2. GPSR happy path | Deferred to Phase 2 |
| 3. GPSR multilingual | Deferred to Phase 2 |
| 4. Trace integrity (replay, click-to-source) | Phase 1 lays the data trail in `eng_trace_events`; replay UI is later |
| 5. Rules-pack swap proof | Partially exercised — noop pack loads via Task 10; a second pack swap demo lands in Phase 6 (TPRM) |
| 6. Existing infra preserved | No legacy code modified; all engine code is new under `engine/`. `extractor.ts` is imported, not changed. ✓ |
