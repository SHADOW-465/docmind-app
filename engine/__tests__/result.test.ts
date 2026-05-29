import { describe, it, expect } from 'vitest';
import { ok, fail, needsReview } from '@engine/result';

describe('result helpers', () => {
  it('ok() returns ok=true with value and confidence', () => {
    const r = ok({ foo: 'bar' }, { confidence: 0.92 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ foo: 'bar' });
    expect(r.confidence).toBe(0.92);
    expect(r.needsReview).toBe(false);
    expect(r.citations).toEqual([]);
  });

  it('ok() defaults confidence to 1.0 and citations to []', () => {
    const r = ok('anything');
    expect(r.confidence).toBe(1.0);
    expect(r.citations).toEqual([]);
  });

  it('fail() returns ok=false with error and confidence 0', () => {
    const r = fail('E_TEST', 'broken');
    expect(r.ok).toBe(false);
    expect(r.error).toEqual({ code: 'E_TEST', message: 'broken' });
    expect(r.confidence).toBe(0);
  });

  it('needsReview() flips needsReview flag', () => {
    const r = needsReview(ok({}, { confidence: 0.5 }));
    expect(r.needsReview).toBe(true);
  });
});
