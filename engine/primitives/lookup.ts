// engine/primitives/lookup.ts
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadLookup } from '@engine/rules-pack/lookups';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface LookupInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { indexes?: string[] };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

interface SchemeRow {
  schemeId: string;
  name: string;
  jurisdiction: string;
  wasteStream: string;
  portalUrl: string;
  registrationFieldShape: { required: string[]; language: string };
  appliesToCategories: string[];
}

export interface LookupOutput {
  schemes: SchemeRow[];
}

export async function lookupPrimitive(
  input: LookupInput,
): Promise<PrimitiveResult<LookupOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return await emitResult(input, t0, { schemes: [] });
  }

  const useSchemes = (input.config.indexes ?? []).includes('de-epr-schemes');
  if (!useSchemes) {
    return await emitResult(input, t0, { schemes: [] });
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);
  const lookup = await loadLookup(pack, 'de-epr-schemes');
  const categoryId = (input.state?.categoryId as string | undefined) ?? 'cat-unknown';
  const schemes: SchemeRow[] = (lookup.rows as unknown as SchemeRow[]).filter((row) =>
    row.appliesToCategories.includes('*') || row.appliesToCategories.includes(categoryId),
  );

  return await emitResult(input, t0, { schemes });
}

async function emitResult(
  input: LookupInput,
  t0: number,
  value: LookupOutput,
): Promise<PrimitiveResult<LookupOutput>> {
  const result = ok(value, { confidence: 1.0 });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'lookup',
    inputs: { indexes: input.config.indexes ?? [], categoryId: input.state?.categoryId ?? null },
    output: { schemeIds: value.schemes.map((s) => s.schemeId) },
    model: null, confidence: 1.0, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
