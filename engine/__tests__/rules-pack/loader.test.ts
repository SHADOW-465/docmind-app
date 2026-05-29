import { describe, it, expect } from 'vitest';
import path from 'path';
import { loadRulesPack } from '@engine/rules-pack/loader';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

describe('loadRulesPack', () => {
  it('loads the noop pack from disk', async () => {
    const pack = await loadRulesPack('noop', '1.0.0', PACKS_DIR);
    expect(pack.manifest.id).toBe('noop');
    expect(pack.manifest.version).toBe('1.0.0');
    expect(pack.rootDir.endsWith(path.join('rules-packs', 'noop', '1.0.0'))).toBe(true);
  });

  it('throws when manifest is missing', async () => {
    await expect(loadRulesPack('does-not-exist', '1.0.0', PACKS_DIR))
      .rejects.toThrow(/manifest/i);
  });
});
