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
