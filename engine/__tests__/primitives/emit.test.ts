import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertArtifactMock, updateArtifactMock } = vi.hoisted(() => ({
  insertArtifactMock: vi.fn(),
  updateArtifactMock: vi.fn(),
}));
vi.mock('@engine/storage/artifact', () => ({
  insertArtifact: (i: unknown) => insertArtifactMock(i),
  updateArtifact: (id: string, p: unknown) => updateArtifactMock(id, p),
}));
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

beforeEach(() => {
  insertArtifactMock.mockReset(); updateArtifactMock.mockReset();
  insertArtifactMock.mockImplementation((input: { workspaceId: string; type: string }) =>
    Promise.resolve({ id: `art-${input.type}`, workspaceId: input.workspaceId, type: input.type,
                      schemaId: input.type, value: {}, status: 'draft',
                      emittedFormat: null, emittedUrl: null }));
  updateArtifactMock.mockResolvedValue(undefined);
});

import { emitPrimitive } from '@engine/primitives/emit';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('emitPrimitive', () => {
  it('inserts an artifact per draft and marks them emitted as json', async () => {
    const drafts = [
      { outputType: 'EprRegistrationDe', scheme: 'stiftung-ear', value: { scheme: 'stiftung-ear' }, fieldMeta: {} },
      { outputType: 'EprRegistrationDe', scheme: 'zsvr', value: { scheme: 'zsvr' }, fieldMeta: {} },
      { outputType: 'GpsrSafetyNotice', value: { product: { name: 'X' } }, fieldMeta: {} },
    ];
    const result = await emitPrimitive({
      workspaceId: 'ws-1', workflowRunId: 'run-1', nodeId: 'emit',
      config: { formats: ['json'] },
      workspace, state: { drafts },
    });
    expect(result.ok).toBe(true);
    expect(insertArtifactMock).toHaveBeenCalledTimes(3);
    expect(updateArtifactMock).toHaveBeenCalledTimes(3);
    const updates = updateArtifactMock.mock.calls.map((c) => c[1] as { status: string; emittedFormat: string });
    expect(updates.every((u) => u.status === 'emitted' && u.emittedFormat === 'json')).toBe(true);
    expect(result.value.emitted.length).toBe(3);
  });
});
