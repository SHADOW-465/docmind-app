// engine/workflows/noop.workflow.ts
import { defineWorkflow } from '@engine/workflow/defineWorkflow';
import { primitives as P } from '@engine/primitives';

export const noopWorkflow = defineWorkflow({
  id: 'noop/v1',
  rulesPack: 'noop@1.0.0',
  nodes: {
    ingest: P.ingest({ accept: ['txt'] }),
    emit:   P.emit({ formats: ['noop'] }),
  },
  edges: [
    'ingest → emit',
  ],
});
