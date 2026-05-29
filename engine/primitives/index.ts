// engine/primitives/index.ts
import type { PrimitiveNodeDef } from '@engine/types';

// Each factory returns a PrimitiveNodeDef so workflows are pure data structures.
// The runtime resolves the `primitive` field to the actual implementation in primitives/<name>.ts.

export const primitives = {
  ingest:   (config: { accept?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'ingest',   config }),
  classify: (config: { taxonomy?: string } = {}): PrimitiveNodeDef => ({ primitive: 'classify', config }),
  extract:  (config: { schema?: string }   = {}): PrimitiveNodeDef => ({ primitive: 'extract',  config }),
  lookup:   (config: { indexes?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'lookup',   config }),
  reason:   (config: { task?: string }     = {}): PrimitiveNodeDef => ({ primitive: 'reason',   config }),
  draft:    (config: { outputs?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'draft',    config }),
  validate: (config: { against?: string }  = {}): PrimitiveNodeDef => ({ primitive: 'validate', config }),
  hitl:     (config: { when?: string }     = {}): PrimitiveNodeDef => ({ primitive: 'hitl',     config }),
  emit:     (config: { formats?: string[] } = {}): PrimitiveNodeDef => ({ primitive: 'emit',     config }),
};
