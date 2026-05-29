// engine/rules-pack/loader.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { RulesPack } from '@engine/types';
import { parseManifest } from '@engine/rules-pack/schema';

export async function loadRulesPack(
  id: string,
  version: string,
  packsDir: string,
): Promise<RulesPack> {
  const rootDir = path.join(packsDir, id, version);
  const manifestPath = path.join(rootDir, 'manifest.json');
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    throw new Error(`Rules pack manifest not found at ${manifestPath}: ${(err as Error).message}`);
  }
  const json: unknown = JSON.parse(raw);
  const manifest = parseManifest(json);
  if (manifest.id !== id || manifest.version !== version) {
    throw new Error(
      `Manifest mismatch: directory says ${id}@${version}, manifest says ${manifest.id}@${manifest.version}`,
    );
  }
  return { manifest, rootDir };
}
