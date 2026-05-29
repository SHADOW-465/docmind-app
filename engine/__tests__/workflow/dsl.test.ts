import { describe, it, expect } from 'vitest';
import { parseEdges } from '@engine/workflow/dsl';

describe('parseEdges', () => {
  it('parses a linear chain', () => {
    const edges = parseEdges(['ingest → classify → emit']);
    expect(edges).toEqual([
      { from: 'ingest', to: 'classify', guard: { kind: 'always' } },
      { from: 'classify', to: 'emit', guard: { kind: 'always' } },
    ]);
  });

  it('parses a guarded edge', () => {
    const edges = parseEdges(['validate → hitl [if needsReview]']);
    expect(edges).toEqual([
      { from: 'validate', to: 'hitl', guard: { kind: 'predicate', expr: 'needsReview' } },
    ]);
  });

  it('parses a guarded edge with max loops', () => {
    const edges = parseEdges(['hitl → draft [if reviewer.action == "regenerate", max 3 loops]']);
    expect(edges).toEqual([
      {
        from: 'hitl',
        to: 'draft',
        guard: { kind: 'predicate', expr: 'reviewer.action == "regenerate"' },
        maxLoops: 3,
      },
    ]);
  });

  it('accepts ASCII arrow "->" as well as "→"', () => {
    expect(parseEdges(['a -> b'])).toEqual([
      { from: 'a', to: 'b', guard: { kind: 'always' } },
    ]);
  });

  it('throws on malformed lines', () => {
    expect(() => parseEdges(['not an edge'])).toThrow();
  });
});
