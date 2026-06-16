import { describe, it, expect } from 'vitest';
import { gpsrEprWorkflow } from '../../workflows/gpsr-epr.workflow';

describe('gpsrEprWorkflow', () => {
  it('has id gpsr-epr/v1 and references eu-gpsr-epr@2026.05.0', () => {
    expect(gpsrEprWorkflow.id).toBe('gpsr-epr/v1');
    expect(gpsrEprWorkflow.rulesPack).toBe('eu-gpsr-epr@2026.05.0');
  });

  it('has all 9 nodes', () => {
    const names = Object.keys(gpsrEprWorkflow.nodes).sort();
    expect(names).toEqual(['classify','draft','emit','extract','hitl','ingest','lookup','reason','validate']);
  });

  it('has an edge from validate to hitl guarded by needsReview', () => {
    const e = gpsrEprWorkflow.edges.find((e) => e.from === 'validate' && e.to === 'hitl');
    expect(e).toBeDefined();
    expect(e!.guard.kind).toBe('predicate');
  });

  it('has an unconditional edge from hitl to emit', () => {
    const e = gpsrEprWorkflow.edges.find((e) => e.from === 'hitl' && e.to === 'emit');
    expect(e).toBeDefined();
    expect(e!.guard.kind).toBe('always');
  });
});
