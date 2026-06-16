import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: generateTextMock };
});
vi.mock('@engine/providers/gateway', () => ({
  model: (id: string) => ({ id }),
  DEFAULT_REASONING_MODEL: 'mock/reasoner',
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { reasonPrimitive } from '@engine/primitives/reason';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('reasonPrimitive', () => {
  it('returns applicableSchemes + gaps from LLM output', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        applicableSchemes: ['stiftung-ear', 'zsvr'],
        gaps: ['producer.vatId'],
        decisions: [{ rule: 'weee-electronics', applied: true }],
        confidence: 0.9,
      }),
    });
    const result = await reasonPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'reason',
      config: { task: 'de-epr-eligibility' },
      workspace,
      state: { schemes: [{ schemeId: 'stiftung-ear' }, { schemeId: 'zsvr' }] },
    });
    expect(result.ok).toBe(true);
    expect(result.value.applicableSchemes).toEqual(['stiftung-ear', 'zsvr']);
    expect(result.value.gaps).toEqual(['producer.vatId']);
  });
});
