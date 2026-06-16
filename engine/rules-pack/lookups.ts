// engine/rules-pack/lookups.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { RulesPack } from '@engine/types';

export interface Lookup {
  rows: ReadonlyArray<Record<string, unknown>>;
  indexBy(field: string): Map<unknown, Record<string, unknown>>;
}

const cache = new Map<string, Lookup>();

export async function loadLookup(pack: RulesPack, name: string): Promise<Lookup> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const full = path.join(pack.rootDir, 'lookups', `${name}.jsonl`);
  let raw: string;
  try {
    raw = await fs.readFile(full, 'utf-8');
  } catch (err) {
    throw new Error(`lookup file not found at ${full}: ${(err as Error).message}`);
  }
  const rows: Record<string, unknown>[] = raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      try { return JSON.parse(line) as Record<string, unknown>; }
      catch (e) { throw new Error(`malformed JSONL at ${full}:${i + 1}: ${(e as Error).message}`); }
    });
  const lookup: Lookup = {
    rows,
    indexBy(field: string) {
      const m = new Map<unknown, Record<string, unknown>>();
      for (const r of rows) m.set(r[field], r);
      return m;
    },
  };
  cache.set(key, lookup);
  return lookup;
}
