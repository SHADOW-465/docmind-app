import { describe, it, expect, vi } from 'vitest';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

import { hitlPrimitive } from '@engine/primitives/hitl';

describe('hitlPrimitive (Phase 2 auto-approve pass-through)', () => {
  it('returns approve and logs reviewer action auto-approve-phase2', async () => {
    const result = await hitlPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'hitl',
      config: { when: 'confidence<0.85' },
    });
    expect(result.ok).toBe(true);
    expect(result.value.reviewer.action).toBe('approve');
    const traceRow = insertMock.mock.calls[0][0];
    expect(traceRow.reviewer.action).toBe('auto-approve-phase2');
  });
});
