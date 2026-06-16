import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { loadPackForRef, clearPackCache } from '@engine/rules-pack/context';
import { loadSchema, validatorFor } from '@engine/rules-pack/schemas';

const PACKS_DIR = path.resolve(__dirname, '../../../rules-packs');

beforeEach(() => { clearPackCache(); });

describe('loadSchema', () => {
  it('reads a JSON-Schema from the pack', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const schema = await loadSchema(pack, 'ProductCatalogItem.json');
    expect((schema as { title: string }).title).toBe('ProductCatalogItem');
  });
});

describe('validatorFor', () => {
  it('returns a validator that accepts a valid ProductCatalogItem', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const validate = await validatorFor(pack, 'ProductCatalogItem.json');
    const valid = {
      name: 'USB-C Charger 65W',
      manufacturer: { name: 'Acme GmbH', address: 'Berlin', country: 'DE' },
      weightGrams: 120,
      categoryId: 'cat-electronics-consumer',
    };
    expect(validate(valid)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('returns a validator that rejects an invalid manufacturer.country', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const validate = await validatorFor(pack, 'ProductCatalogItem.json');
    const invalid = {
      name: 'X',
      manufacturer: { name: 'A', address: 'B', country: 'germany' },
      weightGrams: 1,
      categoryId: 'cat-x',
    };
    expect(validate(invalid)).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });

  it('validates the GpsrSafetyNotice email format', async () => {
    const pack = await loadPackForRef('eu-gpsr-epr@2026.05.0', PACKS_DIR);
    const validate = await validatorFor(pack, 'GpsrSafetyNotice.json');
    const bad = {
      product: { name: 'X', modelOrType: 'M', batchOrSerial: 'B' },
      manufacturer: { name: 'Acme', postalAddress: 'Berlin', electronicAddress: 'not-an-email' },
      safetyInformation: { warnings: ['w'], instructionsForUse: 'use it' },
      languages: ['de'],
    };
    expect(validate(bad)).toBe(false);
  });
});
