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
