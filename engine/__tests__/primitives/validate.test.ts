import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({ from: () => ({ insert: () => ({}) }) }),
}));

import { validatePrimitive } from '@engine/primitives/validate';
import type { Workspace } from '@engine/types';

const workspace: Workspace = {
  id: 'ws-1', orgId: 'org-1', ownerId: null,
  workflowId: 'gpsr-epr/v1',
  rulesPackId: 'eu-gpsr-epr', rulesPackVersion: '2026.05.0',
  status: 'open', createdAt: new Date().toISOString(),
};

const validWeee = {
  outputType: 'EprRegistrationDe',
  scheme: 'stiftung-ear',
  value: {
    scheme: 'stiftung-ear',
    producer: { name: 'Acme GmbH', address: 'Berlin', country: 'DE', deTaxNumber: '123/456/78901' },
    productCategory: 'cat-electronics-consumer',
    weeeClass: '4',
    perUnitWeights: { deviceGrams: 120, packagingGrams: 30 },
    registrationLanguage: 'de',
  },
  fieldMeta: {
    'producer.name': { confidence: 0.98 },
    'producer.address': { confidence: 0.96 },
    'weeeClass': { confidence: 0.92 },
  },
};

describe('validatePrimitive', () => {
  it('high-confidence + complete artifact → needsReview false', async () => {
    const result = await validatePrimitive({
      workspaceId: 'ws-1', workflowRunId: 'run-1', nodeId: 'validate',
      config: { against: 'schema+confidence+missing-fields' },
      workspace, state: { drafts: [validWeee] },
    });
    expect(result.ok).toBe(true);
    expect(result.value.needsReview).toBe(false);
    expect(result.value.issues.length).toBe(0);
    expect(result.needsReview).toBe(false);
  });

  it('low-confidence field → flagged as low-confidence', async () => {
    const lowConf = { ...validWeee, fieldMeta: { 'weeeClass': { confidence: 0.4 } } };
    const result = await validatePrimitive({
      workspaceId: 'ws-1', workflowRunId: 'run-1', nodeId: 'validate',
      config: { against: 'schema+confidence+missing-fields' },
      workspace, state: { drafts: [lowConf] },
    });
    expect(result.value.needsReview).toBe(true);
    expect(result.value.issues.some((i) => i.reason === 'low-confidence' && i.field === 'weeeClass')).toBe(true);
    expect(result.needsReview).toBe(true);
  });

  it('missing required field → flagged as missing-required', async () => {
    const missing = {
      ...validWeee,
      value: {
        scheme: 'stiftung-ear',
        producer: { name: 'Acme GmbH', address: 'Berlin', country: 'DE' },
        // productCategory MISSING (required)
        perUnitWeights: { deviceGrams: 120 },
      },
      fieldMeta: {},
    };
    const result = await validatePrimitive({
      workspaceId: 'ws-1', workflowRunId: 'run-1', nodeId: 'validate',
      config: { against: 'schema+confidence+missing-fields' },
      workspace, state: { drafts: [missing] },
    });
    expect(result.value.needsReview).toBe(true);
    expect(result.value.issues.some((i) => i.reason === 'missing-required')).toBe(true);
  });
});
