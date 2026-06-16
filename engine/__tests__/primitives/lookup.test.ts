import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: () => ({ insert: () => ({}) }),
  }),
}));

import { lookupPrimitive } from '@engine/primitives/lookup';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('lookupPrimitive', () => {
  it('returns schemes matching the categoryId in state', async () => {
    const result = await lookupPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'lookup',
      config: { indexes: ['de-epr-schemes', 'eu-product-categories'] },
      workspace,
      state: { categoryId: 'cat-electronics-consumer' },
    });
    expect(result.ok).toBe(true);
    expect(result.value.schemes.length).toBeGreaterThanOrEqual(1);
    const ids = result.value.schemes.map((s) => s.schemeId);
    expect(ids).toContain('stiftung-ear');
    expect(ids).toContain('zsvr');
  });

  it('returns only zsvr (the wildcard match) when categoryId is non-electronics', async () => {
    const result = await lookupPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'lookup',
      config: { indexes: ['de-epr-schemes'] },
      workspace,
      state: { categoryId: 'cat-textiles' },
    });
    expect(result.ok).toBe(true);
    const ids = result.value.schemes.map((s) => s.schemeId);
    expect(ids).toEqual(['zsvr']);
  });
});
