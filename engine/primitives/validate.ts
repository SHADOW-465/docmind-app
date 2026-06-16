// engine/primitives/validate.ts
import { promises as fs } from 'fs';
import path from 'path';
import * as yaml from 'yaml';
import { writeTrace } from '@engine/primitives/trace';
import { ok, needsReview as flagNeedsReview } from '@engine/result';
import { loadPackForRef } from '@engine/rules-pack/context';
import { validatorFor } from '@engine/rules-pack/schemas';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ValidateInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { against?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

export interface ValidateIssue {
  draftIndex: number;
  outputType: string;
  field: string;
  reason: 'schema-violation' | 'low-confidence' | 'missing-required';
  detail?: string;
}

export interface ValidateOutput {
  needsReview: boolean;
  issues: ValidateIssue[];
}

interface DraftLike {
  outputType: string;
  value: Record<string, unknown>;
  fieldMeta: Record<string, { confidence?: number }>;
}

export async function validatePrimitive(
  input: ValidateInput,
): Promise<PrimitiveResult<ValidateOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return ok({ needsReview: false, issues: [] });
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);

  const hitlText = await fs.readFile(path.join(pack.rootDir, 'hitl-policy.yaml'), 'utf-8');
  const hitlPolicy = yaml.parse(hitlText) as { threshold?: number };
  const threshold = typeof hitlPolicy.threshold === 'number' ? hitlPolicy.threshold : 0.85;

  const drafts = (input.state?.drafts as DraftLike[] | undefined) ?? [];
  const issues: ValidateIssue[] = [];

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];

    const validator = await validatorFor(pack, `${d.outputType}.json`);
    const okSchema = validator(d.value);
    if (!okSchema && validator.errors) {
      for (const err of validator.errors) {
        const field =
          err.instancePath.replace(/^\//, '').replace(/\//g, '.') ||
          (err.params as { missingProperty?: string }).missingProperty ||
          'root';
        const reason: ValidateIssue['reason'] =
          err.keyword === 'required' ? 'missing-required' : 'schema-violation';
        issues.push({ draftIndex: i, outputType: d.outputType, field, reason, detail: err.message });
      }
    }

    for (const [field, meta] of Object.entries(d.fieldMeta ?? {})) {
      if (typeof meta.confidence === 'number' && meta.confidence < threshold) {
        issues.push({
          draftIndex: i, outputType: d.outputType, field, reason: 'low-confidence',
          detail: `confidence ${meta.confidence.toFixed(2)} < threshold ${threshold}`,
        });
      }
    }
  }

  const value: ValidateOutput = { needsReview: issues.length > 0, issues };
  const base = ok(value, { confidence: 1.0 });
  const result = value.needsReview ? flagNeedsReview(base) : base;

  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'validate',
    inputs: { against: input.config.against ?? null, draftCount: drafts.length, threshold },
    output: { needsReview: value.needsReview, issueCount: issues.length },
    model: null, confidence: 1.0, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
