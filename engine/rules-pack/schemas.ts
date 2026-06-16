// engine/rules-pack/schemas.ts
import { promises as fs } from 'fs';
import path from 'path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { RulesPack } from '@engine/types';

const schemaCache = new Map<string, object>();
const validatorCache = new Map<string, ValidateFunction>();

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

export async function loadSchema(pack: RulesPack, relPath: string): Promise<object> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${relPath}`;
  const hit = schemaCache.get(key);
  if (hit) return hit;
  const full = path.join(pack.rootDir, 'schemas', relPath);
  let raw: string;
  try {
    raw = await fs.readFile(full, 'utf-8');
  } catch (err) {
    throw new Error(`schema file not found at ${full}: ${(err as Error).message}`);
  }
  const parsed: object = JSON.parse(raw);
  schemaCache.set(key, parsed);
  return parsed;
}

export async function validatorFor(pack: RulesPack, relPath: string): Promise<ValidateFunction> {
  const key = `${pack.manifest.id}@${pack.manifest.version}::${relPath}`;
  const hit = validatorCache.get(key);
  if (hit) return hit;
  const schema = await loadSchema(pack, relPath);
  const v = ajv.compile(schema);
  validatorCache.set(key, v);
  return v;
}
