import { describe, expect, it } from 'vitest';
import { DICTS, DEFAULT_LANG } from './i18n.js';

describe('dictionaries', () => {
  it('every language has the same keys and value types', () => {
    const shape = d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v]));
    for (const d of Object.values(DICTS)) expect(shape(d)).toEqual(shape(DICTS.en));
  });
  it('defaults to English', () => expect(DEFAULT_LANG).toBe('en'));
  it('uses the right plural forms', () => {
    expect(DICTS.en.passes(1)).toBe('1 pass');
    expect(DICTS.en.passes(5)).toBe('5 passes');
    expect(DICTS.uk.notes(1)).toBe('1 стікер');
    expect(DICTS.uk.notes(3)).toBe('3 стікери');
    expect(DICTS.uk.notes(25)).toBe('25 стікерів');
    expect(DICTS.uk.passes(11)).toBe('11 проходів');
  });
});
