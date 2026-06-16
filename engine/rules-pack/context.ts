// engine/rules-pack/context.ts
import path from 'path';
import type { RulesPack } from '@engine/types';
import { loadRulesPack } from '@engine/rules-pack/loader';
import { parsePackRef } from '@engine/rules-pack/version';

const DEFAULT_PACKS_DIR = path.resolve(process.cwd(), 'rules-packs');

// Process-wide cache keyed by "id@version".
const cache = new Map<string, RulesPack>();

export async function loadPackForRef(
  ref: string,
  packsDir: string = DEFAULT_PACKS_DIR,
): Promise<RulesPack> {
  const hit = cache.get(ref);
  if (hit) return hit;
  const { id, version } = parsePackRef(ref);
  const pack = await loadRulesPack(id, version, packsDir);
  cache.set(ref, pack);
  return pack;
}

export function clearPackCache(): void {
  cache.clear();
}
