import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn().mockResolvedValue({
  data: { id: 'ent-1', workspace_id: 'ws-1', type: 'classification',
          value: { categoryId: 'cat-electronics' }, citations: [] },
  error: null,
});
const selectMock = vi.fn().mockReturnValue({ single: insertMock });
const insertFnMock = vi.fn().mockReturnValue({ select: selectMock });
const eqMock = vi.fn().mockResolvedValue({ data: [], error: null });
const selectListMock = vi.fn().mockReturnValue({ eq: eqMock });
const fromMock = vi.fn().mockReturnValue({ insert: insertFnMock, select: selectListMock });

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  insertMock.mockClear(); selectMock.mockClear(); insertFnMock.mockClear();
  eqMock.mockClear(); selectListMock.mockClear(); fromMock.mockClear();
});

import { insertEntity, listEntities } from '@engine/storage/entities';

describe('insertEntity', () => {
  it('writes snake_case row and maps result back to domain shape', async () => {
    const ent = await insertEntity({
      workspaceId: 'ws-1',
      type: 'classification',
      value: { categoryId: 'cat-electronics' },
      citations: [],
    });
    expect(fromMock).toHaveBeenCalledWith('eng_canonical_entities');
    const row = insertFnMock.mock.calls[0][0];
    expect(row.workspace_id).toBe('ws-1');
    expect(row.type).toBe('classification');
    expect(row.value).toEqual({ categoryId: 'cat-electronics' });
    expect(ent.id).toBe('ent-1');
    expect(ent.workspaceId).toBe('ws-1');
  });
});

describe('listEntities', () => {
  it('filters by workspace_id and optionally by type', async () => {
    await listEntities('ws-1');
    expect(fromMock).toHaveBeenLastCalledWith('eng_canonical_entities');
    expect(selectListMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenLastCalledWith('workspace_id', 'ws-1');
  });
});
