import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => {
  clearPackCache();
});

describe('loadPackForRef', () => {
  it('loads a pack by "id@version" reference', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    expect(pack.manifest.id).toBe('eu-gpsr-epr');
    expect(pack.manifest.version).toBe('2026.05.0');
  });

  it('returns the same instance on repeat call (cached)', async () => {
    const a = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const b = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    expect(a).toBe(b);
  });

  it('rejects malformed refs', async () => {
    await expect(loadPackForRef('no-at-sign', PACKS_DIR)).rejects.toThrow();
  });
});
