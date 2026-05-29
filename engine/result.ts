// engine/result.ts
import type { PrimitiveResult, CitationAnchor } from '@engine/types';

export function ok<T>(
  value: T,
  opts: { confidence?: number; citations?: CitationAnchor[] } = {},
): PrimitiveResult<T> {
  return {
    ok: true,
    value,
    confidence: opts.confidence ?? 1.0,
    citations: opts.citations ?? [],
    needsReview: false,
  };
}

export function fail(code: string, message: string): PrimitiveResult<null> {
  return {
    ok: false,
    value: null,
    confidence: 0,
    citations: [],
    needsReview: false,
    error: { code, message },
  };
}

export function needsReview<T>(r: PrimitiveResult<T>): PrimitiveResult<T> {
  return { ...r, needsReview: true };
}
