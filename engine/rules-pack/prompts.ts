// engine/rules-pack/prompts.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { RulesPack } from '@engine/types';

const cache = new Map<string, string>();

export async function loadPrompt(pack: RulesPack, relPath: string): Promise<string> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${relPath}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const full = path.join(pack.rootDir, 'rules', 'prompts', relPath);
  try {
    const text = await fs.readFile(full, 'utf-8');
    cache.set(key, text);
    return text;
  } catch (err) {
    throw new Error(`prompt file not found at ${full}: ${(err as Error).message}`);
  }
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (m, name) => {
    return name in vars ? vars[name] : m;
  });
}
