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
    case 'classify': return classifyPrimitive(ctx as unknown as Parameters<typeof classifyPrimitive>[0]);
    case 'extract':  return extractPrimitive(ctx as unknown as Parameters<typeof extractPrimitive>[0]);
    case 'lookup':   return lookupPrimitive(ctx as unknown as Parameters<typeof lookupPrimitive>[0]);
    case 'reason':   return reasonPrimitive(ctx as unknown as Parameters<typeof reasonPrimitive>[0]);
    case 'draft':    return draftPrimitive(ctx as unknown as Parameters<typeof draftPrimitive>[0]);
    case 'validate': return validatePrimitive(ctx as unknown as Parameters<typeof validatePrimitive>[0]);
    case 'hitl':     return hitlPrimitive(ctx as unknown as Parameters<typeof hitlPrimitive>[0]);
    case 'emit':     return emitPrimitive(ctx as unknown as Parameters<typeof emitPrimitive>[0]);
    default: throw new Error(`Unknown primitive "${name}"`);
  }
}
