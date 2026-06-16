import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: generateTextMock };
});
vi.mock('@engine/providers/gateway', () => ({
  model: (id: string) => ({ id }),
  DEFAULT_FAST_MODEL: 'mock/fast',
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({
        data: { id: 'ent-1', workspace_id: 'ws-1', type: 'classification',
                value: { categoryId: 'cat-electronics-consumer', confidence: 0.92 },
                citations: [] },
        error: null,
      }) }) }),
    }),
  }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { classifyPrimitive } from '@engine/primitives/classify';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('classifyPrimitive (real impl)', () => {
  it('calls the LLM, parses JSON, returns categoryId + confidence', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: '{ "categoryId": "cat-electronics-consumer", "confidence": 0.92, "rationale": "USB-C charger" }',
    });
    const result = await classifyPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'classify',
      config: { taxonomy: 'eu-product-category' },
      workspace,
      state: {},
      sourceText: 'A 65W USB-C GaN charger by Acme GmbH.',
    });
    expect(result.ok).toBe(true);
    expect(result.value.categoryId).toBe('cat-electronics-consumer');
    expect(result.confidence).toBeCloseTo(0.92);
  });

  it('falls back to cat-unknown with confidence 0 when LLM returns garbage', async () => {
    generateTextMock.mockResolvedValueOnce({ text: 'not json at all' });
    const result = await classifyPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'classify',
      config: { taxonomy: 'eu-product-category' },
      workspace,
      state: {},
      sourceText: '',
    });
    expect(result.ok).toBe(true);
    expect(result.value.categoryId).toBe('cat-unknown');
    expect(result.confidence).toBe(0);
  });
});
