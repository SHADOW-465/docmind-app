import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeTrace } from '@engine/primitives/trace';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  insertMock.mockClear();
  fromMock.mockClear();
});

describe('writeTrace', () => {
  it('inserts into eng_trace_events with snake_case columns', async () => {
    await writeTrace({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'classify',
      primitive: 'classify',
      inputs: { foo: 1 },
      output: { bar: 2 },
      model: { name: 'groq/llama-3.3-70b-versatile' },
      confidence: 0.9,
      latencyMs: 42,
      costUsd: 0.001,
      reviewer: null,
    });

    expect(fromMock).toHaveBeenCalledWith('eng_trace_events');
    const row = insertMock.mock.calls[0][0];
    expect(row.workspace_id).toBe('ws-1');
    expect(row.workflow_run_id).toBe('run-1');
    expect(row.node_id).toBe('classify');
    expect(row.primitive).toBe('classify');
    expect(row.latency_ms).toBe(42);
    expect(row.cost_usd).toBe(0.001);
  });
});
