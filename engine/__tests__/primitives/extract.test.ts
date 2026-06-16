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
        data: { id: 'ent-2', workspace_id: 'ws-1', type: 'ProductCatalogItem',
                value: {}, citations: [] },
        error: null,
      }) }) }),
    }),
  }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { extractPrimitive } from '@engine/primitives/extract';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('extractPrimitive (real impl)', () => {
  it('parses LLM JSON into entity + fieldMeta', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        value: {
          name: 'USB-C Charger 65W',
          manufacturer: { name: 'Acme GmbH', address: 'Berlin', country: 'DE' },
          weightGrams: 120,
          categoryId: 'cat-electronics-consumer',
        },
        fieldMeta: { name: { confidence: 0.95, spans: [{ start: 0, end: 20 }] } },
      }),
    });
    const result = await extractPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'extract',
      config: { schema: 'ProductCatalogItem' },
      workspace,
      state: { categoryId: 'cat-electronics-consumer' },
      sourceText: 'USB-C Charger 65W by Acme GmbH, Berlin.',
    });
    expect(result.ok).toBe(true);
    expect(result.value.entity.name).toBe('USB-C Charger 65W');
    expect(result.value.fieldMeta.name.confidence).toBeCloseTo(0.95);
  });
});
