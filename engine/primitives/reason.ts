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
