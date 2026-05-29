// engine/rules-pack/version.ts

export interface PackRef {
  id: string;
  version: string;
}

const REF_RE = /^([a-z0-9][a-z0-9-]*)@(\d+\.\d+\.\d+)$/;

export function parsePackRef(ref: string): PackRef {
  const m = REF_RE.exec(ref);
  if (!m) throw new Error(`Invalid pack ref "${ref}": expected "id@version" (semver)`);
  return { id: m[1], version: m[2] };
}

export function formatPackRef(id: string, version: string): string {
  return `${id}@${version}`;
}

/**
 * Skeleton-only: strict equality. A later phase can swap in a real semver range check.
 */
export function satisfies(actual: string, required: string): boolean {
  return actual === required;
}
