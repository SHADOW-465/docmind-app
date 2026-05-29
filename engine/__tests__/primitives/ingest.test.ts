import { describe, it, expect, vi } from 'vitest';
import { ingestPrimitive } from '@engine/primitives/ingest';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({
        data: {
          id: 'src-1', workspace_id: 'ws-1', filename: 'hello.txt',
          mime: 'text/plain', storage_url: null,
          typed_rep: { text: 'hi', pageCount: 1, fileType: 'txt' },
          is_large: false,
        },
        error: null,
      }) }) }),
    }),
  }),
}));

describe('ingestPrimitive', () => {
  it('runs extractor on a buffer and returns a Source result', async () => {
    const buf = Buffer.from('hi', 'utf-8');
    const result = await ingestPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: null,
      nodeId: 'ingest',
      file: { buffer: buf, filename: 'hello.txt', mime: 'text/plain' },
    });
    expect(result.ok).toBe(true);
    expect(result.value.source.id).toBe('src-1');
    expect(result.value.source.typedRep.fileType).toBe('txt');
  });
});
