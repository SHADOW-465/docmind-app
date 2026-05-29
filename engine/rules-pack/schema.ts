// engine/rules-pack/schema.ts
import { z } from 'zod';
import type { RulesPackManifest } from '@engine/types';

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be kebab-case'),
  version: z.string().regex(SEMVER_RE, 'version must be semver MAJOR.MINOR.PATCH'),
  displayName: z.string().min(1),
  locales: z.array(z.string().regex(/^[a-z]{2}$/)).min(1),
  schemas: z.array(z.string()),
  rules: z.array(z.string()),
  lookups: z.array(z.string()),
  templates: z.array(z.string()),
  hitlPolicy: z.string().min(1),
}) satisfies z.ZodType<RulesPackManifest>;

export function parseManifest(input: unknown): RulesPackManifest {
  return manifestSchema.parse(input);
}
