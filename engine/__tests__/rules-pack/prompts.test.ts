import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';
import { loadPrompt, renderPrompt } from '@engine/rules-pack/prompts';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => { clearPackCache(); });

describe('loadPrompt', () => {
  it('reads a prompt .md from the pack', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const text = await loadPrompt(pack, 'classify.product-category.md');
    expect(text).toContain('Classify product into EU product category');
  });

  it('throws when prompt file is missing', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    await expect(loadPrompt(pack, 'does-not-exist.md')).rejects.toThrow(/prompt/i);
  });
});

describe('renderPrompt', () => {
  it('substitutes {{var}} placeholders', () => {
    const out = renderPrompt('Hello {{name}}, you are {{role}}.', {
      name: 'Acme', role: 'a producer',
    });
    expect(out).toBe('Hello Acme, you are a producer.');
  });

  it('leaves unknown placeholders intact', () => {
    expect(renderPrompt('{{a}}+{{b}}', { a: 'x' })).toBe('x+{{b}}');
  });
});
