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
