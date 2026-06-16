// engine/workflows/gpsr-epr.workflow.ts
import { defineWorkflow } from '@engine/workflow/defineWorkflow';
import { primitives as P } from '@engine/primitives';

export const gpsrEprWorkflow = defineWorkflow({
  id: 'gpsr-epr/v1',
  rulesPack: 'eu-gpsr-epr@2026.05.0',
  nodes: {
    ingest:   P.ingest({ accept: ['pdf', 'docx', 'txt', 'image'] }),
    classify: P.classify({ taxonomy: 'eu-product-category' }),
    extract:  P.extract({ schema: 'ProductCatalogItem' }),
    lookup:   P.lookup({ indexes: ['de-epr-schemes', 'eu-product-categories'] }),
    reason:   P.reason({ task: 'de-epr-eligibility' }),
    draft:    P.draft({ outputs: ['EprRegistrationDe', 'GpsrSafetyNotice'] }),
    validate: P.validate({ against: 'schema+confidence+missing-fields' }),
    hitl:     P.hitl({ when: 'confidence<0.85 || rule:HIGH_RISK_PRODUCT' }),
    emit:     P.emit({ formats: ['json'] }),
  },
  edges: [
    'ingest → classify → extract → lookup → reason → draft → validate',
    'validate → hitl  [if needsReview]',
    'validate → emit  [if !needsReview]',
    'hitl → emit',
  ],
});
