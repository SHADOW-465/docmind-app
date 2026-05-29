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
