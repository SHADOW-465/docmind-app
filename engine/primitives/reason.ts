// engine/primitives/reason.ts
import { generateText } from 'ai';
import { promises as fs } from 'fs';
import path from 'path';
import { writeTrace } from '@engine/primitives/trace';
import { ok } from '@engine/result';
import { model, DEFAULT_REASONING_MODEL } from '@engine/providers/gateway';
import { loadPackForRef } from '@engine/rules-pack/context';
import type { PrimitiveResult, Workspace } from '@engine/types';

export interface ReasonInput {
  workspaceId: string;
  workflowRunId: string | null;
  nodeId: string;
  config: { task?: string };
  workspace?: Workspace;
  state?: Record<string, unknown>;
}

export interface ReasonOutput {
  applicableSchemes: string[];
  gaps: string[];
  decisions: Array<{ rule: string; applied: boolean; rationale?: string }>;
}

export async function reasonPrimitive(
  input: ReasonInput,
): Promise<PrimitiveResult<ReasonOutput>> {
  const t0 = Date.now();
  if (!input.workspace) {
    return ok<ReasonOutput>({ applicableSchemes: [], gaps: [], decisions: [] });
  }

  const packRef = `${input.workspace.rulesPackId}@${input.workspace.rulesPackVersion}`;
  const pack = await loadPackForRef(packRef);
  const eligibilityYaml = await fs.readFile(
    path.join(pack.rootDir, 'rules', 'eligibility.yaml'), 'utf-8',
  );

  const schemes = (input.state?.schemes as Array<{ schemeId: string }> | undefined) ?? [];
  const prompt = `You apply EPR eligibility rules. Given the eligibility YAML, the looked-up
schemes, and the workflow state, decide which schemes actually apply and what
fields are missing. Return JSON exactly:

{ "applicableSchemes": ["..."], "gaps": ["dot.path"], "decisions": [{"rule":"id","applied":true,"rationale":"..."}], "confidence": 0.0-1.0 }

ELIGIBILITY YAML:
${eligibilityYaml}

LOOKED-UP SCHEMES:
${JSON.stringify(schemes, null, 2)}

WORKFLOW STATE (excerpt):
${JSON.stringify({ categoryId: input.state?.categoryId, entityKeys: Object.keys(input.state ?? {}) }, null, 2)}
`;

  const { text } = await generateText({
    model: model(DEFAULT_REASONING_MODEL),
    prompt,
    maxOutputTokens: 1500,
  });

  let parsed: Partial<ReasonOutput & { confidence?: number }> = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    // ignore
  }

  const value: ReasonOutput = {
    applicableSchemes: parsed.applicableSchemes ?? [],
    gaps: parsed.gaps ?? [],
    decisions: parsed.decisions ?? [],
  };
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;

  const result = ok(value, { confidence });
  await writeTrace({
    workspaceId: input.workspaceId, workflowRunId: input.workflowRunId, nodeId: input.nodeId,
    primitive: 'reason',
    inputs: { task: input.config.task ?? null, schemeCount: schemes.length },
    output: { applicableSchemes: value.applicableSchemes, gapsCount: value.gaps.length },
    model: { name: DEFAULT_REASONING_MODEL },
    confidence, latencyMs: Date.now() - t0,
    costUsd: null, reviewer: null,
  });
  return result;
}
