import { describe, expect, it } from 'vitest';

import {
  extractMessageCatalogStrings,
  isMessageCatalogFile,
} from '../../../../scripts/ste/catalogs.mjs';

const texts = (source: string, path = 'messages/en.json'): string[] =>
  extractMessageCatalogStrings(source, path).map((unit) => unit.text);

describe('message catalog extraction', () => {
  it('recognizes localization JSON catalogs at any catalog depth', () => {
    expect(isMessageCatalogFile('messages/en.json')).toBe(true);
    expect(isMessageCatalogFile('messages/navigation/en.json')).toBe(true);
    expect(isMessageCatalogFile('src/lib/config/messages.json')).toBe(false);
  });

  it('reads every string value, including one-letter labels', () => {
    const source = JSON.stringify({ home: 'Home', grade: 'A', search: 'Search games' }, null, 2);
    expect(texts(source)).toEqual(['Home', 'A', 'Search games']);
  });

  it('keeps parameter-only messages in semantic review coverage', () => {
    const source = JSON.stringify({ count: '{count}' }, null, 2);
    const units = extractMessageCatalogStrings(source, 'messages/en.json');

    expect(units).toHaveLength(1);
    expect(units[0]?.text).toBe('');
    expect(units[0]?.reviewRequired).toBe(true);
  });

  it('removes parameters from checked prose and marks the unit for review', () => {
    const source = JSON.stringify({ current: 'Current price {price}.' }, null, 2);
    const units = extractMessageCatalogStrings(source, 'messages/en.json');

    expect(units).toHaveLength(1);
    expect(units[0]?.text).toBe('Current price.');
    expect(units[0]?.reviewRequired).toBe(true);
  });

  it('reads only rendered patterns from supported complex message syntax', () => {
    const source = JSON.stringify(
      {
        items: [
          {
            declarations: ['input count', 'local category = count: plural'],
            selectors: ['category'],
            match: { 'category=one': 'One item', 'category=other': '{count} items' },
          },
        ],
      },
      null,
      2,
    );

    expect(texts(source)).toEqual(['One item', 'items']);
  });

  it('fails closed for unsupported future complex message fields', () => {
    const source = JSON.stringify({ items: [{ match: { other: 'Items' }, future: 'value' }] });
    expect(() => texts(source)).toThrow('Unsupported Inlang complex message field: future.');
  });

  it('fails closed for unsupported future complex message values', () => {
    const source = JSON.stringify({ items: [{ match: { other: { pattern: 'Items' } } }] });
    expect(() => texts(source)).toThrow('Unsupported Inlang message value in match.');
  });

  it('does not treat schema metadata as visitor text', () => {
    const source = JSON.stringify({ $schema: 'https://example.invalid/schema', home: 'Home' });
    expect(texts(source)).toEqual(['Home']);
  });
});
