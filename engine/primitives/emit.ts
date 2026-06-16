// engine/primitives/emit.ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { insertArtifact, updateArtifact } from '@engine/storage/artifact';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface EmitInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { formats?: string[] };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

interface DraftLike {
  outputType: string;
  scheme?: string;
  value: Record<string, unknown>;
  fieldMeta?: Record<string, unknown>;
}

export interface EmitOutput {
  emitted: Array<{ artifactId: string; outputType: string; format: string }>;
}

export async function emitPrimitive(
  input: EmitInput,
): Promise<PrimitiveResult<EmitOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return ok({ emitted: [] });
  }
  const drafts = (input.state?.drafts as DraftLike[] | undefined) ?? [];
  const format = (input.config.formats ?? ['json'])[0] ?? 'json';

  const emitted: EmitOutput['emitted'] = [];
  for (const d of drafts) {
    const artifact = await insertArtifact({
      workspaceId: input.workspaceId,
      type: d.outputType,
      schemaId: d.outputType,
      value: { ...d.value, _scheme: d.scheme, _fieldMeta: d.fieldMeta ?? {} },
    });
    await updateArtifact(artifact.id, {
      status: 'emitted',
      emittedFormat: format,
      emittedUrl: null,
    });
    emitted.push({ artifactId: artifact.id, outputType: d.outputType, format });
  }

  const result = ok({ emitted }, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'emit',
    inputs: { formats: input.config.formats ?? [], draftCount: drafts.length },
    output: { emittedCount: emitted.length, artifactIds: emitted.map((e) => e.artifactId) },
    model: null, confidence: 1.0, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
