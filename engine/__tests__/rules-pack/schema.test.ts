import { describe, it, expect } from 'vitest';
import { manifestSchema, parseManifest } from '@engine/rules-pack/schema';

const valid = {
  id: 'noop',
  version: '1.0.0',
  displayName: 'No-op pack',
  locales: ['en'],
  schemas: [],
  rules: [],
  lookups: [],
  templates: [],
  hitlPolicy: 'hitl-policy.yaml',
};

describe('manifestSchema', () => {
  it('accepts a valid manifest', () => {
    expect(() => manifestSchema.parse(valid)).not.toThrow();
  });

  it('rejects missing id', () => {
    const { id, ...bad } = valid;
    expect(() => manifestSchema.parse(bad)).toThrow();
  });

  it('rejects non-semver version', () => {
    expect(() => manifestSchema.parse({ ...valid, version: 'banana' })).toThrow();
  });

  it('parseManifest returns typed object', () => {
    const m = parseManifest(valid);
    expect(m.id).toBe('noop');
    expect(m.version).toBe('1.0.0');
  });
});
