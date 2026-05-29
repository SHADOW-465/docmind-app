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
