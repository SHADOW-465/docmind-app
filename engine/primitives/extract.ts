import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import type { PrimitiveResult } from '@engine/types';

export interface ExtractInput {
  workspaceId: string; workflowRunId: string | null; nodeId: string;
  config: { schema?: string };
}

export async function extractPrimitive(input: ExtractInput): Promise<PrimitiveResult<{ entities: unknown[] }>> {
  const t0 = Date.now();
  const result = ok({ entities: [] as unknown[] }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'extract',
    inputs: { schema: input.config.schema ?? null },
    output: result.value,
    model: null, confidence: result.confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
