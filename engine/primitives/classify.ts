// engine/primitives/classify.ts
import { generateText } from 'ai';
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { model, DEFAULT_FAST_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';
import { loadLookup } from '@engine/rules-pack/lookups';
import { insertEntity } from '@engine/storage/entities';
import { listSources } from '@engine/storage/workspace';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ClassifyInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { taxonomy?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
  sourceText?: string;
}

export interface ClassifyOutput {
  categoryId: string;
}

export async function classifyPrimitive(
  input: ClassifyInput,
): Promise<PrimitiveResult<ClassifyOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    const result = ok({ categoryId: 'cat-unknown' }, { confidence: 0 });
    await writeTrace({
      workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
      primitive: 'classify',
      inputs: { taxonomy: input.config.taxonomy ?? null, reason: 'no-workspace-context' },
      output: result.value,
      model: null, confidence: 0, latencyMs: Date.now() - t0,
      costUsd: null, reviewer: null,
    });
    return result;
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);

  let sourceText: string = input.sourceText ?? '';
  if (input.sourceText === undefined) {
    const sources = await listSources(input.workspaceId);
    sourceText = sources.map((s) => s.typedRep.text).join('\n\n---\n\n');
  }

  const template = await loadPrompt(pack, 'classify.product-category.md');
  const categoryList = await loadLookup(pack, 'eu-product-categories');
  const listText = categoryList.rows
    .map((r) => `- ${(r as { id: string }).id}: ${(r as { label: string }).label}`)
    .join('\n');
  const prompt = renderPrompt(template, { categoryList: listText, sourceText });

  const { text } = await generateText({
    model: model(DEFAULT_FAST_MODEL),
    prompt,
    maxOutputTokens: 200,
  });

  let parsed: { categoryId?: string; confidence?: number; rationale?: string } = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    // fall through to unknown
  }
  const categoryId = (parsed.categoryId ?? 'cat-unknown') as string;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

  await insertEntity({
    workspaceId: input.workspaceId,
    type: 'classification',
    value: { categoryId, confidence, rationale: parsed.rationale ?? null },
    citations: [],
  });

  const result = ok({ categoryId }, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'classify',
    inputs: { taxonomy: input.config.taxonomy ?? null, sourceLength: sourceText.length },
    output: { categoryId, confidence },
    model: { name: DEFAULT_FAST_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
