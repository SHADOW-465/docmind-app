// engine/primitives/draft.ts
import { generateText } from 'ai';
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { model, DEFAULT_FAST_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';
import { loadSchema } from '@engine/rules-pack/schemas';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface DraftInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { outputs?: string[] };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

export interface SingleDraft {
  outputType: string;
  scheme?: string;
  value: Record<string, unknown>;
  fieldMeta: Record<string, { confidence: number; spans?: { start: number; end: number }[] }>;
}

export interface DraftOutput {
  drafts: SingleDraft[];
}

interface PromptPlan {
  outputType: string;
  scheme?: string;
  promptFile: string;
  outputSchemaFile: string;
}

export async function draftPrimitive(
  input: DraftInput,
): Promise<PrimitiveResult<DraftOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return ok({ drafts: [] });
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);

  const applicableSchemes = (input.state?.applicableSchemes as string[] | undefined) ?? [];
  const entity = (input.state?.entity as Record<string, unknown> | undefined) ?? {};
  const requested = input.config.outputs ?? [];

  const plan: PromptPlan[] = [];
  if (requested.includes('EprRegistrationDe')) {
    if (applicableSchemes.includes('stiftung-ear')) {
      plan.push({ outputType: 'EprRegistrationDe', scheme: 'stiftung-ear',
                  promptFile: 'draft.epr-de-weee.md', outputSchemaFile: 'EprRegistrationDe.json' });
    }
    if (applicableSchemes.includes('zsvr')) {
      plan.push({ outputType: 'EprRegistrationDe', scheme: 'zsvr',
                  promptFile: 'draft.epr-de-packaging.md', outputSchemaFile: 'EprRegistrationDe.json' });
    }
  }
  if (requested.includes('GpsrSafetyNotice')) {
    plan.push({ outputType: 'GpsrSafetyNotice',
                promptFile: 'draft.gpsr-article9.md', outputSchemaFile: 'GpsrSafetyNotice.json' });
  }

  const drafts: SingleDraft[] = [];

  // SEQUENTIAL — honor Groq TPM rule. No Promise.all.
  for (const item of plan) {
    const template = await loadPrompt(pack, item.promptFile);
    const outputSchema = await loadSchema(pack, item.outputSchemaFile);
    const schemeMeta = item.scheme
      ? (input.state?.schemes as Array<{ schemeId: string }> | undefined)?.find((s) => s.schemeId === item.scheme) ?? null
      : null;
    const prompt = renderPrompt(template, {
      productCatalogItemJson: JSON.stringify(entity, null, 2),
      schemeMetadataJson: JSON.stringify(schemeMeta, null, 2),
      outputSchemaJson: JSON.stringify(outputSchema, null, 2),
    });

    const { text } = await generateText({
      model: model(DEFAULT_FAST_MODEL),
      prompt,
      maxOutputTokens: 2500,
    });

    let parsed: { value?: Record<string, unknown>; fieldMeta?: SingleDraft['fieldMeta'] } = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      // ignore
    }

    drafts.push({
      outputType: item.outputType,
      scheme: item.scheme,
      value: parsed.value ?? {},
      fieldMeta: parsed.fieldMeta ?? {},
    });
  }

  const draftConfidences = drafts.map((d) => {
    const confs = Object.values(d.fieldMeta).map((m) => m.confidence ?? 0);
    return confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0.5;
  });
  const confidence = draftConfidences.length
    ? draftConfidences.reduce((a, b) => a + b, 0) / draftConfidences.length
    : 0.5;

  const result = ok({ drafts }, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'draft',
    inputs: { outputs: requested, applicableSchemes },
    output: { draftCount: drafts.length, outputTypes: drafts.map((d) => d.outputType) },
    model: { name: DEFAULT_FAST_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
