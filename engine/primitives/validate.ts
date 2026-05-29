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
