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
