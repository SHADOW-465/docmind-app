import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';
import { loadLookup } from '@engine/rules-pack/lookups';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => { clearPackCache(); });

describe('loadLookup', () => {
  it('parses a JSONL file into an array of rows', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const lookup = await loadLookup(pack, 'eu-product-categories');
    expect(lookup.rows.length).toBeGreaterThanOrEqual(10);
    const first = lookup.rows[0] as { id: string };
    expect(first.id).toMatch(/^cat-/);
  });

  it('indexBy returns a map keyed by the given field', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const lookup = await loadLookup(pack, 'eu-product-categories');
    const byId = lookup.indexBy('id');
    expect(byId.get('cat-unknown')).toBeDefined();
    expect((byId.get('cat-unknown') as { label: string }).label).toMatch(/Unknown/);
  });

  it('throws when the lookup file is missing', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    await expect(loadLookup(pack, 'nope')).rejects.toThrow(/lookup/i);
  });
});
