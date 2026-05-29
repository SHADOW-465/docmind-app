import { describe, it, expect } from 'vitest';
import { parsePackRef, formatPackRef, satisfies } from '@engine/rules-pack/version';

describe('parsePackRef', () => {
  it('parses "id@version" into parts', () => {
    expect(parsePackRef('eu-gpsr-epr@2026.03.0')).toEqual({
      id: 'eu-gpsr-epr', version: '2026.03.0',
    });
  });

  it('throws on missing @', () => {
    expect(() => parsePackRef('eu-gpsr-epr')).toThrow(/expected "id@version"/);
  });

  it('throws on empty id or version', () => {
    expect(() => parsePackRef('@1.0.0')).toThrow();
    expect(() => parsePackRef('foo@')).toThrow();
  });
});

describe('formatPackRef', () => {
  it('round-trips', () => {
    expect(formatPackRef('foo', '1.2.3')).toBe('foo@1.2.3');
  });
});

describe('satisfies', () => {
  it('returns true for exact match', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
  });
  it('returns false for any mismatch (skeleton supports only exact pinning)', () => {
    expect(satisfies('1.2.3', '1.2.4')).toBe(false);
  });
});
