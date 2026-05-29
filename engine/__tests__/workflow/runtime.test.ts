import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({}),
}));

import { pickNextNode, evalGuard } from '@engine/workflow/runtime';
import type { WorkflowEdge } from '@engine/types';

describe('evalGuard', () => {
  it('always-guards return true', () => {
    expect(evalGuard({ kind: 'always' }, {})).toBe(true);
  });

  it('predicate guard reads boolean from state by key', () => {
    expect(evalGuard({ kind: 'predicate', expr: 'needsReview' }, { needsReview: true })).toBe(true);
    expect(evalGuard({ kind: 'predicate', expr: 'needsReview' }, { needsReview: false })).toBe(false);
  });

  it('predicate guard supports negation', () => {
    expect(evalGuard({ kind: 'predicate', expr: '!needsReview' }, { needsReview: false })).toBe(true);
    expect(evalGuard({ kind: 'predicate', expr: '!needsReview' }, { needsReview: true })).toBe(false);
  });
});

describe('pickNextNode', () => {
  const edges: WorkflowEdge[] = [
    { from: 'a', to: 'b', guard: { kind: 'predicate', expr: 'go' } },
    { from: 'a', to: 'c', guard: { kind: 'predicate', expr: '!go' } },
  ];
  it('picks the first matching edge', () => {
    expect(pickNextNode('a', edges, { go: true })).toBe('b');
    expect(pickNextNode('a', edges, { go: false })).toBe('c');
  });
  it('returns null when no edge matches (terminal node)', () => {
    expect(pickNextNode('z', edges, {})).toBeNull();
  });
});
