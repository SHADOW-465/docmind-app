// engine/primitives/extract.ts
import { generateText } from 'ai';
import { writeTrace } from '@engine/primitives/trace';
import { ok, fail } from '@engine/result';
import { model, DEFAULT_FAST_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';
import { loadSchema } from '@engine/rules-pack/schemas';
import { insertEntity } from '@engine/storage/entities';
import { listSources } from '@engine/storage/workspace';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ExtractInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { schema?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
  sourceText?: string;
}

export interface ExtractOutput {
  entity: Record<string, unknown>;
  fieldMeta: Record<string, { confidence: number; spans?: { start: number; end: number }[] }>;
}

export async function extractPrimitive(
  input: ExtractInput,
): Promise<PrimitiveResult<ExtractOutput>> {
  const t0 = Date.now();
  if (!input.workspace || !input.config.schema) {
    return fail<ExtractOutput>('E_EXTRACT_NO_CONTEXT', 'workspace + schema config required');
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);
  const schema = await loadSchema(pack, `${input.config.schema}.json`);

  let sourceText = input.sourceText ?? '';
  if (input.sourceText === undefined) {
    const sources = await listSources(input.workspaceId);
    sourceText = sources.map((s) => s.typedRep.text).join('\n\n---\n\n');
  }

  const template = await loadPrompt(pack, 'extract.product-catalog.md');
  const categoryId = (input.state?.categoryId as string | undefined) ?? 'cat-unknown';
  const prompt = renderPrompt(template, {
    schemaJson: JSON.stringify(schema, null, 2),
    categoryId,
    sourceText,
  });

  const { text } = await generateText({
    model: model(DEFAULT_FAST_MODEL),
    prompt,
    maxOutputTokens: 2000,
  });

  let parsed: { value?: Record<string, unknown>; fieldMeta?: ExtractOutput['fieldMeta'] } = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    // fall through
  }
  const entity = parsed.value ?? {};
  const fieldMeta = parsed.fieldMeta ?? {};

  await insertEntity({
    workspaceId: input.workspaceId,
    type: input.config.schema,
    value: { ...entity, _fieldMeta: fieldMeta },
    citations: [],
  });

  const confs = Object.values(fieldMeta).map((m) => m.confidence ?? 0);
  const confidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.5;

  const result = ok({ entity, fieldMeta }, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'extract',
    inputs: { schema: input.config.schema, categoryId, sourceLength: sourceText.length },
    output: { entityKeys: Object.keys(entity), fieldMetaCount: Object.keys(fieldMeta).length },
    model: { name: DEFAULT_FAST_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
