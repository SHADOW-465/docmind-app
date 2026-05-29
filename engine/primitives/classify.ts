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
