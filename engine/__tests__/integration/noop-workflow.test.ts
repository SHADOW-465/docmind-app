import { describe, it, expect, beforeAll } from 'vitest';
import { noopWorkflow } from '../../workflows/noop.workflow';

const RUN_INTEGRATION = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!RUN_INTEGRATION)('noop workflow end-to-end', () => {
  let workspaceId: string;

  beforeAll(async () => {
    const { createWorkspace } = await import('@engine/storage/workspace');
    const ws = await createWorkspace({
      workflowId: noopWorkflow.id,
      rulesPackId: 'noop',
      rulesPackVersion: '1.0.0',
    });
    workspaceId = ws.id;
  });

  it('runs ingest → emit and writes a trace event per node', async () => {
    const { runWorkflow } = await import('@engine/workflow/runtime');
    const out = await runWorkflow({
      graph: noopWorkflow,
      workspaceId,
      startNode: 'ingest',
      nodeInputs: {
        ingest: {
          file: {
            buffer: Buffer.from('hello world', 'utf-8'),
            filename: 'hello.txt',
            mime: 'text/plain',
          },
        },
      },
    });

    expect(out.finalNode).toBe('emit');
    expect(out.results.map((r) => r.node)).toEqual(['ingest', 'emit']);
    expect(out.results.every((r) => r.result.ok)).toBe(true);

    // Verify trace events were written.
    const { createServerClient } = await import('@/lib/supabase-server');
    const supabase = createServerClient();
    const { data: traces, error } = await supabase
      .from('eng_trace_events')
      .select('primitive, node_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    expect(error).toBeNull();
    expect(traces?.length).toBeGreaterThanOrEqual(2);
    expect(traces?.map((t) => t.primitive)).toEqual(expect.arrayContaining(['ingest', 'emit']));
  });
});
