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
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

beforeEach(() => { generateTextMock.mockReset(); });

import { draftPrimitive } from '@engine/primitives/draft';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

describe('draftPrimitive', () => {
  it('produces one draft per applicable output, called sequentially', async () => {
    generateTextMock
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { scheme: 'stiftung-ear', producer: { name: 'Acme GmbH' } }, fieldMeta: {} }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { scheme: 'zsvr', producer: { name: 'Acme GmbH' } }, fieldMeta: {} }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { product: { name: 'X' }, manufacturer: { name: 'Acme GmbH' } }, fieldMeta: {} }) });

    const result = await draftPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'draft',
      config: { outputs: ['EprRegistrationDe', 'GpsrSafetyNotice'] },
      workspace,
      state: {
        applicableSchemes: ['stiftung-ear', 'zsvr'],
        entity: { name: 'USB-C Charger 65W', manufacturer: { name: 'Acme GmbH' } },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.value.drafts.length).toBe(3);
    expect(result.value.drafts.map((d) => d.outputType)).toEqual([
      'EprRegistrationDe', 'EprRegistrationDe', 'GpsrSafetyNotice',
    ]);
    expect(generateTextMock).toHaveBeenCalledTimes(3);
  });

  it('skips WEEE draft when stiftung-ear is not applicable', async () => {
    generateTextMock
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { scheme: 'zsvr' }, fieldMeta: {} }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ value: { product: { name: 'X' } }, fieldMeta: {} }) });

    const result = await draftPrimitive({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      nodeId: 'draft',
      config: { outputs: ['EprRegistrationDe', 'GpsrSafetyNotice'] },
      workspace,
      state: { applicableSchemes: ['zsvr'], entity: { name: 'T-Shirt' } },
    });
    expect(result.value.drafts.map((d) => d.scheme ?? d.outputType)).toEqual([
      'zsvr', 'GpsrSafetyNotice',
    ]);
    expect(generateTextMock).toHaveBeenCalledTimes(2);
  });
});
